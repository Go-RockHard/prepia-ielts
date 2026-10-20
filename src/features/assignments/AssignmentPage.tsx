import { useState } from 'react'
import { ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, Eye, FileText, LoaderCircle, Mic2, Sparkles, Target, TrendingUp, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ASSISTANT_MODELS } from '@/features/assistant/models'
import { evaluateAssignmentSubmission } from './evaluation'
import type { AssignmentEvaluationModel, AssignmentPerformanceReport, CoachAssignment } from './types'

const evaluationModelKey = 'speakia-assignment-evaluation-model-v1'

function loadEvaluationModel(): AssignmentEvaluationModel {
  try {
    const stored = localStorage.getItem(evaluationModelKey)
    return ASSISTANT_MODELS.find((item) => item.id === stored)?.id ?? 'gemini-3.8-flash'
  } catch (error) {
    console.error('Unable to load the assignment evaluation model preference.', error)
    return 'gemini-3.8-flash'
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(`${value}T00:00:00`))
}

export function AssignmentPage({
  assignments,
  busy,
  error,
  onChoose,
  onComplete,
  onStart,
  apiKey,
  onOpenSettings,
  onSubmit,
}: {
  assignments: CoachAssignment[]
  busy: boolean
  error: string
  onChoose: () => Promise<unknown>
  onComplete: (assignment: CoachAssignment) => void
  onStart: (assignment: CoachAssignment) => void
  apiKey: string
  onOpenSettings: () => void
  onSubmit: (assignment: CoachAssignment, report: AssignmentPerformanceReport) => void
}) {
  const [pageError, setPageError] = useState('')
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [evaluationModel, setEvaluationModel] = useState<AssignmentEvaluationModel>(loadEvaluationModel)
  function changeEvaluationModel(value: string) {
    const model = ASSISTANT_MODELS.find((item) => item.id === value)
    if (!model) return
    setEvaluationModel(model.id)
    try {
      localStorage.setItem(evaluationModelKey, model.id)
    } catch (error) {
      console.error('Unable to save the assignment evaluation model preference.', error)
      setPageError('The selected evaluation model is active, but could not be saved on this device.')
    }
  }
  const tomorrowAssignment = assignments.find((assignment) => assignment.assignedFor === getTomorrowDate())
  const pastAssignments = assignments.filter((assignment) => assignment.id !== tomorrowAssignment?.id)
    .sort((first, second) => second.assignedFor.localeCompare(first.assignedFor))

  async function requestAssignment() {
    setPageError('')
    try {
      await onChoose()
    } catch (caughtError) {
      setPageError(caughtError instanceof Error ? caughtError.message : 'Speakia could not choose an assignment.')
    }
  }

  return (
    <div className="page-content inner-page assignments-page">
      <div className="inner-page-heading">
        <div>
          <p className="eyebrow">YOUR PERSONAL PRACTICE PLAN</p>
          <h1>Assignments</h1>
          <p className="page-subtitle">Speakia chooses focused speaking practice or a handwritten task to help you consolidate IELTS Speaking skills.</p>
        </div>
        <Button className="start-button assignment-choose-button" onClick={() => void requestAssignment()} disabled={busy}>
          <Sparkles size={16} /> {busy ? 'Choosing your activity…' : tomorrowAssignment ? 'Choose a different activity' : 'Let Speakia choose'}
        </Button>
      </div>
      <Card className="assignment-coach-note">
        <span className="assignment-coach-icon"><Sparkles size={19} /></span>
        <div><strong>Personalized by your Speakia coach</strong><p>Your recent practice, feedback, and study goal guide each assignment. Your plan is saved on this device.</p></div>
      </Card>
      {(error || pageError) && <p className="assignment-error" role="alert">{pageError || error}</p>}

      <section className="assignment-section" aria-labelledby="tomorrow-assignment-heading">
        <div className="assignment-section-heading"><div><p className="section-kicker">UP NEXT</p><h2 id="tomorrow-assignment-heading">Tomorrow’s assignment</h2></div><span className="assignment-date"><CalendarDays size={15} /> {formatDate(getTomorrowDate())}</span></div>
        {tomorrowAssignment
          ? <AssignmentCard assignment={tomorrowAssignment} onComplete={onComplete} onStart={onStart} apiKey={apiKey} onOpenSettings={onOpenSettings} model={evaluationModel} onModelChange={changeEvaluationModel} onSubmit={onSubmit} />
          : <Card className="assignment-empty"><span className="assignment-empty-icon"><Target size={22} /></span><h3>Your next practice is ready when you are</h3><p>Ask Speakia to review your progress and choose one activity that fits your IELTS speaking goals.</p><Button className="start-button" onClick={() => void requestAssignment()} disabled={busy}><Sparkles size={15} /> {busy ? 'Choosing your activity…' : 'Choose tomorrow’s activity'}</Button></Card>}
      </section>

      <section className="assignment-section" aria-labelledby="assignment-history-heading">
        <div className="assignment-section-heading"><div><p className="section-kicker">YOUR PLAN</p><h2 id="assignment-history-heading">Previous assignments</h2></div><span className="assignment-count">{pastAssignments.length} {pastAssignments.length === 1 ? 'activity' : 'activities'}</span></div>
        {pastAssignments.length
          ? <div className="assignment-history-list">{pastAssignments.map((assignment) => <div className="assignment-history-item" key={assignment.id}>
            <Card className="assignment-history-card">
              <span className={`assignment-history-status ${assignment.status}`}><CheckCircle2 size={16} /></span>
              <div className="assignment-history-copy"><strong>{assignment.title}</strong><p>{formatDate(assignment.assignedFor)} <span>·</span> {assignment.status === 'completed' ? 'Completed' : 'Awaiting completion'} <span>·</span> {assignment.durationMinutes} min</p></div>
              <Badge className="assignment-part-badge">{assignment.mode === 'handwritten' ? 'Handwritten' : assignment.part.replace('part', 'Part ')}</Badge>
              {assignment.report && <Badge className="assignment-report-badge"><FileText size={12} /> Report ready</Badge>}
              <Button type="button" variant="outline" className="assignment-history-view" aria-expanded={expandedHistoryId === assignment.id} onClick={() => setExpandedHistoryId((current) => current === assignment.id ? null : assignment.id)}><Eye size={14} />{expandedHistoryId === assignment.id ? 'Hide details' : 'View details'}</Button>
            </Card>
            {expandedHistoryId === assignment.id && <Card className="assignment-history-details"><AssignmentDetails assignment={assignment} apiKey={apiKey} onOpenSettings={onOpenSettings} model={evaluationModel} onModelChange={changeEvaluationModel} onSubmit={onSubmit} /></Card>}
          </div>)}</div>
          : <Card className="assignment-history-empty">Your completed and past assignments will appear here.</Card>}
      </section>
    </div>
  )
}

