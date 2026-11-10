import { GoogleGenAI as GeminiSdkClient } from '@google/genai'
import { isGeminiQuotaError, reportGeminiQuota } from './geminiQuota'
import { GEMINI_MODEL_FALLBACKS } from './geminiModels'

type ClientOptions = NonNullable<ConstructorParameters<typeof GeminiSdkClient>[0]>

const unavailableUntil = new Map<string, number>()
let fallbackApiKeys: string[] = []

function quotaScope(key: string, model?: string): string {
  return model ? `${key}:${model}` : key
}

function uniqueKeys(primaryKey: string): string[] {
  const allKeys = [primaryKey.trim(), ...fallbackApiKeys]
    .map((key) => key.trim())
    .filter(Boolean)
  return [...new Set(allKeys)]
}

function requestOrder(keys: string[], model?: string): number[] {
  const now = Date.now()
  const available = keys
    .map((key, index) => ({ key, index }))
    .filter(({ key }) => (unavailableUntil.get(quotaScope(key, model)) ?? 0) <= now)
    .map(({ index }) => index)
  return available.length ? available : keys.map((_, index) => index)
}

function markQuotaLimited(key: string, error: unknown, model?: string) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  const dailyLimit = /per.day|requestsperday|daily limit|quota_exceeded/i.test(message)
  const retryAt = dailyLimit
    ? new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1).getTime()
    : Date.now() + 60_000
  unavailableUntil.set(quotaScope(key, model), retryAt)
}

function requestModel(args: unknown[]): string | undefined {
  if (!args.length || typeof args[0] !== 'object' || args[0] === null) return undefined
  const model = Reflect.get(args[0], 'model')
  return typeof model === 'string' ? model : undefined
}

function argsForModel(args: unknown[], model: string): unknown[] {
  if (!args.length || typeof args[0] !== 'object' || args[0] === null) return args
  return [{ ...args[0], model }, ...args.slice(1)]
}

function fallbackModels(args: unknown[]): string[] {
  const model = requestModel(args)
  return model && Object.hasOwn(GEMINI_MODEL_FALLBACKS, model)
    ? [...GEMINI_MODEL_FALLBACKS[model]]
    : []
}

function canRetryModel(error: unknown): boolean {
  if (isGeminiQuotaError(error)) return true
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /\b404\b|\b503\b|NOT_FOUND|UNAVAILABLE|model.{0,40}(not found|unavailable)|overloaded|high demand/i.test(message)
}

function withLiveQuotaHandler(args: unknown[], keyIndex: number, keys: string[], model?: string): unknown[] {
  if (!args.length || typeof args[0] !== 'object' || args[0] === null) return args
  const options = args[0] as { callbacks?: Record<string, unknown> }
  if (!options.callbacks || typeof options.callbacks.onerror !== 'function') return args
  const originalOnError = options.callbacks.onerror as (event: unknown) => void
  return [{
    ...options,
    callbacks: {
      ...options.callbacks,
      onerror: (event: unknown) => {
        if (isGeminiQuotaError(event)) markQuotaLimited(keys[keyIndex], event, model)
        originalOnError(event)
      },
    },
  }, ...args.slice(1)]
}

function proxyClient<T extends object>(clients: T[], keys: string[], path: PropertyKey[] = []): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const members = clients.map((client) => Reflect.get(client, property, client))
      const firstMember = members[0]
      if (typeof firstMember === 'function') {
        return async (...args: unknown[]) => {
          let lastQuotaError: unknown
          let lastModelError: unknown
          const canFallbackModels = path.length === 1 && path[0] === 'models'
            && (property === 'generateContent' || property === 'generateContentStream')
          const originalModel = requestModel(args)
          const modelCandidates: (string | undefined)[] = originalModel
            ? [originalModel, ...(canFallbackModels ? fallbackModels(args) : [])]
            : [undefined]
          for (const model of modelCandidates) {
            const modelArgs = model && model !== originalModel ? argsForModel(args, model) : args
            for (const index of requestOrder(keys, model)) {
              try {
                const invocationArgs = path.length === 1 && path[0] === 'live' && property === 'connect'
                  ? withLiveQuotaHandler(modelArgs, index, keys, model)
                  : modelArgs
                const result = await Reflect.apply(members[index] as (...methodArgs: unknown[]) => unknown, clients[index], invocationArgs)
                if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
                  return retryQuotaLimitedStream(
                    result as AsyncIterable<unknown>,
                    index,
                    keys,
                    members,
                    clients,
                    modelArgs,
                    canFallbackModels ? modelCandidates.slice(modelCandidates.indexOf(model) + 1).filter((candidate): candidate is string => Boolean(candidate)) : [],
                  )
                }
                if (model && model !== originalModel) console.info(`Gemini quota fallback switched from ${originalModel} to ${model}.`)
                return result
              } catch (error) {
                if (isGeminiQuotaError(error)) {
                  lastQuotaError = error
                  markQuotaLimited(keys[index], error, model)
                } else if (canFallbackModels && modelCandidates.length > 1 && canRetryModel(error)) {
                  lastModelError = error
                } else {
                  throw error
                }
              }
            }
          }
          if (lastQuotaError !== undefined) {
            reportGeminiQuota(lastQuotaError, true)
            throw lastQuotaError
          }
          throw lastModelError ?? new Error('No Speakia AI API keys are configured.')
        }
      }
      if (firstMember && typeof firstMember === 'object') {
        return proxyClient(members as object[], keys, [...path, property])
      }
      return firstMember
    },
  })
}

