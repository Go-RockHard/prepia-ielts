import { useMemo, useState } from 'react'
import { Bell, Check, CheckCheck, ClipboardCheck, KeyRound, Mic2, X } from 'lucide-react'
import type { CoachAssignment } from '@/features/assignments/types'
import type { TestResult } from '@/features/simulator/types'

interface AppNotification {
  id: string
  title: string
  detail: string
  label: string
  tone: 'critical' | 'assignment' | 'reminder'
  destination: 'Settings' | 'Assignments' | 'Practice'
}

function readIds(username: string): string[] {
  try {
    const stored = localStorage.getItem(`speakia-notifications-read-v1:${username}`)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
      throw new Error('Saved notification read states are invalid.')
    }
    return parsed
  } catch (error) {
    console.error('Unable to load notification read states.', error)
    return []
  }
}

export function NotificationCenter({
  username,
  apiKeyAvailable,
  assignments,
  results,
  onNavigate,
}: {
  username: string
  apiKeyAvailable: boolean
  assignments: CoachAssignment[]
  results: TestResult[]
  onNavigate: (section: 'Settings' | 'Assignments' | 'Practice') => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState(() => readIds(username))
  const [storageError, setStorageError] = useState('')
  const [now] = useState(() => new Date())
  const notifications = useMemo(() => {
    const items: AppNotification[] = []
    if (!apiKeyAvailable) {
      items.push({
        id: 'missing-api-key',
        title: 'Connect your Gemini API key',
        detail: 'Live speaking drills, assessments, and AI coaching need a saved API key.',
        label: 'Action needed',
        tone: 'critical',
        destination: 'Settings',
      })
    }
    assignments.filter((assignment) => assignment.status === 'assigned').forEach((assignment) => {
      items.push({
        id: `assignment-${assignment.id}`,
        title: `Finish: ${assignment.title}`,
        detail: `${assignment.part.replace('part', 'Part ')} · ${assignment.durationMinutes} min · ${assignment.topic}`,
        label: assignment.assignedFor,
        tone: 'assignment',
        destination: 'Assignments',
      })
    })
    const practicedRecently = results.some((result) => now.getTime() - Date.parse(result.completedAt) < 7 * 24 * 60 * 60 * 1000)
    if (!practicedRecently) {
      const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      items.push({
        id: `practice-reminder-${dateKey}`,
        title: 'Keep your speaking momentum',
        detail: 'A short focused drill can help you practise fluency, vocabulary, grammar, or pronunciation today.',
        label: 'Daily practice',
        tone: 'reminder',
        destination: 'Practice',
      })
    }
    return items
  }, [apiKeyAvailable, assignments, now, results])
  const unreadCount = notifications.filter((item) => !readNotificationIds.includes(item.id)).length

  function persistReadIds(ids: string[]): boolean {
    try {
      localStorage.setItem(`speakia-notifications-read-v1:${username}`, JSON.stringify(ids))
      setReadNotificationIds(ids)
      setStorageError('')
      return true
    } catch (error) {
      console.error('Unable to save notification read states.', error)
      setStorageError('Read status could not be saved on this device.')
      return false
    }
  }

  function markAllRead() {
    persistReadIds([...new Set([...readNotificationIds, ...notifications.map((item) => item.id)])])
  }

  function openNotification(notification: AppNotification) {
    if (!readNotificationIds.includes(notification.id)) {
      if (!persistReadIds([...readNotificationIds, notification.id])) return
    }
    setIsOpen(false)
    onNavigate(notification.destination)
  }

  return (
    <div className="notification-center">
      <button className="icon-button notification-button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={isOpen} aria-haspopup="dialog" onClick={() => setIsOpen((open) => !open)}>
        <Bell size={18} />
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {isOpen && (
        <section className="notification-popover" role="dialog" aria-label="Notifications">
          <header className="notification-popover-header"><div><span className="section-kicker">YOUR PREPARATION PLAN</span><h2>Notifications <span>{unreadCount}</span></h2></div><button type="button" aria-label="Close notifications" onClick={() => setIsOpen(false)}><X size={17} /></button></header>
          {notifications.length > 0 && <button type="button" className="notification-mark-all" onClick={markAllRead} disabled={!unreadCount}><CheckCheck size={14} /> Mark all as read</button>}
          <div className="notification-list">
            {notifications.length
              ? notifications.map((item) => {
                const isRead = readNotificationIds.includes(item.id)
                const Icon = item.tone === 'critical' ? KeyRound : item.tone === 'assignment' ? ClipboardCheck : Mic2
                return <button type="button" key={item.id} className={`notification-item notification-${item.tone} ${isRead ? 'notification-read' : ''}`} onClick={() => openNotification(item)}>
                  <span className="notification-item-icon"><Icon size={16} /></span>
                  <span className="notification-item-copy"><span className="notification-item-label">{item.label}</span><strong>{item.title}</strong><small>{item.detail}</small></span>
                  {isRead ? <Check size={14} className="notification-read-check" /> : <i className="notification-unread-dot" />}
                </button>
              })
              : <div className="notification-empty"><CheckCheck size={19} /><strong>You’re all caught up</strong><span>Important assignments and preparation reminders will show up here.</span></div>}
          </div>
          {storageError && <p className="notification-storage-error" role="status">{storageError}</p>}
        </section>
      )}
    </div>
  )
}