function AssignmentCard({
  assignment,
  onComplete,
  onStart,
  apiKey,
  onOpenSettings,
  model,
  onModelChange,
  onSubmit,
}: {
  assignment: CoachAssignment
  onComplete: (assignment: CoachAssignment) => void
  onStart: (assignment: CoachAssignment) => void
  apiKey: string
  onOpenSettings: () => void
  model: AssignmentEvaluationModel
  onModelChange: (model: string) => void
  onSubmit: (assignment: CoachAssignment, report: AssignmentPerformanceReport) => void
}) {
  return (
    <Card className={`assignment-card ${assignment.status === 'completed' ? 'assignment-card-completed' : ''}`}>
      <div className="assignment-card-top"><Badge className="assignment-part-badge">{assignment.part.replace('part', 'Part ')}</Badge><span className="assignment-duration"><Clock3 size={14} /> {assignment.durationMinutes} min</span>{assignment.status === 'completed' && <span className="assignment-completed-label"><CheckCircle2 size={15} /> Completed</span>}</div>
      <p className="section-kicker assignment-focus-label">{assignment.mode === 'handwritten' ? 'HANDWRITTEN IELTS SPEAKING · ' : 'SPEAKING PRACTICE · '}{assignment.topic.toLocaleUpperCase()}</p>
      <h3>{assignment.title}</h3>
      <p className="assignment-activity">{assignment.detailedStatement || assignment.activity}</p>
      {assignment.mode === 'handwritten' && <p className="assignment-written-note">Complete this task by hand in a notebook. Speakia cannot assess handwriting; use the self-check steps below to review your work.</p>}
      <div className="assignment-focus"><Target size={16} /><span><strong>Focus:</strong> {assignment.focus}</span></div>
      <div className="assignment-reason"><Sparkles size={15} /><p>{assignment.rationale}</p></div>
      <ol className="assignment-instructions">{assignment.instructions.map((instruction, index) => <li key={`${index}-${instruction}`}><span>{index + 1}</span>{instruction}</li>)}</ol>
      <div className="assignment-actions">
        {assignment.mode !== 'handwritten' && <Button className="start-button" onClick={() => onStart(assignment)}><Mic2 size={15} /> Start this practice <ArrowRight size={15} /></Button>}
        {assignment.status !== 'completed' && <Button variant="outline" className="assignment-complete-button" onClick={() => onComplete(assignment)}><Check size={15} /> Mark complete</Button>}
      </div>
      <AssignmentSubmission assignment={assignment} apiKey={apiKey} onOpenSettings={onOpenSettings} model={model} onModelChange={onModelChange} onSubmit={onSubmit} />
      {assignment.report && <AssignmentReport report={assignment.report} />}
    </Card>
  )
}

