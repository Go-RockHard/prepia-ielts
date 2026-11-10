import { useEffect, useRef, useState } from 'react'
import { AudioLines, Check, CircleHelp, LoaderCircle, Mic, MicOff, PenLine, RotateCcw, Sparkles, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GoogleGenAI } from '@/lib/geminiClient'
import { prepareAudioForAssessment, assessSpeakingAudio, ASSESSMENT_MODELS, type AssessmentModel } from '@/features/simulator/gemini'
import type { PlacementAssessment, PlacementCriterion, PlacementSkill } from './types'

const placementPrompts = {
  writing: [
    { id: 'public-transport', text: 'Some people think that governments should spend more money on public transport rather than building new roads. To what extent do you agree or disagree? Give reasons for your answer and include relevant examples.' },
    { id: 'technology-education', text: 'Some people believe that technology has made education more effective, while others think it has created new problems for learners. Discuss both views and give your own opinion.' },
    { id: 'work-life-balance', text: 'Many people find it difficult to balance work with other parts of their lives. What problems can this cause, and what measures could employers and individuals take to improve the situation?' },
    { id: 'cities-and-green-space', text: 'In many cities, public spaces such as parks are being replaced by housing or commercial buildings. Is this a positive or negative development? Give reasons and examples.' },
    { id: 'children-and-responsibility', text: 'Some people think children should be taught how to manage money at school. To what extent do you agree or disagree? Support your answer with reasons and examples.' },
    { id: 'career-changes', text: 'People today are more likely to change careers several times during their working lives. What are the reasons for this, and is it a positive or negative development?' },
  ],
  speaking: [
    { id: 'daily-life-change', text: 'Describe a change that has improved your daily life. Explain what changed, how it affected you, and why you think the change was important. Then consider whether similar changes benefit everyone.' },
    { id: 'useful-skill', text: 'Describe a skill you learned that has been useful to you. Explain what the skill is, how you learned it, and when you use it. Then discuss why some skills are easier to learn than others.' },
    { id: 'memorable-place', text: 'Describe a place you visited that you would like to return to. Say where it is, when you went, what you did there, and why you would like to go back. Then discuss what makes places memorable.' },
    { id: 'helpful-person', text: 'Describe someone who helped you learn or achieve something. Explain who the person is, what they did, and how their help affected you. Then discuss why people choose to help others.' },
    { id: 'meaningful-object', text: 'Describe an object that is important to you. Say what it is, how you got it, and why you value it. Then discuss why people keep objects with personal meaning.' },
    { id: 'new-experience', text: 'Describe a new activity you tried and enjoyed. Explain what the activity was, why you tried it, and how you felt about the experience. Then discuss why people benefit from trying new things.' },
  ],
} as const

type PlacementPrompt = (typeof placementPrompts)[PlacementSkill][number]
const promptDecks: Partial<Record<PlacementSkill, PlacementPrompt[]>> = {}
const lastPlacementPromptIds: Partial<Record<PlacementSkill, string>> = {}

function nextPlacementPrompt(skill: PlacementSkill): PlacementPrompt {
  let deck = promptDecks[skill]
  if (!deck?.length) {
    deck = [...placementPrompts[skill]]
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      const current = deck[index]
      deck[index] = deck[swapIndex]
      deck[swapIndex] = current
    }
    const nextIndex = deck.length - 1
    if (deck.length > 1 && deck[nextIndex].id === lastPlacementPromptIds[skill]) {
      const next = deck[nextIndex]
      deck[nextIndex] = deck[0]
      deck[0] = next
    }
  }
  const prompt = deck.pop()
  if (!prompt) throw new Error(`No placement prompts are available for ${skill}.`)
  promptDecks[skill] = deck
  lastPlacementPromptIds[skill] = prompt.id
  return prompt
}

