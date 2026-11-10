export const API_KEY_STORAGE_KEY = 'speakia-gemini-prototype-key'

const databaseName = 'speakia-browser-settings'
const databaseVersion = 1
const storeName = 'settings'
const apiKeyRecordKey = 'gemini-api-key'
const fallbackApiKeysRecordKey = 'gemini-fallback-api-keys'

export interface GeminiApiKeys {
  primary: string
  fallbacks: string[]
}

function normalizeApiKeys(primary: string, fallbacks: string[]): GeminiApiKeys {
  const normalizedPrimary = primary.trim()
  const seen = new Set(normalizedPrimary ? [normalizedPrimary] : [])
  const normalizedFallbacks = fallbacks
    .map((key) => key.trim())
    .filter((key) => {
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  return { primary: normalizedPrimary, fallbacks: normalizedFallbacks }
}

function openSettingsDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('This browser does not support secure browser-database storage.'))
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open browser settings storage.'))
    request.onblocked = () => reject(new Error('Browser settings storage is blocked by another open Speakia tab.'))
  })
}

export async function readGeminiApiKey(): Promise<string> {
  return (await readGeminiApiKeys()).primary
}

export async function readGeminiApiKeys(): Promise<GeminiApiKeys> {
  const database = await openSettingsDatabase()
  try {
    const savedKeys = await new Promise<GeminiApiKeys>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const primaryRequest = store.get(apiKeyRecordKey)
      const fallbackRequest = store.get(fallbackApiKeysRecordKey)
      let primary: string | undefined
      let fallbacks: string[] = []
      let completed = 0
      const complete = () => {
        completed += 1
        if (completed === 2) resolve(normalizeApiKeys(primary ?? '', fallbacks))
      }
      primaryRequest.onsuccess = () => {
        primary = typeof primaryRequest.result === 'string' ? primaryRequest.result : ''
        complete()
      }
      primaryRequest.onerror = () => reject(primaryRequest.error ?? new Error('Unable to read the saved Speakia AI API key.'))
      fallbackRequest.onsuccess = () => {
        fallbacks = Array.isArray(fallbackRequest.result)
          ? fallbackRequest.result.filter((key): key is string => typeof key === 'string')
          : []
        complete()
      }
      fallbackRequest.onerror = () => reject(fallbackRequest.error ?? new Error('Unable to read saved Speakia AI fallback API keys.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Reading browser settings was interrupted.'))
    })
    if (savedKeys.primary) return savedKeys

    const legacyKey = window.sessionStorage.getItem(API_KEY_STORAGE_KEY)?.trim() ?? ''
    if (legacyKey) {
      await writeGeminiApiKeys(legacyKey, savedKeys.fallbacks)
      window.sessionStorage.removeItem(API_KEY_STORAGE_KEY)
    }
    return { ...savedKeys, primary: legacyKey }
  } finally {
    database.close()
  }
}

export async function writeGeminiApiKey(value: string): Promise<void> {
  await writeGeminiApiKeys(value, [])
}

export async function writeGeminiApiKeys(primary: string, fallbacks: string[]): Promise<void> {
  const database = await openSettingsDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const normalized = normalizeApiKeys(primary, fallbacks)
      if (normalized.primary) store.put(normalized.primary, apiKeyRecordKey)
      else store.delete(apiKeyRecordKey)
      if (normalized.fallbacks.length) store.put(normalized.fallbacks, fallbackApiKeysRecordKey)
      else store.delete(fallbackApiKeysRecordKey)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save the Speakia AI API key.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving browser settings was interrupted.'))
    })
    window.sessionStorage.removeItem(API_KEY_STORAGE_KEY)
  } finally {
    database.close()
  }
}
