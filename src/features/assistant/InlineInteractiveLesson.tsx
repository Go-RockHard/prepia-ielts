import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, CheckCircle2, Expand, Lightbulb, Minimize2, Sparkles } from 'lucide-react'
import type { InteractiveLesson } from './interactiveLesson'
import type { EmbeddedLearningModule } from './learningModules'

type LearningModule = InteractiveLesson | EmbeddedLearningModule

export function InlineInteractiveLesson({
  lesson,
  onProgress,
  onAdapt,
}: {
  lesson: LearningModule
  onProgress: (lessonId: string, interaction: string) => void
  onAdapt: (lesson: LearningModule) => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState('')
  const kind = 'kind' in lesson ? lesson.kind : 'lesson'
  const label = kind === 'lesson' ? 'interactive IELTS lesson' : kind === 'slides' ? 'interactive slide deck' : 'interactive flashcards'
  const completed = lesson.interactions.includes(kind === 'lesson' ? 'Lesson completed' : `Completed ${kind}`)

  useEffect(() => {
    function syncFullscreen() {
      setIsFullscreen(document.fullscreenElement === containerRef.current)
    }
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  async function toggleFullscreen() {
    setFullscreenError('')
    try {
      if (document.fullscreenElement === containerRef.current) {
        await document.exitFullscreen()
      } else if (containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen()
      } else {
        throw new Error('Fullscreen is not supported in this browser.')
      }
    } catch (error) {
      console.error('Unable to open the Speakia learning module in fullscreen.', error)
      setFullscreenError(error instanceof Error ? error.message : 'Fullscreen could not be opened.')
    }
  }

  useEffect(() => {
    function receiveLessonEvent(event: MessageEvent<unknown>) {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (typeof event.data !== 'object' || event.data === null || Array.isArray(event.data)) return
      const data = event.data as Record<string, unknown>
      if (data.type !== 'speakia:interactive-lesson' || data.lessonId !== lesson.id) return
      const eventKind = data.kind
      const detail = typeof data.detail === 'string' ? data.detail.slice(0, 1600) : ''
      if (!detail || (eventKind !== 'complete' && eventKind !== 'hint' && eventKind !== 'interaction' && eventKind !== 'exercise')) return
      const interaction = eventKind === 'complete'
        ? kind === 'slides' || kind === 'flashcards' ? `Completed ${kind}` : 'Lesson completed'
        : eventKind === 'hint'
          ? `Requested a hint: ${detail}`
          : eventKind === 'exercise'
            ? `Exercise response: ${detail}`
            : `Used lesson activity: ${detail}`
      onProgress(lesson.id, interaction)
    }
    window.addEventListener('message', receiveLessonEvent)
    return () => window.removeEventListener('message', receiveLessonEvent)
  }, [kind, lesson.id, onProgress])

  useEffect(() => {
    function receiveNavigation(event: Event) {
      const data = (event as CustomEvent<{ lessonId?: string; direction?: string }>).detail
      if (data?.lessonId !== lesson.id || (data.direction !== 'next' && data.direction !== 'previous')) return
      iframeRef.current?.contentWindow?.postMessage({
        type: 'speakia:module-navigation',
        lessonId: lesson.id,
        direction: data.direction,
      }, '*')
    }
    window.addEventListener('speakia:learning-module-navigation', receiveNavigation)
    return () => window.removeEventListener('speakia:learning-module-navigation', receiveNavigation)
  }, [lesson.id])

  return (
    <section ref={containerRef} className="inline-lesson-card" aria-label={`${label}: ${lesson.title}`}>
      <header className="inline-lesson-header">
        <span className="inline-lesson-icon"><Sparkles size={15} /></span>
        <div><strong>{lesson.title}</strong><span>{lesson.topic} · {label}</span></div>
        <button className="inline-lesson-fullscreen" aria-label={isFullscreen ? 'Exit module fullscreen' : 'View module fullscreen'} title={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'} onClick={() => void toggleFullscreen()}>
          {isFullscreen ? <Minimize2 size={15} /> : <Expand size={15} />}
        </button>
      </header>
      <iframe
        ref={iframeRef}
        title={lesson.title}
        srcDoc={lesson.html}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="inline-lesson-frame"
      />
      <footer className="inline-lesson-footer">
        <span className={completed ? 'inline-lesson-complete' : ''}>
          {completed ? <CheckCircle2 size={14} /> : <Lightbulb size={14} />}
          {completed ? `${kind === 'lesson' ? 'Lesson' : kind === 'slides' ? 'Slide deck' : 'Flashcards'} completed` : `${lesson.interactions.length} activities explored`}
        </span>
        {fullscreenError && <span role="alert">{fullscreenError}</span>}
        <button onClick={() => onAdapt(lesson)}><ArrowUpRight size={13} /> Ask coach to adapt</button>
      </footer>
    </section>
  )
}