const writingCriteria = [
  { id: 'task', label: 'Task response' },
  { id: 'coherence', label: 'Coherence and cohesion' },
  { id: 'lexical', label: 'Lexical resource' },
  { id: 'grammar', label: 'Grammatical range and accuracy' },
] as const

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function parseWritingPlacement(text: string): Omit<PlacementAssessment, 'id' | 'skill' | 'createdAt'> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    console.error('Writia placement assessment returned invalid JSON.', error)
    throw new Error('Writia could not read the placement results. Please submit again.')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Writia returned an invalid placement assessment. Please submit again.')
  }
  const record = parsed as Record<string, unknown>
  if (typeof record.overallBand !== 'number' || !Number.isFinite(record.overallBand) || record.overallBand < 0 || record.overallBand > 9
    || typeof record.summary !== 'string' || typeof record.priority !== 'string'
    || !Array.isArray(record.criteria)) {
    throw new Error('Writia could not validate the placement results. Please submit again.')
  }
  const criteria: PlacementCriterion[] = writingCriteria.flatMap((expected) => {
    const item = record.criteria.find((value) => typeof value === 'object' && value !== null && !Array.isArray(value)
      && (value as Record<string, unknown>).id === expected.id)
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return []
    const value = item as Record<string, unknown>
    if (typeof value.band !== 'number' || !Number.isFinite(value.band) || value.band < 0 || value.band > 9
      || typeof value.evidence !== 'string' || typeof value.nextStep !== 'string') return []
    return [{ ...expected, band: value.band, evidence: value.evidence, nextStep: value.nextStep }]
  })
  if (criteria.length !== writingCriteria.length) {
    throw new Error('Writia could not validate all four writing criteria. Please submit again.')
  }
  return { overallBand: record.overallBand, summary: record.summary, priority: record.priority, criteria }
}

