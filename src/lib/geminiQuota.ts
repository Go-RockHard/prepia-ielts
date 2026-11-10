export const GEMINI_QUOTA_NOTICE_EVENT = 'speakia:gemini-quota-notice'

export interface GeminiQuotaNoticeDetail {
  dailyLimit: boolean
  fallbackExhausted: boolean
}

const reportedErrors = new WeakSet<object>()

export function isGeminiQuotaError(error: unknown): boolean {
  return /\b429\b|RESOURCE_EXHAUSTED|QUOTA_EXCEEDED|quota exceeded|rate limit|too many requests/i.test(errorText(error))
}

function errorText(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    try {
      return `${error.name} ${error.message} ${JSON.stringify(error)}`
    } catch {
      return `${error.name} ${error.message}`
    }
  }
  try {
    return JSON.stringify(error) ?? String(error)
  } catch {
    return String(error)
  }
}

export function reportGeminiQuota(error: unknown, fallbackExhausted = false): boolean {
  const message = errorText(error)
  if (!isGeminiQuotaError(error) || typeof window === 'undefined') return false
  if (typeof error === 'object' && error !== null) {
    if (reportedErrors.has(error)) return true
    reportedErrors.add(error)
  }

  const detail: GeminiQuotaNoticeDetail = {
    dailyLimit: /per.day|requestsperday|daily limit/i.test(message),
    fallbackExhausted,
  }
  window.dispatchEvent(new CustomEvent<GeminiQuotaNoticeDetail>(GEMINI_QUOTA_NOTICE_EVENT, { detail }))
  return true
}