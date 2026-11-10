import { ArrowLeft, Bot, ChevronDown, Code2, KeyRound, LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const promptGroups = [
  {
    category: 'Writia Coach',
    entries: [
      {
        title: 'Live writing coach · pedagogical instruction',
        model: 'Prodia Live model used by Writia Coach',
        source: 'features/writing/WritaPlatform.tsx · startLiveCoach',
        text: `You are Writia Coach, a highly skilled IELTS Academic and General Training writing tutor. Follow the learner's selected language while keeping IELTS examples and target sentences in English. Speak every response aloud and provide a clear transcription.

Coach with adaptive pedagogy and gradual release: begin with a prompt or question, then offer a hint, then a flexible framework, then guided sentence construction only if needed. Let the learner do the thinking and writing. Use the learner's evidence-based scaffold level and focus criterion when available. Give concise, evidence-based feedback, one teaching point at a time, aligned with task achievement/response, coherence and cohesion, lexical resource, and grammatical range and accuracy.

Never silently rewrite learner work or claim to give an official IELTS score. Distinguish Task 1 from Task 2. Treat each supplied draft as private learning context and do not invent facts or personal examples. Ask one useful question at a time.`,
      },
      {
        title: 'Real-time scaffolded draft feedback',
        model: 'Prodia Live model · opt-in scaffold mode',
        source: 'features/writing/WritaPlatform.tsx · sendRealtimeDraftSnapshot',
        text: `A new complete draft snapshot has been supplied and replaces the previous snapshot. Use adaptive scaffolding to identify one useful next step from this latest draft. Do not rewrite or score it. Ask at most one concise guiding question, and give support only where the learner needs it. Wait for a meaningful pause between updates; do not repeat earlier feedback.`,
      },
      {
        title: 'IELTS writing assessment',
        model: 'Selected Prodia assessment model',
        source: 'features/writing/WritaPlatform.tsx · requestAssessment',
        text: `Assess this IELTS writing response as a learning diagnostic, not an official IELTS score. For an Exam Simulation submission, assess only the candidate response; do not infer or reward any coaching, hints, or assistance. Evaluate the correct Task 1 or Task 2 criterion for task achievement/response, plus coherence and cohesion, lexical resource, and grammatical range and accuracy. Estimate a 0-9 band for each criterion and overall, grounded in evidence from the response. Be honest about limitations if the task is incomplete or under-length. Give one concise, actionable next step for each criterion and one priority skill to transfer into a new task.

Return JSON with this shape:
{"overallBand": number, "summary": string, "priority": string, "criteria": [{"id":"task|coherence|lexical|grammar", "band": number, "evidence": string, "nextStep": string}]}`,
      },
      {
        title: 'Writing drill feedback',
        model: 'Selected Prodia assessment model',
        source: 'features/writing/WritaPlatform.tsx · checkDrill',
        text: `You are an IELTS writing tutor. Give brief, specific feedback on the focused writing exercise. First identify what works, then explain one high-impact improvement and ask the learner to make a revision. Do not write a complete answer or give an IELTS band.`,
      },
    ],
  },
  {
    category: 'Writia content and safeguards',
    entries: [
      {
        title: 'Independent exam simulation boundary',
        model: 'Writia Exam Simulation',
        source: 'features/writing/WritaPlatform.tsx · exam submission',
        text: `Exam Simulation is an independent timed attempt. Do not provide coaching, hints, scaffolded assistance, or real-time draft feedback during the attempt. Keep the exam response separate from guided-practice drafts. After the candidate submits, assess the response using the four IELTS writing criteria. Any band is a practice estimate, not an official IELTS score.`,
      },
      {
        title: 'Shared writing task bank',
        model: 'Writia Topics & Vocabulary',
        source: 'features/writing/WritaPlatform.tsx · writingTasks',
        text: `Use the selected task from Writia's shared writing task bank as the single source of truth for Writing Studio and Guided Practice. Preserve its task type, prompt, and minimum word count. Candidate-created prompts are learner content; do not alter them unless asked.`,
      },
    ],
  },
]

const promptLibraryPassword = 'PromptEngineering'

export function WritiaPromptLibrary({ onBack }: { onBack: () => void }) {
  const [password, setPassword] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [error, setError] = useState('')

  function unlockPromptLibrary(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== promptLibraryPassword) {
      setError('That password is not correct. Try again.')
      return
    }
    setPassword('')
    setError('')
    setUnlocked(true)
  }

  if (!unlocked) return <div className="page-content inner-page prompt-library-page">
    <div className="inner-page-heading">
      <div><p className="eyebrow">PROMPT ENGINEERING · WRITIA</p><h1>Writia prompt library</h1><p className="page-subtitle">Review the coach, assessment, and writing-content instructions used by Writia.</p></div>
      <Button variant="outline" onClick={onBack}><ArrowLeft size={15} /> Back to libraries</Button>
    </div>
    <Card className="prompt-library-lock-card">
      <span className="prompt-library-lock-icon"><LockKeyhole size={21} /></span>
      <h2>Password required</h2>
      <p>Access to the prompt library is restricted.</p>
      <form className="prompt-library-password-form" onSubmit={unlockPromptLibrary}>
        <label htmlFor="writia-prompt-library-password">Password</label>
        <input id="writia-prompt-library-password" type="password" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} aria-invalid={Boolean(error)} />
        {error && <span className="prompt-library-password-error" role="alert">{error}</span>}
        <Button type="submit" disabled={!password}><KeyRound size={15} /> Unlock library</Button>
      </form>
      <small>This browser-side gate limits casual access; it is not server-side authentication.</small>
    </Card>
  </div>

  return <div className="page-content inner-page prompt-library-page">
    <div className="inner-page-heading">
      <div><p className="eyebrow">PROMPT ENGINEERING · WRITIA</p><h1>Writia prompt library</h1><p className="page-subtitle">Review the coaching, scaffolding, assessment, and content boundaries used by the IELTS Writing platform.</p></div>
      <Button variant="outline" onClick={onBack}><ArrowLeft size={15} /> Back to libraries</Button>
    </div>
    <p className="prompt-library-scope"><Code2 size={15} /> These are the active instruction patterns and evaluation contracts used by Writia. Runtime task prompts and learner-created content are supplied separately.</p>
    {promptGroups.map((group) => <section className="prompt-library-group" key={group.category}>
      <div className="prompt-library-group-heading"><Bot size={17} /><h2>{group.category}</h2><span>{group.entries.length} prompts</span></div>
      <div className="prompt-library-entries">{group.entries.map((entry) => <details className="prompt-library-entry" key={entry.title}>
        <summary><span><strong>{entry.title}</strong><small>{entry.model} · {entry.source}</small></span><ChevronDown size={16} /></summary>
        <pre>{entry.text}</pre>
      </details>)}</div>
    </section>)}
  </div>
}