function AssignmentDetails({
  assignment,
  apiKey,
  onOpenSettings,
  model,
  onModelChange,
  onSubmit,
}: {
  assignment: CoachAssignment
  apiKey: string
  onOpenSettings: () => void
  model: AssignmentEvaluationModel
  onModelChange: (model: string) => void
  onSubmit: (assignment: CoachAssignment, report: AssignmentPerformanceReport) => void
}) {
  return <div className="assignment-details-content">
    <div className="assignment-details-heading"><p className="section-kicker">ASSIGNMENT BRIEF</p><h3>{assignment.title}</h3><p>{assignment.detailedStatement || assignment.activity}</p></div>
    <div className="assignment-details-focus"><strong>Learning focus</strong><p>{assignment.focus}</p></div>
    <div className="assignment-details-focus"><strong>Why this was chosen</strong><p>{assignment.rationale}</p></div>
    <div className="assignment-details-steps"><strong>Practice steps</strong><ol className="assignment-instructions">{assignment.instructions.map((instruction, index) => <li key={`${index}-${instruction}`}><span>{index + 1}</span>{instruction}</li>)}</ol></div>
    {assignment.mode === 'handwritten' && <p className="assignment-written-note">Write by hand in a notebook, then use the instructions to self-check your work.</p>}
    <AssignmentSubmission assignment={assignment} apiKey={apiKey} onOpenSettings={onOpenSettings} model={model} onModelChange={onModelChange} onSubmit={onSubmit} />
    {assignment.report && <AssignmentReport report={assignment.report} />}
  </div>
}

