import { useState } from 'react'
import { ArrowRight, CalendarCheck, CheckCircle2, Clock3, FileText, LoaderCircle, Sparkles, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type WritingAssignmentFeedback = {
  score: number
  summary: string
  strengths: string[]
  priorities: string[]
  nextRevision: string
}

export type WritingAssignment = {
  id: string
  assignedFor: string
  createdAt: string
  status: 'assigned' | 'completed'
  title: string
  taskType: 'task1' | 'task2'
  prompt: string
  focus: string
  rationale: string
  instructions: string[]
  durationMinutes: number
  minimumWords: number
  response: string
  feedback?: WritingAssignmentFeedback
}

function localDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatAssignmentDate(value: string): string {
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(localDate(value))
}

export function WritaAssignments({
  assignments,
  busy,
  submittingId,
  error,
  onCreate,
  onResponseChange,
  onSubmit,
}: {
  assignments: WritingAssignment[]
  busy: boolean
  submittingId: string | null
  error: string
  onCreate: () => void
  onResponseChange: (id: string, response: string) => void
  onSubmit: (assignment: WritingAssignment) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const current = assignments.find((assignment) => assignment.status === 'assigned')
    ?? assignments.find((assignment) => assignment.id === expandedId)
    ?? assignments[0]
  const history = assignments.filter((assignment) => assignment.id !== current?.id)
  const wordCounts = new Map(assignments.map((assignment) => [assignment.id, assignment.response.trim() ? assignment.response.trim().split(/\s+/).length : 0]))

  return (
    <section className="writa-module-view writa-assignments" aria-labelledby="writa-assignments-heading">
      <div className="writa-section-title">
        <div><p className="writa-kicker">PERSONALIZED PRACTICE PLAN</p><h2 id="writa-assignments-heading">Assignments that move your writing forward.</h2><p>Short, focused writing tasks shaped by your recent practice. Submit your response here for criterion-based feedback.</p></div>
        <Button className="writa-primary-button" onClick={onCreate} disabled={busy}><Sparkles size={16} />{busy ? 'Preparing your task…' : current?.status === 'assigned' ? 'Choose another task' : 'Get my next assignment'}</Button>
      </div>
      <div className="writa-assignment-note"><Sparkles size={17} /><p><strong>Built around your next step.</strong> Writia uses your latest writing feedback to target a skill, vary the task type, and keep each assignment achievable. AI feedback is for practice—not an official IELTS score.</p></div>
      {error && <p className="writa-alert" role="alert">{error}</p>}

      <div className="writa-assignment-today">
        <div className="writa-assignment-date"><span className="writa-kicker">UP NEXT</span><span><CalendarCheck size={15} />{current ? formatAssignmentDate(current.assignedFor) : 'Your next practice'}</span></div>
        {current ? <article className={`writa-assignment-card ${current.status === 'completed' ? 'writa-assignment-completed' : ''}`}>
          <div className="writa-assignment-card-top">
            <span className="writa-assignment-type">{current.taskType === 'task1' ? 'IELTS WRITING TASK 1' : 'IELTS WRITING TASK 2'}</span>
            <span className="writa-assignment-duration"><Clock3 size={14} />{current.durationMinutes} min</span>
            {current.status === 'completed' && <span className="writa-assignment-done"><CheckCircle2 size={15} /> Submitted</span>}
          </div>
          <h3>{current.title}</h3>
          <div className="writa-assignment-focus"><Target size={15} /><span><strong>Skill focus:</strong> {current.focus}</span></div>
          <p className="writa-assignment-rationale">{current.rationale}</p>
          <div className="writa-assignment-prompt"><span className="writa-kicker">YOUR TASK</span><p>{current.prompt}</p></div>
          <ol className="writa-assignment-steps">{current.instructions.map((instruction, index) => <li key={`${current.id}-${index}`}><span>{index + 1}</span>{instruction}</li>)}</ol>
          {current.status === 'assigned' && <div className="writa-assignment-submit">
            <label htmlFor={`writa-assignment-response-${current.id}`}>Write your response</label>
            <textarea id={`writa-assignment-response-${current.id}`} value={current.response} onChange={(event) => onResponseChange(current.id, event.target.value)} maxLength={12000} placeholder="Write your response here. You can leave and return later; your work is saved on this device." />
            <div className="writa-assignment-submit-footer"><span>{wordCounts.get(current.id)} words · target {current.minimumWords}+ words</span><Button className="writa-primary-button" onClick={() => onSubmit(current)} disabled={submittingId === current.id || (wordCounts.get(current.id) ?? 0) < 20}>{submittingId === current.id ? <><LoaderCircle className="writa-spin" size={15} /> Reviewing…</> : <><FileText size={15} /> Submit for feedback <ArrowRight size={14} /></>}</Button></div>
            {(wordCounts.get(current.id) ?? 0) < 20 && <small className="writa-assignment-hint">Write at least 20 words before submitting for review.</small>}
          </div>}
          {current.feedback && <div className="writa-assignment-feedback">
            <div className="writa-assignment-feedback-heading"><span className="writa-kicker">PRACTICE REVIEW</span><strong>{current.feedback.score}/9</strong></div>
            <p>{current.feedback.summary}</p>
            <div className="writa-assignment-feedback-grid">
              <div><strong>What’s working</strong><ul>{current.feedback.strengths.map((item, index) => <li key={`strength-${index}`}>{item}</li>)}</ul></div>
              <div><strong>Improve next</strong><ul>{current.feedback.priorities.map((item, index) => <li key={`priority-${index}`}>{item}</li>)}</ul></div>
            </div>
            <p className="writa-assignment-revision"><strong>Revision challenge:</strong> {current.feedback.nextRevision}</p>
          </div>}
        </article> : <div className="writa-assignment-empty"><span><CalendarCheck size={19} /></span><div><h3>Your next writing session is ready when you are</h3><p>Ask Writia for a short task based on your recent feedback, then complete and review it in one place.</p></div><Button className="writa-primary-button" onClick={onCreate} disabled={busy}><Sparkles size={15} />{busy ? 'Preparing…' : 'Create my first assignment'}</Button></div>}
      </div>

      {history.length > 0 && <section className="writa-assignment-history" aria-labelledby="writa-assignment-history-heading">
        <div className="writa-assignment-history-heading"><div><p className="writa-kicker">YOUR PRACTICE PLAN</p><h3 id="writa-assignment-history-heading">Previous assignments</h3></div><span>{history.length} saved</span></div>
        {history.map((assignment) => <article className="writa-assignment-history-item" key={assignment.id}>
          <div className="writa-assignment-history-icon">{assignment.status === 'completed' ? <CheckCircle2 size={17} /> : <CalendarCheck size={17} />}</div>
          <div className="writa-assignment-history-copy"><strong>{assignment.title}</strong><span>{formatAssignmentDate(assignment.assignedFor)} · {assignment.taskType === 'task1' ? 'Task 1' : 'Task 2'} · {assignment.status === 'completed' ? 'Reviewed' : 'In progress'}</span></div>
          {assignment.feedback && <b>{assignment.feedback.score.toFixed(1)}</b>}
          <button type="button" onClick={() => setExpandedId(expandedId === assignment.id ? null : assignment.id)} aria-expanded={expandedId === assignment.id}>{expandedId === assignment.id ? 'Hide' : 'Review'}</button>
          {expandedId === assignment.id && <div className="writa-assignment-history-detail"><p>{assignment.prompt}</p>{assignment.response && <blockquote>{assignment.response}</blockquote>}{assignment.feedback && <p><strong>Coach review:</strong> {assignment.feedback.summary}</p>}</div>}
        </article>)}
      </section>}
    </section>
  )
}
