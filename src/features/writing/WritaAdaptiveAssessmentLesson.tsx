import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Expand, Lightbulb, LoaderCircle, Minimize2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { InteractiveLesson } from '@/features/assistant/interactiveLesson'
import { loadAssessmentLesson, saveAssessmentLesson } from '@/features/simulator/recordingStorage'
import { createWritingAssessmentLesson, type WritingAssessmentLessonSource } from './assessmentLesson'

type LessonStatus = 'generating' | 'ready' | 'failed' | undefined

export function WritaAdaptiveAssessmentLesson({
  assessmentId,
  assessment,
  taskPrompt,
  response,
  apiKey,
  model,
  status,
  onStatusChange,
}: {
  assessmentId: string
  assessment: WritingAssessmentLessonSource
  taskPrompt: string
  response: string
  apiKey: string
  model: string
  status: LessonStatus
  onStatusChange: (assessmentId: string, status: Exclude<LessonStatus, undefined>) => void
}) {
  const [lesson, setLesson] = useState<InteractiveLesson | null>(null)
  const [error, setError] = useState('')
  const [progressError, setProgressError] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const generationRef = useRef('')
  const statusChangeRef = useRef(onStatusChange)
  statusChangeRef.current = onStatusChange
  const storageId = `writia-assessment:${assessmentId}`

  useEffect(() => {
    let active = true
    setLesson(null)
    setError('')
    setProgressError('')
    if (status !== 'ready') return () => { active = false }
    void loadAssessmentLesson(storageId).then((savedLesson) => {
      if (!active) return
      if (!savedLesson) {
        setError('This lesson was marked as saved but is not available in this browser.')
        return
      }
      setLesson(savedLesson)
    }).catch((caughtError: unknown) => {
      console.error(`Unable to load Writia's adaptive lesson for assessment ${assessmentId}.`, caughtError)
      if (active) setError('The saved lesson could not be loaded from this browser.')
    })
    return () => { active = false }
  }, [assessmentId, status, storageId])

  async function generateLesson() {
    if (!apiKey.trim()) {
      setError('Add your shared AI key in Settings to create the adaptive writing lesson.')
      return
    }
    if (generationRef.current === assessmentId) return
    generationRef.current = assessmentId
    setError('')
    statusChangeRef.current(assessmentId, 'generating')
    try {
      const generated = await createWritingAssessmentLesson(apiKey, assessment, taskPrompt, response, model)
      await saveAssessmentLesson(storageId, generated)
      setLesson(generated)
      statusChangeRef.current(assessmentId, 'ready')
    } catch (caughtError) {
      console.error(`Unable to generate Writia's adaptive lesson for assessment ${assessmentId}.`, caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Writia could not prepare this adaptive lesson.')
      statusChangeRef.current(assessmentId, 'failed')
    } finally {
      generationRef.current = ''
    }
  }

  useEffect(() => {
    if (status === 'generating' && !lesson) void generateLesson()
  }, [status, lesson, assessmentId])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === containerRef.current) await document.exitFullscreen()
      else if (containerRef.current?.requestFullscreen) await containerRef.current.requestFullscreen()
      else throw new Error('Fullscreen is not supported in this browser.')
    } catch (caughtError) {
      console.error('Unable to open the Writia adaptive lesson in fullscreen.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Fullscreen could not be opened.')
    }
  }

  useEffect(() => {
    function syncFullscreen() {
      setIsFullscreen(document.fullscreenElement === containerRef.current)
    }
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  async function recordProgress(lessonId: string, interaction: string) {
    if (!lesson || lesson.id !== lessonId || lesson.interactions.includes(interaction)) return
    const updated = { ...lesson, interactions: [...lesson.interactions.slice(-19), interaction] }
    setLesson(updated)
    try {
      await saveAssessmentLesson(storageId, updated)
      setProgressError('')
    } catch (caughtError) {
      console.error(`Unable to save Writia lesson progress for assessment ${assessmentId}.`, caughtError)
      setProgressError('Your lesson activity is visible, but its progress could not be saved.')
    }
  }

  useEffect(() => {
    function receiveLessonEvent(event: MessageEvent<unknown>) {
      if (event.source !== iframeRef.current?.contentWindow || typeof event.data !== 'object' || event.data === null || Array.isArray(event.data)) return
      const data = event.data as Record<string, unknown>
      if (!lesson || data.type !== 'speakia:interactive-lesson' || data.lessonId !== lesson.id) return
      const detail = typeof data.detail === 'string' ? data.detail.slice(0, 1600) : ''
      if (!detail || (data.kind !== 'complete' && data.kind !== 'hint' && data.kind !== 'interaction' && data.kind !== 'exercise')) return
      const interaction = data.kind === 'complete'
        ? 'Lesson completed'
        : data.kind === 'hint'
          ? `Requested a hint: ${detail}`
          : data.kind === 'exercise'
            ? `Exercise response: ${detail}`
            : `Used lesson activity: ${detail}`
      void recordProgress(lesson.id, interaction)
    }
    window.addEventListener('message', receiveLessonEvent)
    return () => window.removeEventListener('message', receiveLessonEvent)
  }, [lesson])

  return (
    <section className="evaluation-adaptive-lesson writa-adaptive-lesson" aria-labelledby={`writa-lesson-${assessmentId}`}>
      <div className="evaluation-section-heading">
        <div><p className="writa-kicker">PERSONALIZED NEXT STEPS</p><h2 id={`writa-lesson-${assessmentId}`}>Your adaptive writing lesson</h2></div>
        <span>Built from this assessment</span>
      </div>
      {status === 'generating' && !lesson && <p className="evaluation-adaptive-lesson-status" role="status"><LoaderCircle className="writa-spin" size={16} /> Creating your evidence-based lesson…</p>}
      {status === 'failed' && !lesson && <div className="writa-assessment-lesson-retry"><p className="evaluation-adaptive-lesson-status">Your assessment is saved. The adaptive lesson could not be generated.</p><Button className="writa-primary-button" onClick={() => void generateLesson()}><Sparkles size={14} /> Try again</Button></div>}
      {!status && !lesson && <div className="writa-assessment-lesson-retry"><p>Generate a focused interactive lesson from this assessment’s strengths and next steps.</p><Button className="writa-primary-button" onClick={() => void generateLesson()}><Sparkles size={14} /> Create adaptive lesson</Button></div>}
      {error && <p className="writa-alert" role="alert">{error}</p>}
      {status === 'ready' && !lesson && error && <div className="writa-assessment-lesson-retry"><p>The saved lesson is unavailable. You can generate it again from this assessment.</p><Button className="writa-primary-button" onClick={() => void generateLesson()}><Sparkles size={14} /> Regenerate lesson</Button></div>}
      {lesson && <div className="writa-assessment-lesson-frame" ref={containerRef}>
        <header><span><Sparkles size={15} /> Interactive lesson · {lesson.interactions.length} activities</span><button type="button" aria-label={isFullscreen ? 'Exit adaptive lesson fullscreen' : 'View adaptive lesson fullscreen'} onClick={() => void toggleFullscreen()}>{isFullscreen ? <Minimize2 size={15} /> : <Expand size={15} />}</button></header>
        <iframe ref={iframeRef} title={lesson.title} srcDoc={lesson.html} sandbox="allow-scripts" referrerPolicy="no-referrer" />
        <footer>{lesson.interactions.some((interaction) => interaction === 'Lesson completed') ? <><CheckCircle2 size={14} /> Lesson complete · keep applying this skill in your next response.</> : <><Lightbulb size={14} /> Work through the activities, then apply one insight in a new writing task.</>}</footer>
      </div>}
      {progressError && <p className="writa-alert" role="status">{progressError}</p>}
    </section>
  )
}