export function PlacementAssessmentPage({
  skill,
  apiKey,
  writingModel = ASSESSMENT_MODELS[0].id,
  speakingModel = ASSESSMENT_MODELS[0].id,
  testType,
  result,
  onComplete,
}: {
  skill: PlacementSkill
  apiKey: string
  writingModel?: string
  speakingModel?: AssessmentModel
  testType: 'Academic' | 'General Training'
  result?: PlacementAssessment
  onComplete: (assessment: PlacementAssessment) => Promise<void>
}) {
  const isSpeaking = skill === 'speaking'
  const [taskPrompt] = useState(() => nextPlacementPrompt(skill))
  const [draft, setDraft] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (!recording) return
    const intervalId = window.setInterval(() => {
      if (startedAtRef.current !== null) setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 250)
    return () => window.clearInterval(intervalId)
  }, [recording])

  useEffect(() => () => {
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  async function startRecording() {
    setError('')
    setRecordedAudio(null)
    setElapsedSeconds(0)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Audio recording is not supported in this browser. Try a current version of Chrome, Edge, or Firefox.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onerror = (event) => {
        console.error('Placement recording failed.', event)
        setError('The recording stopped unexpectedly. Please try recording again.')
        setRecording(false)
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      recorder.onstop = () => {
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (audio.size) setRecordedAudio(audio)
        else setError('No audio was captured. Check microphone permissions and try again.')
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      startedAtRef.current = Date.now()
      recorder.start()
      setRecording(true)
    } catch (caughtError) {
      console.error('Unable to start the placement recording.', caughtError)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setError(caughtError instanceof Error && caughtError.name === 'NotAllowedError'
        ? 'Microphone access was blocked. Allow microphone access in your browser and try again.'
        : 'The microphone could not be started. Check that it is connected and available.')
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
    setRecording(false)
    if (startedAtRef.current !== null) setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
    startedAtRef.current = null
  }

  async function submitWriting() {
    if (!apiKey.trim()) {
      setError('Add your shared AI key in Settings before starting the placement assessment.')
      return
    }
    const wordCount = draft.trim().split(/\s+/).filter(Boolean).length
    if (wordCount < 180) {
      setError('Write at least 180 words so the placement estimate has enough evidence.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const response = await client.models.generateContent({
        model: writingModel,
        contents: `You are conducting an IELTS Writing placement assessment. This is a one-time baseline to recommend an appropriate starting point, not an achievement test, course grade, official IELTS score, or prediction of future ability. Assess only demonstrated performance in this response, using the prompt and the four IELTS Writing criteria. Use realistic whole or half bands from 0 to 9, score each criterion independently, and calculate the overall band as the arithmetic mean rounded to the nearest half band. Be conservative where evidence is limited and do not inflate scores. Give concise evidence and one practical next step for every criterion. Return JSON only with this exact shape: {"overallBand":number,"summary":string,"priority":string,"criteria":[{"id":"task","band":number,"evidence":string,"nextStep":string},{"id":"coherence","band":number,"evidence":string,"nextStep":string},{"id":"lexical","band":number,"evidence":string,"nextStep":string},{"id":"grammar","band":number,"evidence":string,"nextStep":string}]}\n\nTask type: IELTS ${testType} Writing Task 2\nTask prompt: ${taskPrompt.text}\nCandidate response:\n${draft}`,
        config: { temperature: 0.2, responseMimeType: 'application/json' },
      })
      if (!response.text?.trim()) throw new Error('Writia returned no placement results. Please try again.')
      const parsed = parseWritingPlacement(response.text)
      await onComplete({ id: crypto.randomUUID(), skill: 'writing', createdAt: Date.now(), ...parsed })
    } catch (caughtError) {
      console.error('Unable to complete Writia placement assessment.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Writia could not assess this response. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submitSpeaking() {
    if (!apiKey.trim()) {
      setError('Add your shared AI key in Settings before starting the placement assessment.')
      return
    }
    if (!recordedAudio || elapsedSeconds < 45) {
      setError('Record at least 45 seconds of speaking before preparing your placement results.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const wav = await prepareAudioForAssessment(recordedAudio)
      const assessment = await assessSpeakingAudio(apiKey, wav, [{ role: 'examiner', text: taskPrompt.text }], 'part2', elapsedSeconds, speakingModel)
      const summary = assessment.executiveSummary || 'Your speaking baseline is ready. Use the criterion feedback to choose a suitable starting point.'
      await onComplete({
        id: crypto.randomUUID(),
        skill: 'speaking',
        overallBand: assessment.overallBand,
        createdAt: Date.now(),
        summary,
        priority: assessment.nextSteps[0] || 'Practise the criterion with the clearest opportunity for growth.',
        criteria: assessment.criteria.map((criterion) => ({
          id: criterion.id,
          label: criterion.name,
          band: criterion.band,
          evidence: criterion.note,
          nextStep: criterion.note.split(/Improvement:/i)[1]?.trim() || 'Practise this criterion in a new response.',
        })),
      })
    } catch (caughtError) {
      console.error('Unable to complete Speakia placement assessment.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Speakia could not assess this recording. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit() {
    try {
      if (isSpeaking) await submitSpeaking()
      else await submitWriting()
    } catch (caughtError) {
      console.error('Unable to save the placement assessment.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'The placement result could not be saved to your learner profile.')
    }
  }

  const wordCount = draft.trim().split(/\s+/).filter(Boolean).length

  return <main className="placement-page">
    <header className="placement-hero">
      <span className="placement-hero-icon">{isSpeaking ? <AudioLines size={22} /> : <PenLine size={22} />}</span>
      <div><p className="placement-kicker">OPTIONAL · YOUR STARTING POINT</p><h1>{isSpeaking ? 'Speaking' : 'Writing'} Placement Assessment</h1>
        <p>Show what you can do right now. We’ll estimate a starting band, identify useful first priorities, and adapt {isSpeaking ? 'Speakia' : 'Writia'} practice around your current evidence.</p>
      </div>
    </header>

    <section className="placement-purpose"><CircleHelp size={18} /><div><strong>Placement is different from a diagnostic or achievement test.</strong><p>This short baseline helps choose where to begin. It is not a course exam, does not measure learning progress, and does not produce an official IELTS score. You can retake it later; your newest result becomes the current baseline.</p></div></section>

    <section className="placement-task-card">
      <div className="placement-task-heading"><div><span className="placement-kicker">ONE BASELINE TASK</span><h2>{isSpeaking ? 'Speak naturally for about 1–2 minutes' : 'Write a short Task 2 response'}</h2></div><span className="placement-task-mode">{isSpeaking ? <><Mic size={14} /> Audio assessment</> : <><PenLine size={14} /> Writing assessment</>}</span></div>
      <p className="placement-prompt">{taskPrompt.text}</p>
      {isSpeaking
        ? <div className="placement-recorder">
          <div className={`placement-recording-indicator ${recording ? 'placement-recording-on' : ''}`}><span />{recording ? 'Recording' : recordedAudio ? 'Recording ready' : 'Microphone ready'}</div>
          <strong className="placement-timer">{formatDuration(elapsedSeconds)}</strong>
          <div className="placement-recorder-actions">{recording
            ? <Button className="placement-record-button placement-stop-button" onClick={stopRecording}><MicOff size={16} /> Stop recording</Button>
            : <Button className="placement-record-button" onClick={() => void startRecording()} disabled={busy}><Mic size={16} /> {recordedAudio ? 'Record again' : 'Start recording'}</Button>}
            {recordedAudio && !recording && <Button variant="outline" onClick={() => setRecordedAudio(null)} disabled={busy}><RotateCcw size={15} /> Clear take</Button>}
          </div>
          <small>Your recording is assessed for fluency, vocabulary, grammar, and pronunciation. It is sent for assessment but not saved in your learner profile.</small>
        </div>
        : <div className="placement-writing-answer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} disabled={busy} placeholder="Write your response here. Aim for 180–220 words; no preparation or outside help is needed." aria-label="Placement writing response" /><div><span>{wordCount} words · 180 minimum</span><span>This is a one-time baseline, not a timed exam.</span></div></div>}
      {error && <p className="placement-error" role="alert">{error}</p>}
      <div className="placement-submit-row"><p>{busy ? <><LoaderCircle className="placement-spin" size={15} /> Preparing your evidence-based starting point…</> : result ? `Previous baseline: ${new Date(result.createdAt).toLocaleDateString()}. Retaking replaces it.` : 'Optional: you can skip this and begin practice at any time.'}</p><Button className="placement-submit" disabled={busy || recording || isSpeaking && !recordedAudio || !isSpeaking && wordCount < 180} onClick={() => void handleSubmit()}>{busy ? 'Assessing…' : result ? 'Update my baseline' : 'Prepare my starting point'} <Target size={15} /></Button></div>
    </section>

    {result && <section className="placement-result" aria-labelledby="placement-result-heading">
      <div className="placement-result-heading"><span className="placement-score">{result.overallBand.toFixed(1)}</span><div><span className="placement-kicker">CURRENT PLACEMENT · PRACTICE ESTIMATE</span><h2 id="placement-result-heading">Your {result.skill} starting point</h2><p>{result.summary}</p></div></div>
      <div className="placement-criteria">{result.criteria.map((criterion) => <article key={criterion.id}><div><strong>{criterion.label}</strong><span>Band {criterion.band.toFixed(1)}</span></div><p>{criterion.evidence}</p><small><Sparkles size={13} /> {criterion.nextStep}</small></article>)}</div>
      <div className="placement-priority"><Check size={16} /><p><strong>Recommended first focus:</strong> {result.priority}</p></div>
      <p className="placement-result-footnote">A baseline is an estimate based on one task. Treat it as a starting signal, not a definitive measure; later assessments across more tasks will add evidence.</p>
    </section>}
  </main>
}