function retryQuotaLimitedStream<T>(
  initialStream: AsyncIterable<T>,
  initialIndex: number,
  keys: string[],
  members: unknown[],
  clients: object[],
  args: unknown[],
  modelFallbacks: string[] = [],
): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      let stream = initialStream
      let index = initialIndex
      let yielded = false
      let model = requestModel(args)
      let currentArgs = args
      let lastModelError: unknown
      const attemptedKeys = new Set([initialIndex])
      const attemptedModels = new Set([model])
      while (true) {
        try {
          for await (const item of stream) {
            yielded = true
            yield item
          }
          return
        } catch (error) {
          if (!canRetryModel(error)) throw error
          if (isGeminiQuotaError(error)) markQuotaLimited(keys[index], error, model)
          else lastModelError = error
          if (yielded) {
            if (isGeminiQuotaError(error)) reportGeminiQuota(error)
            throw error
          }
          let lastQuotaError = isGeminiQuotaError(error) ? error : undefined
          while (true) {
            const nextIndex = requestOrder(keys, model).find((candidate) => !attemptedKeys.has(candidate))
            if (nextIndex !== undefined) {
              index = nextIndex
              attemptedKeys.add(index)
              try {
                stream = await Reflect.apply(members[index] as (...methodArgs: unknown[]) => Promise<AsyncIterable<T>>, clients[index], currentArgs)
                break
              } catch (retryError) {
                if (!canRetryModel(retryError)) throw retryError
                if (isGeminiQuotaError(retryError)) {
                  markQuotaLimited(keys[index], retryError, model)
                  lastQuotaError = retryError
                } else {
                  lastModelError = retryError
                }
                continue
              }
            }
            const nextModel = modelFallbacks.find((candidate) => !attemptedModels.has(candidate))
            if (nextModel === undefined) {
              if (lastQuotaError !== undefined) {
                reportGeminiQuota(lastQuotaError, true)
                throw lastQuotaError
              }
              throw lastModelError ?? error
            }
            model = nextModel
            attemptedModels.add(model)
            attemptedKeys.clear()
            currentArgs = argsForModel(args, model)
            let fallbackStreamStarted = false
            for (const retryIndex of requestOrder(keys, model)) {
              attemptedKeys.add(retryIndex)
              try {
                stream = await Reflect.apply(
                  members[retryIndex] as (...methodArgs: unknown[]) => Promise<AsyncIterable<T>>,
                  clients[retryIndex],
                  currentArgs,
                )
                index = retryIndex
                console.info(`Gemini quota fallback switched from ${requestModel(args)} to ${model}.`)
                fallbackStreamStarted = true
                break
              } catch (retryError) {
                if (!canRetryModel(retryError)) throw retryError
                if (isGeminiQuotaError(retryError)) {
                  markQuotaLimited(keys[retryIndex], retryError, model)
                  lastQuotaError = retryError
                } else {
                  lastModelError = retryError
                }
              }
            }
            if (fallbackStreamStarted) break
          }
        }
      }
    },
  }
}

export function configureGeminiFallbackApiKeys(keys: string[]) {
  fallbackApiKeys = [...new Set(keys.map((key) => key.trim()).filter(Boolean))]
  unavailableUntil.clear()
}

export class GoogleGenAI extends GeminiSdkClient {
  constructor(options: ClientOptions) {
    super(options)
    const primaryKey = options.apiKey?.trim() ?? ''
    const keys = uniqueKeys(primaryKey)
    if (!keys.length) return this
    const clients = keys.map((key) => key === primaryKey
      ? this
      : new GeminiSdkClient({ ...options, apiKey: key }))
    return proxyClient(clients, keys) as GoogleGenAI
  }
}
