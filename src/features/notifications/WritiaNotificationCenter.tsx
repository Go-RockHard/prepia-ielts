import { useMemo, useState } from 'react'
import { Bell, Check, CheckCheck, ClipboardCheck, KeyRound, PenLine, X } from 'lucide-react'
import type { WritaModuleId } from '@/features/writing/navigation'
import type { WritiaLearnerAssessment, WritiaLearnerAssignment } from '@/features/writing/learnerContext'

type WritiaNotification = {
  id: string
  title: string
  detail: string
  label: string
  tone: 'critical' | 'assignment' | 'reminder'
  destination: WritaModuleId | 'settings'
}

function formatDueDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)
}

function readIds(username: string): string[] {
  try {
    const stored = localStorage.getItem(`writia-notifications-read-v1:${username}`)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
      throw new Error('Saved Writia notification read states are invalid.')
    }
    return parsed
  } catch (error) {
    console.error('Unable to load Writia notification read states.', error)
    return []
  }
}

export function WritiaNotificationCenter({
  username,
  apiKeyAvailable,
  assignments,
  assessments,
  placementCompleted,
  onNavigate,
  onOpenSettings,
}: {
  username: string
  apiKeyAvailable: boolean
  assignments: WritiaLearnerAssignment[]
  assessments: WritiaLearnerAssessment[]
  placementCompleted: boolean
  onNavigate: (module: WritaModuleId) => void
  onOpenSettings: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState(() => readIds(username))
  const [storageError, setStorageError] = useState('')
  const [now] = useState(() => new Date())
  const notifications = useMemo(() => {
    const items: WritiaNotification[] = []
    if (!apiKeyAvailable) {
      items.push({
        id: 'missing-api-key',
        title: 'Connect your Writia AI API key',
        detail: 'Writing assessments and AI coaching need an API key saved in shared settings.',
        label: 'Action needed',
        tone: 'critical',
        destination: 'settings',
      })
    }
    if (!placementCompleted) {
      items.push({
        id: 'writing-placement-assessment',
        title: 'Find your Writing starting point',
        detail: 'Take an optional short baseline so Writia can recommend a suitable first practice focus.',
        label: 'Optional placement',
        tone: 'reminder',
        destination: 'placement-assessment',
      })
    }
    assignments.filter((assignment) => assignment.status === 'assigned').forEach((assignment) => {
      items.push({
        id: `assignment-${assignment.id}`,
        title: `Continue: ${assignment.title}`,
        detail: `${assignment.taskType === 'task1' ? 'Task 1' : 'Task 2'}${assignment.durationMinutes ? ` · ${assignment.durationMinutes} min` : ''} · ${assignment.focus}`,
        label: `Due ${formatDueDate(assignment.assignedFor)}`,
        tone: 'assignment',
        destination: 'assignments',
      })
    })
    const latestAssessment = assessments[0]
    if (latestAssessment) {
      items.push({
        id: `assessment-${latestAssessment.id}`,
        title: `Review your writing feedback: ${latestAssessment.taskLabel}`,
        detail: latestAssessment.summary,
        label: 'New writing review',
        tone: 'reminder',
        destination: 'assessment',
      })
    }
    const practicedRecently = assessments.some((assessment) => {
      const age = now.getTime() - assessment.createdAt
      return age >= 0 && age < 7 * 24 * 60 * 60 * 1000
    })
    if (!practicedRecently) {
      const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      items.push({
        id: `writing-reminder-${dateKey}`,
        title: 'Make a little progress in Writing',
        detail: 'A short focused response can help strengthen your planning, coherence, or vocabulary.',
        label: 'Writing practice',
        tone: 'reminder',
        destination: 'studio',
      })
    }
    return items
  }, [apiKeyAvailable, assignments, assessments, now, placementCompleted])
  const unreadCount = notifications.filter((item) => !readNotificationIds.includes(item.id)).length

  function persistReadIds(ids: string[]): boolean {
    try {
      localStorage.setItem(`writia-notifications-read-v1:${username}`, JSON.stringify(ids))
      setReadNotificationIds(ids)
      setStorageError('')
      return true
    } catch (error) {
      console.error('Unable to save Writia notification read states.', error)
      setStorageError('Read status could not be saved on this device.')
      return false
    }
  }

  function markAllRead() {
    persistReadIds([...new Set([...readNotificationIds, ...notifications.map((item) => item.id)])])
  }

  function openNotification(notification: WritiaNotification) {
    if (!readNotificationIds.includes(notification.id)
      && !persistReadIds([...readNotificationIds, notification.id])) return
    setIsOpen(false)
    if (notification.destination === 'settings') onOpenSettings()
    else onNavigate(notification.destination)
  }

  return (
    <div className="notification-center">
      <button className="icon-button notification-button" aria-label={`Writia notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={isOpen} aria-haspopup="dialog" onClick={() => setIsOpen((open) => !open)}>
        <Bell size={18} />
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {isOpen && (
        <section className="notification-popover" role="dialog" aria-label="Writia notifications">
          <header className="notification-popover-header"><div><span className="section-kicker">YOUR WRITING PLAN</span><h2>Notifications <span>{unreadCount}</span></h2></div><button type="button" aria-label="Close notifications" onClick={() => setIsOpen(false)}><X size={17} /></button></header>
          {notifications.length > 0 && <button type="button" className="notification-mark-all" onClick={markAllRead} disabled={!unreadCount}><CheckCheck size={14} /> Mark all as read</button>}
          <div className="notification-list">
            {notifications.length
              ? notifications.map((item) => {
                const isRead = readNotificationIds.includes(item.id)
                const Icon = item.tone === 'critical' ? KeyRound : item.tone === 'assignment' ? ClipboardCheck : PenLine
                return <button type="button" key={item.id} className={`notification-item notification-${item.tone} ${isRead ? 'notification-read' : ''}`} onClick={() => openNotification(item)}>
                  <span className="notification-item-icon"><Icon size={16} /></span>
                  <span className="notification-item-copy"><span className="notification-item-label">{item.label}</span><strong>{item.title}</strong><small>{item.detail}</small></span>
                  {isRead ? <Check size={14} className="notification-read-check" /> : <i className="notification-unread-dot" />}
                </button>
              })
              : <div className="notification-empty"><CheckCheck size={19} /><strong>You’re all caught up</strong><span>Writing assignments and practice reminders will show up here.</span></div>}
          </div>
          {storageError && <p className="notification-storage-error" role="status">{storageError}</p>}
        </section>
      )}
    </div>
  )
}
