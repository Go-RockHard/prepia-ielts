import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, AudioLines, BookOpen, Check, Clock3, LoaderCircle, MessageCircle, Mic2, RefreshCw, Sparkles, Target } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { TranscriptAudioList } from './TranscriptAudioList'
import { SentenceFeedbackList } from './SentenceFeedbackList'
import { groupTranscriptTurns } from './transcript'
import { loadAssessmentLesson, loadConversationAudioCopy, loadTestRecording, saveAssessmentLesson } from './recordingStorage'
import { InlineInteractiveLesson } from '@/features/assistant/InlineInteractiveLesson'
import { shareAudioWithCoach } from '@/features/assistant/audioSharing'
import type { InteractiveLesson } from '@/features/assistant/interactiveLesson'
import type { CriterionResult, TestResult } from './types'
import { ASSESSMENT_MODELS, type AssessmentModel } from './gemini'

const criterionColors: Record<CriterionResult['id'], string> = {
  fluency: '#7665cf',
  lexical: '#e58c72',
  grammar: '#75a992',
  pronunciation: '#d1a653',
}

const criterionIcons = {
  fluency: AudioLines,
  lexical: BookOpen,
  grammar: Target,
  pronunciation: Mic2,
}

function subscribeToSmallViewport(onChange: () => void) {
  const query = window.matchMedia('(max-width: 560px)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function useSmallViewport() {
  return useSyncExternalStore(
    subscribeToSmallViewport,
    () => window.matchMedia('(max-width: 560px)').matches,
    () => false,
  )
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function AssessmentView({ result, results, onSelect, onPractice, apiKey, assessmentModel, onAssessmentModelChange, onReassess }: {
  result: TestResult | null
  results: TestResult[]
  onSelect: (result: TestResult) => void
  onPractice: () => void
  apiKey: string
  assessmentModel: AssessmentModel
  onAssessmentModelChange: (value: AssessmentModel) => void
  onReassess: (result: TestResult, model: AssessmentModel) => Promise<void>
}) {
  const isSmallViewport = useSmallViewport()
  const [reassessing, setReassessing] = useState(false)
  const [reassessmentError, setReassessmentError] = useState('')
  const [loadedAssessmentLesson, setLoadedAssessmentLesson] = useState<{ testId: string; version?: string; lesson: InteractiveLesson } | null>(null)
  const [assessmentLessonLoadError, setAssessmentLessonLoadError] = useState<{ testId: string; version?: string; message: string } | null>(null)
  const [assessmentLessonProgressError, setAssessmentLessonProgressError] = useState<{ testId: string; version?: string; message: string } | null>(null)

  useEffect(() => {
    let isCurrent = true
    if (!result?.assessmentLessonAvailable) {
      return
    }
    void loadAssessmentLesson(result.id)
      .then((lesson) => {
        if (!isCurrent) return
        if (!lesson) {
          setAssessmentLessonLoadError({ testId: result.id, version: result.assessmentLessonVersion, message: 'The personalized lesson is marked as saved, but is not available in this browser.' })
          return
        }
        setLoadedAssessmentLesson({ testId: result.id, version: result.assessmentLessonVersion, lesson })
      })
      .catch((error: unknown) => {
        console.error(`Unable to load the personalized lesson for assessment ${result.id}.`, error)
        if (isCurrent) setAssessmentLessonLoadError({ testId: result.id, version: result.assessmentLessonVersion, message: 'The personalized lesson could not be loaded from browser storage.' })
      })
    return () => { isCurrent = false }
  }, [result?.assessmentLessonAvailable, result?.assessmentLessonVersion, result?.id])

  const assessmentLesson = result && loadedAssessmentLesson && loadedAssessmentLesson.testId === result.id
    && loadedAssessmentLesson.version === result.assessmentLessonVersion
    ? loadedAssessmentLesson.lesson
    : null
  const assessmentLessonLoading = Boolean(result && result.assessmentLessonAvailable
    && !assessmentLesson
    && (assessmentLessonLoadError?.testId !== result.id || assessmentLessonLoadError.version !== result.assessmentLessonVersion))
  const assessmentLessonError = result && assessmentLessonLoadError?.testId === result.id
    && assessmentLessonLoadError.version === result.assessmentLessonVersion
    ? assessmentLessonLoadError.message
    : result && assessmentLessonProgressError?.testId === result.id
      && assessmentLessonProgressError.version === result.assessmentLessonVersion
      ? assessmentLessonProgressError.message
      : ''

  const updateAssessmentLessonProgress = useCallback(async (lessonId: string, interaction: string) => {
    if (!result || !assessmentLesson || assessmentLesson.id !== lessonId || assessmentLesson.interactions.includes(interaction)) return
    const updatedLesson = { ...assessmentLesson, interactions: [...assessmentLesson.interactions.slice(-19), interaction] }
    setLoadedAssessmentLesson({ testId: result.id, version: result.assessmentLessonVersion, lesson: updatedLesson })
    try {
      await saveAssessmentLesson(result.id, updatedLesson)
      setAssessmentLessonProgressError(null)
    } catch (error) {
      console.error(`Unable to save progress for assessment lesson ${lessonId}.`, error)
      setAssessmentLessonProgressError({ testId: result.id, version: result.assessmentLessonVersion, message: 'Your lesson activity is visible, but its progress could not be saved.' })
    }
  }, [assessmentLesson, result])
  if (!result) {
    return (
      <div className="page-content inner-page evaluation-empty-page">
        <div className="inner-page-heading">
          <div><p className="eyebrow">YOUR FEEDBACK, AT A GLANCE</p><h1>Assessments</h1><p className="page-subtitle">Complete a speaking practice to see your four-criteria breakdown.</p></div>
        </div>
        <Card className="evaluation-empty">
          <span className="evaluation-empty-icon"><Target size={24} /></span>
          <h2>Your first assessment starts with a conversation.</h2>
          <p>After a practice session, see a visual breakdown of Fluency &amp; Coherence, Lexical Resource, Grammatical Range &amp; Accuracy, and Pronunciation.</p>
          <Button className="start-button" onClick={onPractice}>Start a practice test <ArrowRight size={16} /></Button>
          <small>Practice estimates are learning aids, not official IELTS scores.</small>
        </Card>
      </div>
    )
  }

  const transcriptTurns = groupTranscriptTurns(result.transcript)
  const chartData = result.criteria.map((criterion) => ({
    name: criterion.id === 'fluency' ? 'Fluency & coherence'
      : criterion.id === 'lexical' ? 'Lexical resource'
        : criterion.id === 'grammar' ? 'Grammar'
          : 'Pronunciation',
    fullName: criterion.name,
    score: criterion.band,
    id: criterion.id,
    type: criterion.assessmentType,
  }))

  async function reassessRecording() {
    if (!result) return
    setReassessing(true)
    setReassessmentError('')
    try {
      await onReassess(result, assessmentModel)
    } catch (error) {
      console.error(`Unable to reassess the saved recording for test ${result.id}.`, error)
      setReassessmentError(error instanceof Error ? error.message : 'The saved recording could not be reassessed.')
    } finally {
      setReassessing(false)
    }
  }

  return (
    <div className="page-content inner-page evaluation-page">
      <div className="inner-page-heading">
        <div><p className="eyebrow">YOUR FEEDBACK, AT A GLANCE</p><h1>Assessments</h1><p className="page-subtitle">Review the feedback from each of your {results.length} completed {results.length === 1 ? 'test' : 'tests'}.</p></div>
        <Button className="start-button" onClick={onPractice}><Mic2 size={17} /> Practice again</Button>
      </div>

      <section className="evaluation-library" aria-label="Your speaking assessments">
        <div className="evaluation-library-heading"><div><p className="section-kicker">YOUR TESTS</p><h2>Choose an assessment</h2></div><span>{results.length} {results.length === 1 ? 'assessment' : 'assessments'}</span></div>
        <div className="evaluation-library-list">
          {results.map((item) => <button key={item.id} className={`evaluation-result-option ${item.id === result.id ? 'evaluation-result-selected' : ''}`} aria-pressed={item.id === result.id} onClick={() => onSelect(item)}>
            <span className="evaluation-result-copy"><strong>{item.title}</strong><small>{item.part === 'full' ? 'Full test' : item.part.replace('part', 'Part ')} · {formatDate(item.completedAt)}</small></span>
            <span className="evaluation-result-score">{item.overallBand.toFixed(1)}<small>/9</small></span>
          </button>)}
        </div>
      </section>

      <section className="evaluation-executive-summary" aria-labelledby="evaluation-summary-heading">
        <div className="evaluation-summary-mark"><Sparkles size={19} /></div>
        <div className="evaluation-summary-copy">
          <div className="evaluation-summary-title"><div><p className="section-kicker">SPEAKIA AI EXAMINER · PERFORMANCE OVERVIEW</p><h2 id="evaluation-summary-heading">Executive summary</h2></div><Badge className="gemini-assessment-badge">AI-generated</Badge></div>
          <p>{result.executiveSummary || 'An executive summary is not available for this older assessment. Reassess the saved recording to generate an updated report.'}</p>
          <small>{formatDate(result.completedAt)} <span aria-hidden="true">·</span> {result.part === 'full' ? 'Full speaking test' : result.part.replace('part', 'Part ')} <span aria-hidden="true">·</span> Practice estimate, not an official IELTS result</small>
        </div>
      </section>
      <Card className="evaluation-hero">
        <div className="evaluation-overall">
          <span className="section-kicker">PRACTICE ESTIMATE</span>
          <strong>{result.overallBand.toFixed(1)}<small> / 9</small></strong>
          <Badge>Indicative only</Badge>
          <p>Overall band returned by Gemini from the session recording.</p>
        </div>
        <div className="evaluation-bars-wrap" role="img" aria-label="Vertical bar chart of IELTS speaking scores for Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 14, bottom: 12, left: 0 }}>
              <CartesianGrid stroke="#e8e6ed" vertical={false} />
              <XAxis dataKey="name" interval={0} tick={{ fill: '#686a7b', fontSize: isSmallViewport ? 9 : 11 }} axisLine={false} tickLine={false} tickMargin={10} />
              <YAxis domain={[0, 9]} ticks={[0, 3, 6, 9]} tick={{ fill: '#77798a', fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
              <Tooltip formatter={(value) => [`${value} / 9`, 'Practice band']} labelFormatter={(_, payload) => payload[0]?.payload.fullName ?? ''} cursor={{ fill: '#7665cf', fillOpacity: 0.06 }} />
              <Bar dataKey="score" name="Practice band" radius={[7, 7, 0, 0]} maxBarSize={58} activeBar={{ stroke: '#5547a6', strokeWidth: 1.5 }} animationDuration={650} animationEasing="ease-out">
                {chartData.map((item) => <Cell key={item.id} fill={criterionColors[item.id]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="evaluation-section-heading"><div><p className="section-kicker">THE IELTS SPEAKING RUBRIC</p><h2>Criterion breakdown</h2></div><span><Clock3 size={15} /> {transcriptTurns.filter((entry) => entry.role === 'candidate').length} candidate turns assessed</span></div>
      <div className="criterion-layout">
        <div className="criterion-list">
          {result.criteria.map((criterion, index) => {
            const Icon = criterionIcons[criterion.id]
            return (
              <motion.div key={criterion.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.07 }}>
                <Card className="criterion-card">
                  <span className="criterion-icon" style={{ color: criterionColors[criterion.id], backgroundColor: `${criterionColors[criterion.id]}18` }}><Icon size={19} /></span>
                  <div className="criterion-info"><div className="criterion-title-row"><strong>{criterion.name}</strong>                  <Badge className="gemini-assessment-badge">{criterion.assessmentType}</Badge></div><p>{criterion.note}</p></div>
                  <strong className="criterion-score">{criterion.band.toFixed(1)}<small>/9</small></strong>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>

      <div className="feedback-grid">
        <Card className="feedback-card feedback-strengths"><span className="feedback-icon"><Check size={17} /></span><div><span className="section-kicker">WHAT WENT WELL</span><h3>Keep building on this</h3><ul>{result.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div></Card>
        <Card className="feedback-card feedback-next"><span className="feedback-icon"><Target size={17} /></span><div><span className="section-kicker">YOUR NEXT STEP</span><h3>One thing to try</h3><ul>{result.nextSteps.map((item) => <li key={item}>{item}</li>)}</ul></div></Card>
      </div>

      <div className="evaluation-tools-grid">
        <AssessmentAudioPlayer key={result.id} testId={result.id} title={result.title} />
        <section className="evaluation-reassess-controls" aria-label="Reassess saved audio">
          <div><strong>Want a fresh perspective?</strong><p>Re-run the saved audio against all four IELTS Speaking criteria.</p></div>
          <label htmlFor="reassessment-model">Assessment model<select id="reassessment-model" className="settings-select" value={assessmentModel} onChange={(event) => {
            const model = ASSESSMENT_MODELS.find((item) => item.id === event.target.value)
            if (model) onAssessmentModelChange(model.id)
          }}>{ASSESSMENT_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label>
          <Button className="start-button" onClick={() => void reassessRecording()} disabled={reassessing || !apiKey.trim() || !(result.audioAvailable || result.audioCopyAvailable)}>{reassessing ? <LoaderCircle className="spin-icon" size={16} /> : <RefreshCw size={16} />}{reassessing ? 'Reassessing audio…' : 'Reassess audio'}</Button>
          {!(result.audioAvailable || result.audioCopyAvailable) && <small className="evaluation-reassess-note">The original recording is not available for this assessment.</small>}
          {reassessmentError && <p className="evaluation-reassess-error" role="alert">{reassessmentError}</p>}
        </section>
      </div>
      {typeof result.assessmentLessonAvailable === 'boolean' && <section className="evaluation-adaptive-lesson" aria-labelledby="evaluation-adaptive-lesson-heading">
        <div className="evaluation-section-heading"><div><p className="section-kicker">PERSONALIZED NEXT STEPS</p><h2 id="evaluation-adaptive-lesson-heading">Your adaptive practice lesson</h2></div><span>Built from this assessment</span></div>
        {assessmentLessonLoading && <p className="evaluation-adaptive-lesson-status" role="status"><LoaderCircle className="spin-icon" size={16} /> Preparing your personalized lesson…</p>}
        {assessmentLesson && <InlineInteractiveLesson
          lesson={assessmentLesson}
          onProgress={(lessonId, interaction) => { void updateAssessmentLessonProgress(lessonId, interaction) }}
          onAdapt={(lesson) => window.dispatchEvent(new CustomEvent('speakia:coach-adapt-asset', { detail: lesson }))}
        />}
        {result.assessmentLessonAvailable === false && !assessmentLessonLoading && <p className="evaluation-adaptive-lesson-status" role="status">The assessment was saved, but a personalized lesson could not be generated. Reassess the recording to try again.</p>}
        {assessmentLessonError && <p className="evaluation-reassess-error" role="status">{assessmentLessonError}</p>}
      </section>}
      <details className="transcript-review evaluation-transcript-review">
        <summary>Review the conversation transcript <span>{transcriptTurns.length} turns</span></summary>
        <div className="transcript-list"><TranscriptAudioList turns={transcriptTurns} variant="evaluation" testId={result.id} /></div>
      </details>

      <section className="evaluation-sentence-feedback" aria-labelledby="evaluation-sentence-feedback-heading">
        <div className="evaluation-section-heading"><div><p className="section-kicker">DETAILED LANGUAGE REVIEW</p><h2 id="evaluation-sentence-feedback-heading">Sentence-by-sentence feedback</h2></div><span>{result.sentenceFeedback?.length ?? 0} sentences reviewed</span></div>
        <SentenceFeedbackList items={result.sentenceFeedback ?? []} />
      </section>
      <p className="evaluation-disclaimer">Gemini assessed this practice recording using the public IELTS speaking criteria. Scores and feedback are AI-generated learning estimates, not official IELTS results or a substitute for a certified examiner. Audio is processed in your browser and sent to Google Gemini for assessment.</p>
    </div>
  )
}

function AssessmentAudioPlayer({ testId, title }: { testId: string; title: string }) {
  const [audioUrl, setAudioUrl] = useState('')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioKind, setAudioKind] = useState<'copy' | 'recording' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    let objectUrl: string | null = null

    async function loadAudio() {
      try {
        const audioCopy = await loadConversationAudioCopy(testId)
        const audio = audioCopy ?? await loadTestRecording(testId)
        if (!audio) {
          if (isCurrent) setError('No saved audio copy is available for this assessment.')
          return
        }
        objectUrl = URL.createObjectURL(audio)
        if (isCurrent) {
          setAudioUrl(objectUrl)
          setAudioBlob(audio)
          setAudioKind(audioCopy ? 'copy' : 'recording')
        }
      } catch (caughtError) {
        console.error(`Unable to load audio for assessment ${testId}.`, caughtError)
        if (isCurrent) setError('Unable to load this assessment audio from browser storage.')
      }
    }

    void loadAudio()

    return () => {
      isCurrent = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [testId])

  return (
    <Card className="evaluation-audio-card">
      <span className="history-recording-icon"><AudioLines size={19} /></span>
      <div className="evaluation-audio-copy"><span className="section-kicker">SESSION AUDIO</span><strong>{title}</strong><small>{audioKind === 'copy' ? 'Compiled examiner and candidate conversation' : audioKind === 'recording' ? 'Original session recording' : error || 'Loading saved session audio…'}</small></div>
      {audioUrl && <div className="evaluation-audio-actions"><audio controls preload="metadata" src={audioUrl} aria-label={`Audio for ${title}`} /><Button type="button" variant="outline" size="sm" disabled={!audioBlob} onClick={() => { if (audioBlob) shareAudioWithCoach(audioBlob, title) }}><MessageCircle size={14} /> Discuss with Coach</Button></div>}
      {error && <p className="history-audio-error" role="status">{error}</p>}
    </Card>
  )
}
