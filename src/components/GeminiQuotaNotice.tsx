import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { GEMINI_QUOTA_NOTICE_EVENT, type GeminiQuotaNoticeDetail } from '@/lib/geminiQuota'

export function GeminiQuotaNotice({ platform = 'speakia' }: { platform?: 'speakia' | 'writa' }) {
  const [detail, setDetail] = useState<GeminiQuotaNoticeDetail | null>(null)
  const platformName = platform === 'writa' ? 'Writia' : 'Speakia'

  useEffect(() => {
    function showNotice(event: Event) {
      setDetail((event as CustomEvent<GeminiQuotaNoticeDetail>).detail)
    }
    window.addEventListener(GEMINI_QUOTA_NOTICE_EVENT, showNotice)
    return () => window.removeEventListener(GEMINI_QUOTA_NOTICE_EVENT, showNotice)
  }, [])

  return <AnimatePresence>
    {detail && <motion.aside className="gemini-quota-notice" role="alert" aria-live="assertive" initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }}>
      <span className="gemini-quota-notice-icon"><AlertTriangle size={18} /></span>
      <div className="gemini-quota-notice-copy">
        <strong>{detail.fallbackExhausted
          ? detail.dailyLimit ? `${platformName} has exhausted its available AI retries for today` : `${platformName} could not find an available AI model`
          : `${platformName} usage limit reached for this session`}</strong>
        <p>{detail.fallbackExhausted
          ? 'Check model access and configured fallback keys in shared Settings, or wait for the service quota to reset.'
          : `${platformName} will use another configured key for requests it can retry. An active Live session may need to be restarted.`}</p>
      </div>
      <button type="button" aria-label={`Dismiss ${platformName} usage notice`} title="Dismiss" onClick={() => setDetail(null)}><X size={17} /></button>
    </motion.aside>}
  </AnimatePresence>
}