function AssignmentSubmission({
  assignment,
  apiKey,
  onOpenSettings,
  model,
  onModelChange,
  onSubmit,
}: {
  assignment: CoachAssignment
  apiKey: string
  onOpenSettings: () => void
  model: AssignmentEvaluationModel
  onModelChange: (model: string) => void
  onSubmit: (assignment: CoachAssignment, report: AssignmentPerformanceReport) => void
}) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]')
    setBusy(true)
    setError('')
    try {
      const report = await evaluateAssignmentSubmission(apiKey, model, assignment, { text, file })
      onSubmit(assignment, report)
      setText('')
      setFile(null)
      if (input) input.value = ''
    } catch (caughtError) {
      console.error('Unable to evaluate the assignment submission.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to assess this assignment submission.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="assignment-submission" aria-labelledby={`assignment-submit-${assignment.id}`}>
    <div className="assignment-submission-heading">
      <div><span className="section-kicker">{assignment.report ? 'SUBMIT ANOTHER ATTEMPT' : 'YOUR WORKSPACE'}</span><h4 id={`assignment-submit-${assignment.id}`}>{assignment.mode === 'handwritten' ? 'Submit your written work' : 'Submit your speaking practice'}</h4><p>{assignment.mode === 'handwritten' ? 'Upload a clear photo or PDF of your handwritten work, or paste your response.' : 'Upload your recording for multimodal speaking feedback, or paste a transcript for language-focused feedback.'}</p></div>
      <label className="assignment-model-picker">ASSESSMENT MODEL<select value={model} onChange={(event) => onModelChange(event.target.value)} disabled={busy}>{ASSISTANT_MODELS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    </div>
    <form className="assignment-submission-form" onSubmit={(event) => void submit(event)}>
      <label className="assignment-file-picker"><Upload size={17} /><span>{file ? file.name : assignment.mode === 'handwritten' ? 'Choose a photo or PDF' : 'Choose an audio recording'}</span><small>{assignment.mode === 'handwritten' ? 'JPG, PNG, WebP, HEIC or PDF · up to 50 MB' : 'MP3, WAV, M4A, OGG, AAC, FLAC or WebM · up to 50 MB'}</small><input type="file" accept={assignment.mode === 'handwritten' ? 'image/*,.pdf' : 'audio/*'} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError('') }} /></label>
      <label className="assignment-text-entry">{assignment.mode === 'handwritten' ? 'Written response or transcription (optional with an attachment)' : 'Transcript or notes (optional with audio)'}<textarea value={text} onChange={(event) => { setText(event.target.value); setError('') }} maxLength={12000} rows={3} placeholder={assignment.mode === 'handwritten' ? 'Paste your written response here…' : 'Add a transcript or notes to help ground the review…'} /></label>
      {assignment.mode === 'speaking' && <p className="assignment-submission-note">Text-only submissions can be reviewed for language and task content, but not pronunciation, fluency, or delivery.</p>}
      {!apiKey.trim() && <div className="assignment-key-prompt"><span>Add your Gemini API key to request an assessment.</span><Button type="button" variant="outline" size="sm" onClick={onOpenSettings}>Open Settings</Button></div>}
      {error && <p className="assignment-submission-error" role="alert">{error}</p>}
      <div className="assignment-submit-actions"><span>Gemini-generated practice feedback · not an official IELTS score</span><Button className="start-button" type="submit" disabled={busy || !apiKey.trim() || (!file && !text.trim())}>{busy ? <><LoaderCircle size={15} className="assistant-spin" /> Assessing…</> : <><Upload size={15} /> Submit for assessment</>}</Button></div>
    </form>
  </section>
}

function AssignmentReport({ report }: { report: AssignmentPerformanceReport }) {
  return <section className="assignment-performance-report" aria-label="Assignment performance report">
    <div className="assignment-report-heading"><div><span className="section-kicker">AI PERFORMANCE REPORT</span><h4>Submission review</h4><p>{report.submissionName} · {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.evaluatedAt))} · {ASSISTANT_MODELS.find((item) => item.id === report.model)?.label ?? report.model}</p></div><Badge><CheckCircle2 size={12} /> Evaluated</Badge></div>
    <p className="assignment-report-summary">{report.summary}</p>
    <div className="assignment-report-grid">
      <div className="assignment-report-panel"><h5><CheckCircle2 size={14} /> Strengths</h5><ul>{report.strengths.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div>
      <div className="assignment-report-panel"><h5><Target size={14} /> Areas to improve</h5><ul>{report.weaknesses.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div>
    </div>
    <div className="assignment-metrics">{report.metrics.map((metric) => <div className="assignment-metric" key={metric.name}><div><strong>{metric.name}</strong><span>{metric.score}/100</span></div><div className="assignment-metric-track"><span style={{ width: `${metric.score}%` }} /></div><p>{metric.evidence}</p></div>)}</div>
    <div className="assignment-report-plan"><h5><TrendingUp size={14} /> Improvement plan</h5><ol>{report.improvementPlan.map((step, index) => <li key={`${index}-${step}`}><span>{index + 1}</span>{step}</li>)}</ol></div>
    {report.transcript && <details className="assignment-report-transcript"><summary>View generated transcript</summary><p>{report.transcript}</p></details>}
    <p className="assignment-report-disclaimer">AI-generated learning feedback, not an official IELTS score. Metrics are task-specific practice indicators.</p>
  </section>
}

function getTomorrowDate(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, '0'),
    String(tomorrow.getDate()).padStart(2, '0'),
  ].join('-')
}
