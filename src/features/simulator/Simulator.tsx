import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Type, type FunctionCall, type FunctionDeclaration, type FunctionResponse } from '@google/genai'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock3,
  Maximize2,
  Minimize2,
  Lightbulb,
  LoaderCircle,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  Waves,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { partLabel, promptsForPart } from './questions'
import { createExaminerInstructions, createTranscriptAudioCopy, ASSESSMENT_MODELS, assessSpeakingAudio, type AssessmentModel } from './gemini'
import { useGeminiLive } from './useGeminiLive'
import { TranscriptAudioList } from './TranscriptAudioList'
import { wordIndexAtElapsed } from './speechTiming'
import type { TestPart, TestResult, TranscriptEntry } from './types'
import type { CoachAssignment } from '@/features/assignments/types'

type Phase = 'setup' | 'preparation' | 'live' | 'ended' | 'evaluating' | 'error'

const minimumCandidateTurns: Record<TestPart, number> = {
  full: 8,
  part1: 4,
  part2: 2,
  part3: 4,
}

const minimumTestSeconds: Record<TestPart, number> = {
  full: 300,
  part1: 90,
  part2: 60,
  part3: 90,
}

const markTestCompleteTool: FunctionDeclaration = {
  name: 'mark_speaking_test_complete',
  description: 'Mark the current IELTS speaking test complete only after completing every required section and enough questions for the selected test format. Never call just because the candidate asks to stop early.',
  parameters: { type: Type.OBJECT, properties: {} },
}

const partOptions: { id: TestPart; label: string; title: string; description: string; time: string }[] = [
  { id: 'full', label: 'COMPLETE MOCK TEST', title: 'Full IELTS Speaking Test', description: 'Move naturally through the interview, cue card and discussion for a complete examiner-led rehearsal.', time: '11–14 mins' },
  { id: 'part1', label: 'PART 1 · WARMUP', title: 'Interview & Everyday Topics', description: 'Build confident, spontaneous answers about your home, work, studies and daily life.', time: '4–5 mins' },
  { id: 'part2', label: 'PART 2 · LONG TURN', title: 'Cue Card & 1-Min Prep', description: 'Use a real 60-second scratchpad, then deliver your uninterrupted long-turn response.', time: '3–4 mins' },
  { id: 'part3', label: 'PART 3 · DISCUSSION', title: 'Abstract Discussion', description: 'Develop thoughtful opinions, compare ideas and explore broader social questions.', time: '4–5 mins' },
]

const PREPARATION_SECONDS = 60

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

export function Simulator({ onComplete, apiKey, assessmentModel, onOpenSettings, initialPart, assignment, startImmediately = false, onStartRequestHandled }: { onComplete: (result: TestResult, recording: Blob, audioCopy: Blob, transcriptAudio: TranscriptEntry[]) => void; apiKey: string; assessmentModel: AssessmentModel; onOpenSettings: () => void; initialPart?: Exclude<TestPart, 'full'>; assignment?: CoachAssignment | null; startImmediately?: boolean; onStartRequestHandled?: () => void }) {
  const [selectedPart, setSelectedPart] = useState<TestPart>(initialPart ?? 'full')
  const [phase, setPhase] = useState<Phase>('setup')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [preparationSeconds, setPreparationSeconds] = useState(PREPARATION_SECONDS)
  const [isPreparationTimerRunning, setIsPreparationTimerRunning] = useState(false)
  const [preparationNotes, setPreparationNotes] = useState('')
  const [showPart2Notes, setShowPart2Notes] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [isTestComplete, setIsTestComplete] = useState(false)
  const [completionNotice, setCompletionNotice] = useState('')
  const [completedRecording, setCompletedRecording] = useState<Blob | null>(null)
  const [completedTranscript, setCompletedTranscript] = useState<TranscriptEntry[]>([])
  const [isImmersive, setIsImmersive] = useState(false)
  const [assessmentError, setAssessmentError] = useState('')
  const simulatorPageRef = useRef<HTMLDivElement>(null)
  const preparationDeadlineRef = useRef<number | null>(null)
  const startRequestHandledRef = useRef(false)
  const liveTranscriptRef = useRef<TranscriptEntry[]>([])
  const elapsedSecondsRef = useRef(0)
  const shouldReduceMotion = useReducedMotion() ?? false
  const prompts = useMemo(() => promptsForPart(selectedPart), [selectedPart])
  const cueCard = useMemo(() => prompts.find((prompt) => prompt.part === 'part2'), [prompts])
  const systemInstruction = useMemo(
    () => {
      const baseInstructions = createExaminerInstructions(selectedPart, prompts.map((prompt) => prompt.question))
      if (!assignment && selectedPart === 'part2' && cueCard) {
        return `${baseInstructions}\nFor this Part 2-only simulation, the candidate has already read the cue card and used or ended the private one-minute preparation period in the app. Do not present the card again or provide another preparation minute. Invite the candidate to begin their long turn based on the cue card displayed in the practice screen.`
      }
      if (!assignment) return baseInstructions
      return `${baseInstructions}\nThe learner is completing a personalized Speakia coach assignment titled "${assignment.title}" on the topic "${assignment.topic}". Keep the speaking practice aligned with this topic and the assigned focus: ${assignment.focus}. Activity: ${assignment.activity}.`
    },
    [assignment, selectedPart, prompts, cueCard],
  )
  const handleLiveToolCall = useCallback(async (functionCalls: FunctionCall[]): Promise<FunctionResponse[]> => (
    functionCalls.map((call) => {
      if (call.name !== markTestCompleteTool.name) {
        return { id: call.id, name: call.name, response: { error: `Unsupported examiner tool: ${call.name ?? 'unknown'}` } }
      }
      const candidateTurns = liveTranscriptRef.current.filter((turn) => turn.role === 'candidate').length
      const minimumTurns = minimumCandidateTurns[selectedPart]
      const minimumSeconds = minimumTestSeconds[selectedPart]
      if (candidateTurns < minimumTurns || elapsedSecondsRef.current < minimumSeconds) {
        const message = `The test is not complete yet: ${candidateTurns}/${minimumTurns} candidate answers and ${formatTime(elapsedSecondsRef.current)}/${formatTime(minimumSeconds)} minimum speaking time. Continue the test before ending.`
        setCompletionNotice(message)
        return { id: call.id, name: call.name, response: { error: message } }
      }
      setIsTestComplete(true)
      setCompletionNotice('')
      return { id: call.id, name: call.name, response: { status: 'success', instruction: 'The selected test format is complete. Tell the candidate they may end the session.' } }
    })
  ), [selectedPart])
  const live = useGeminiLive({
    apiKey,
    systemInstruction,
    tools: [{ functionDeclarations: [markTestCompleteTool] }],
    onToolCall: handleLiveToolCall,
    openingPrompt: assignment
      ? `Begin the assigned IELTS Speaking ${assignment.part.replace('part', 'Part ')} practice on "${assignment.topic}". Introduce yourself exactly as Speakia: "Hello, my name is Speakia, and I’ll be your IELTS Speaking examiner today." Then guide the learner through the activity: ${assignment.activity}`
      : selectedPart === 'part2' && cueCard
        ? `Begin an IELTS Speaking Part 2 long turn. Introduce yourself exactly as Speakia: "Hello, my name is Speakia, and I’ll be your IELTS Speaking examiner today." The candidate has already read the cue card on screen and used or chosen to end their preparation time. Invite them to begin speaking for up to two minutes about "${cueCard.topic}", using the displayed cue-card prompts. Do not read the cue card again or give another preparation minute. After the long turn, ask one brief related follow-up question.`
      : 'Begin the IELTS Speaking practice by introducing yourself exactly as Speakia: "Hello, my name is Speakia, and I’ll be your IELTS Speaking examiner today." Then continue with the first question for the selected test format.',
  })
  const startLiveSession = live.start
  const visibleTranscript = live.transcript.slice(-30)

  useEffect(() => {
    liveTranscriptRef.current = live.transcript
  }, [live.transcript])

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds
  }, [elapsedSeconds])

  useEffect(() => {
    function syncImmersiveMode() {
      setIsImmersive(document.fullscreenElement === simulatorPageRef.current)
    }
    document.addEventListener('fullscreenchange', syncImmersiveMode)
    return () => document.removeEventListener('fullscreenchange', syncImmersiveMode)
  }, [])

  useEffect(() => {
    if (phase !== 'live' || !live.connected) return
    const interval = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000)
    return () => window.clearInterval(interval)
  }, [phase, live.connected])

  useEffect(() => {
    if (!isPreparationTimerRunning) return
    const interval = window.setInterval(() => {
      const deadline = preparationDeadlineRef.current
      if (deadline === null) {
        setIsPreparationTimerRunning(false)
        return
      }
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setPreparationSeconds(remaining)
      if (remaining === 0) {
        preparationDeadlineRef.current = null
        setIsPreparationTimerRunning(false)
      }
    }, 200)
    return () => window.clearInterval(interval)
  }, [isPreparationTimerRunning])

  const startLivePractice = useCallback(async () => {
    preparationDeadlineRef.current = null
    setIsPreparationTimerRunning(false)
    setElapsedSeconds(0)
    setIsTestComplete(false)
    setCompletionNotice('')
    setCompletedRecording(null)
    setCompletedTranscript([])
    setIsImmersive(false)
    setPhase('live')
    const started = await startLiveSession()
    if (!started) setPhase('setup')
  }, [startLiveSession])

  const beginPractice = useCallback(async () => {
    setAssessmentError('')
    if (selectedPart === 'part2' && !assignment) {
      preparationDeadlineRef.current = null
      setPreparationSeconds(PREPARATION_SECONDS)
      setIsPreparationTimerRunning(false)
      setPreparationNotes('')
      setPhase('preparation')
      return
    }
    await startLivePractice()
  }, [assignment, selectedPart, startLivePractice])

  useEffect(() => {
    if (!startImmediately || startRequestHandledRef.current) return
    startRequestHandledRef.current = true
    void beginPractice()
      .catch((error: unknown) => {
        console.error('Unable to start the requested IELTS speaking simulation.', error)
        setAssessmentError(error instanceof Error ? error.message : 'The speaking simulation could not be started.')
        setPhase('error')
      })
      .finally(() => onStartRequestHandled?.())
  }, [beginPractice, startImmediately, onStartRequestHandled])

  function resetPart2Preparation() {
    preparationDeadlineRef.current = null
    setPreparationSeconds(PREPARATION_SECONDS)
    setIsPreparationTimerRunning(false)
  }

  function togglePart2PreparationTimer() {
    if (isPreparationTimerRunning) {
      const deadline = preparationDeadlineRef.current
      if (deadline !== null) {
        setPreparationSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
      }
      preparationDeadlineRef.current = null
      setIsPreparationTimerRunning(false)
      return
    }
    if (preparationSeconds <= 0) return
    preparationDeadlineRef.current = Date.now() + preparationSeconds * 1000
    setIsPreparationTimerRunning(true)
  }

  async function toggleImmersiveMode() {
    setAssessmentError('')
    try {
      if (document.fullscreenElement === simulatorPageRef.current) {
        await document.exitFullscreen()
        return
      }
      const simulatorPage = simulatorPageRef.current
      if (!simulatorPage?.requestFullscreen) {
        throw new Error('Immersive mode is not supported by this browser.')
      }
      await simulatorPage.requestFullscreen()
    } catch (error) {
      console.error('Unable to toggle IELTS practice immersive mode.', error)
      setAssessmentError(error instanceof Error ? error.message : 'Unable to open immersive practice mode.')
    }
  }

  async function endTest() {
    if (!isTestComplete || isEvaluating) return
    setAssessmentError('')
    try {
      const stoppedSession = await live.stop()
      if (stoppedSession.recording.size === 0) {
        setAssessmentError('No audio was recorded. Check microphone access and complete another live practice session.')
        setPhase('setup')
        return
      }
      setCompletedRecording(stoppedSession.recording)
      setCompletedTranscript(stoppedSession.transcript)
    } catch (error) {
      console.error('Unable to finish the Gemini Live recording.', error)
      setAssessmentError(error instanceof Error ? error.message : 'Could not finish the microphone recording.')
      return
    }
    if (document.fullscreenElement === simulatorPageRef.current) {
      try {
        await document.exitFullscreen()
      } catch (error) {
        console.error('Unable to exit immersive mode after ending the speaking session.', error)
        setAssessmentError('The speaking session ended, but immersive mode could not be closed automatically. Press Escape to exit fullscreen.')
      }
    }
    setPhase('ended')
  }

  async function assessTest() {
    if (phase !== 'ended' || !isTestComplete || !completedRecording || isEvaluating) return
    setIsEvaluating(true)
    setAssessmentError('')
    setPhase('evaluating')
    try {
      const audioCopy = await createTranscriptAudioCopy(completedTranscript)
      const result = await assessSpeakingAudio(
        apiKey,
        audioCopy,
        completedTranscript,
        selectedPart,
        elapsedSeconds,
        assessmentModel,
      )
      onComplete(result, completedRecording, audioCopy, completedTranscript.filter((turn) => turn.audio))
    } catch (error) {
      console.error('Gemini could not assess this IELTS speaking recording.', error)
      setAssessmentError(error instanceof Error
        ? error.message
        : 'Gemini could not assess the recording. Check the selected models and try again.')
      setPhase('ended')
    } finally {
      setIsEvaluating(false)
    }
  }

  function skipCurrentQuestion() {
    if (isTestComplete || !live.connected) return
    setCompletionNotice('')
    try {
      live.sendInstruction('The candidate is skipping the current question. Do not treat this instruction as a candidate answer. Move on to the next appropriate question in the selected IELTS Speaking test, maintain the correct test structure, and continue waiting for the candidate to answer.')
    } catch (error) {
      console.error('Unable to skip the current IELTS speaking question.', error)
      setAssessmentError(error instanceof Error ? error.message : 'Unable to skip this question.')
    }
  }

  const transition = shouldReduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } }

  return (
    <div ref={simulatorPageRef} className={`page-content inner-page simulator-page ${isImmersive ? 'simulator-immersive' : ''}`}>
      <div className="simulator-heading">
        <div>
          <p className="eyebrow">YOUR SPEAKING STUDIO</p>
          <h1>IELTS speaking practice</h1>
          <p className="page-subtitle">A real-time conversation with a Gemini Live IELTS examiner, followed by a separate audio assessment.</p>
        </div>
        {phase === 'live' && <Badge className={`simulator-status ${isTestComplete ? 'simulator-status-complete' : ''}`}><span /> {isTestComplete ? 'TEST COMPLETE · END TO CONTINUE' : 'LIVE PRACTICE'}</Badge>}
      </div>

      <AnimatePresence mode="wait">
        {(phase === 'setup' || phase === 'error') && (
          <motion.div key="setup" {...transition} transition={{ duration: shouldReduceMotion ? 0 : 0.22 }} className="simulator-setup">
            <Card className="simulator-intro">
              <div className="simulator-intro-icon"><Volume2 size={22} /></div>
              <div><h2>Examiner-led speaking practice</h2><p>Speak naturally as Gemini guides you through the selected test format, then assesses your recording against the four IELTS Speaking criteria.</p></div>
            </Card>
            {!apiKey.trim() && <Card className="simulator-key-notice"><AlertCircle size={17} /><p>Add your Gemini API key in Settings to start live speaking practice.</p><Button variant="outline" size="sm" onClick={onOpenSettings}>Open Settings</Button></Card>}

            <div className="simulator-section-title"><div><span>MODULAR TEST WORKSTATIONS</span><h2>Choose your speaking practice</h2></div><span className="session-meta">Select a test format</span></div>
            {partOptions.filter((option) => option.id === 'full').map((option) => (
              <button key={option.id} type="button" aria-pressed={selectedPart === option.id} className={`part-option full-test-option ${selectedPart === option.id ? 'part-option-selected' : ''}`} onClick={() => setSelectedPart(option.id)}>
                <span className="part-option-label">{option.label}</span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
                <span className="part-option-footer"><span><Clock3 size={14} /> {option.time}</span><span>{selectedPart === option.id ? 'Selected' : 'Start'} <ArrowRight size={14} /></span></span>
              </button>
            ))}
            <div className="part-option-grid">
              {partOptions.filter((option) => option.id !== 'full').map((option) => (
                <button key={option.id} type="button" aria-pressed={selectedPart === option.id} className={`part-option ${selectedPart === option.id ? 'part-option-selected' : ''}`} onClick={() => setSelectedPart(option.id)}>
                  <span className="part-option-label">{option.label}</span>
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                  <span className="part-option-footer"><span><Clock3 size={14} /> {option.time}</span><span>{selectedPart === option.id ? 'Selected' : 'Start'} <ArrowRight size={14} /></span></span>
                </button>
              ))}
            </div>
            <Card className="simulator-guidance"><Lightbulb size={19} /><p><strong>What happens in the test</strong><br />Gemini asks your questions aloud, listens to your spoken answers, and keeps a conversation transcript. When you finish, the original examiner and microphone turn audio is compiled in conversation order and submitted with the transcript to your selected Gemini assessment model.</p></Card>
            {(assessmentError || live.error) && <p className="simulator-error" role="alert"><AlertCircle size={16} /> {assessmentError || live.error}</p>}
            <div className="simulator-start-row"><span><Mic size={16} /> Microphone required · use headphones for best results</span><Button className="start-button" disabled={!apiKey.trim() || live.connecting} onClick={() => void beginPractice()}>{live.connecting ? <><LoaderCircle className="spin-icon" size={16} /> Connecting…</> : selectedPart === 'part2' && !assignment ? <>Start 1-minute preparation <ArrowRight size={16} /></> : <>Connect to live examiner <ArrowRight size={16} /></>}</Button></div>
          </motion.div>
        )}

        {phase === 'preparation' && cueCard && (
          <motion.div key="preparation" {...transition} transition={{ duration: shouldReduceMotion ? 0 : 0.22 }} className="part2-preparation">
            <div className="part2-preparation-topline">
              <button type="button" className="back-to-practice" onClick={() => { setIsPreparationTimerRunning(false); setPhase('setup') }}>← Back to practice formats</button>
              <Badge className="question-part-badge">PART 2 · LONG TURN</Badge>
            </div>
            <div className="part2-preparation-heading">
              <span className="section-kicker">60-SECOND PREPARATION</span>
              <h2>Take a moment. Build your story.</h2>
              <p>Read the cue card, start your one-minute timer, and jot down keywords. You can begin speaking as soon as you feel ready.</p>
            </div>
            <div className="part2-workspace">
              <Card className="part2-cue-card">
                <span className="part2-cue-label"><Sparkles size={15} /> YOUR CUE CARD</span>
                <h3>{cueCard.topic}</h3>
                <p>{cueCard.question}</p>
                <div className="part2-cue-tip"><Lightbulb size={16} /><span>Use keywords, not full sentences. Think about the story, details and how you felt.</span></div>
              </Card>
              <Card className="part2-scratchpad-card">
                <div className="part2-scratchpad-heading">
                  <div><span className="part2-cue-label">YOUR PRIVATE SCRATCHPAD</span><h3>Plan your long turn</h3></div>
                  <div className={`part2-prep-clock ${preparationSeconds <= 10 ? 'part2-prep-clock-low' : ''}`} role="timer" aria-live="off"><Clock3 size={17} /> {formatTime(preparationSeconds)}</div>
                </div>
                <p>Capture a few prompts to guide your answer. Your notes are private and are not included in your assessment.</p>
                <textarea aria-label="Part 2 cue card notes" value={preparationNotes} onChange={(event) => setPreparationNotes(event.target.value)} placeholder={'Who? — a person I admire\nWhen/where? — how we met\nWhat they did — key achievement\nWhy it matters — how it inspired me'} />
                <div className="part2-scratchpad-footer">
                  <span>{preparationNotes.trim() ? preparationNotes.trim().split(/\s+/).length : 0} words · Your notes stay private</span>
                  <div className="part2-prep-controls">
                    <button type="button" className="part2-timer-button" onClick={resetPart2Preparation} aria-label="Reset preparation timer" title="Reset to 60 seconds"><RotateCcw size={15} /></button>
                    <button type="button" className="part2-timer-button" disabled={preparationSeconds === 0 && !isPreparationTimerRunning} onClick={togglePart2PreparationTimer} aria-label={isPreparationTimerRunning ? 'Pause preparation timer' : 'Start preparation timer'}>{isPreparationTimerRunning ? <Pause size={15} /> : <Play size={15} />}<span>{isPreparationTimerRunning ? 'Pause' : preparationSeconds === 0 ? 'Time is up' : 'Start timer'}</span></button>
                  </div>
                </div>
              </Card>
            </div>
            <div className="part2-preparation-actions">
              <span><Mic size={15} /> Next, Speakia will read this cue card and invite your two-minute answer.</span>
              <Button className="start-button" disabled={!apiKey.trim() || live.connecting} onClick={() => void startLivePractice()}>{live.connecting ? <><LoaderCircle className="spin-icon" size={16} /> Connecting…</> : <>I’m ready · start speaking <ArrowRight size={16} /></>}</Button>
            </div>
            {assessmentError && <p className="simulator-error" role="alert"><AlertCircle size={16} /> {assessmentError}</p>}
          </motion.div>
        )}

        {phase === 'live' && (
          <motion.div key="live" {...transition} transition={{ duration: shouldReduceMotion ? 0 : 0.2 }} className="simulator-live">
            <div className="live-session-topline"><div><Badge className="question-part-badge">{partLabel(selectedPart)}</Badge><span><span className={`live-dot ${live.connected ? 'live-dot-on' : ''}`} />{live.status || 'Starting live session…'}</span></div><div className="live-session-actions"><button type="button" className={`immersive-mode-toggle ${isImmersive ? 'immersive-mode-active' : ''}`} aria-pressed={isImmersive} onClick={() => void toggleImmersiveMode()} title={isImmersive ? 'Exit immersive mode' : 'Hide live captions and enter fullscreen'}>{isImmersive ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{isImmersive ? 'Exit immersive' : 'Immersive mode'}</span></button><div className="live-elapsed"><Clock3 size={16} /> {formatTime(elapsedSeconds)}</div></div></div>
            <Card className={`live-examiner-card ${isImmersive ? 'live-examiner-immersive' : ''}`}>
              <div className={`live-orb ${live.connected ? 'live-orb-active' : ''}`}><Waves size={42} /></div>
              <div><span className="section-kicker">SPEAKIA LIVE EXAMINER</span><h2>{live.connected ? 'Your examiner is listening.' : live.connecting ? 'Connecting to the examiner…' : 'Waiting for live connection'}</h2><p>Answer aloud at your natural pace. Your Speakia examiner will guide you through the selected IELTS speaking test.</p></div>
              <div className="live-session-footer"><span><Mic size={15} /> Microphone audio is streamed live and recorded for this assessment.</span>{live.connected && <Badge className="live-active-badge"><span /> LIVE</Badge>}</div>
            </Card>
            {selectedPart === 'full' && <button type="button" className="live-notes-toggle" aria-expanded={showPart2Notes} onClick={() => setShowPart2Notes((shown) => !shown)}>
              <span><Lightbulb size={16} /> Part 2 cue-card scratchpad</span><span>{showPart2Notes ? 'Hide notes' : 'Open notes'} <ArrowRight size={14} /></span>
            </button>}
            {(selectedPart === 'part2' || (selectedPart === 'full' && showPart2Notes)) && <Card className="live-part2-notes">
              <div className="live-part2-notes-heading">
                <div><span className="part2-cue-label">PART 2 · PRIVATE NOTES</span><h3>{selectedPart === 'part2' ? 'Your cue card notes' : 'Cue-card scratchpad'}</h3></div>
                <div className={`part2-prep-clock ${preparationSeconds <= 10 ? 'part2-prep-clock-low' : ''}`} role="timer" aria-live="off"><Clock3 size={16} /> {formatTime(preparationSeconds)}</div>
              </div>
              <textarea aria-label="Part 2 cue card notes during speaking test" value={preparationNotes} onChange={(event) => setPreparationNotes(event.target.value)} placeholder="Jot down a few keywords to keep your story on track…" />
              <div className="part2-scratchpad-footer">
                <span>{preparationNotes.trim() ? preparationNotes.trim().split(/\s+/).length : 0} words · Private to you</span>
                <div className="part2-prep-controls">
                  <button type="button" className="part2-timer-button" onClick={resetPart2Preparation} aria-label="Reset cue card timer" title="Reset to 60 seconds"><RotateCcw size={15} /></button>
                  <button type="button" className="part2-timer-button" disabled={preparationSeconds === 0 && !isPreparationTimerRunning} onClick={togglePart2PreparationTimer} aria-label={isPreparationTimerRunning ? 'Pause cue card timer' : 'Start cue card timer'}>{isPreparationTimerRunning ? <Pause size={15} /> : <Play size={15} />}<span>{isPreparationTimerRunning ? 'Pause timer' : preparationSeconds === 0 ? 'Time is up' : 'Start 1-min timer'}</span></button>
                </div>
              </div>
            </Card>}
            {live.error && <p className="simulator-error" role="alert"><AlertCircle size={16} /> {live.error}</p>}
            {!isImmersive && <Card className="live-transcript-card">
              <div className="live-transcript-heading"><div><span className="section-kicker">LIVE CAPTIONS</span><h3>Conversation transcript</h3></div><span>{live.transcript.length} turns</span></div>
              <div className="live-transcript-scroll" aria-live="polite">
                {visibleTranscript.length
                  ? <TranscriptAudioList
                    turns={visibleTranscript}
                    variant="live"
                    activeTurnId={live.activeExaminerTurnId}
                    activeWordIndex={wordIndexAtElapsed(
                      live.transcript.find((turn) => turn.id === live.activeExaminerTurnId)?.text ?? '',
                      live.examinerSpeechElapsedSeconds,
                    )}
                  />
                  : <div className="transcript-waiting"><LoaderCircle size={18} /><span>Your live transcript will appear here when the examiner starts speaking.</span></div>}
                {live.candidateDraft && <div className="live-transcript-line candidate-line live-draft-line"><span>YOU · LIVE</span><p>{live.candidateDraft}</p></div>}
              </div>
            </Card>}
            {completionNotice && <p className="simulator-error" role="status"><AlertCircle size={16} /> {completionNotice}</p>}
            <div className="live-actions">
              <span><AlertCircle size={15} /> {isTestComplete
                ? 'The examiner has completed this test. End the conversation to continue to assessment.'
                : 'The test is in progress. Skip moves to the next question without counting this as an answer.'}</span>
              {isTestComplete
                ? <Button className="finish-live-button" disabled={isEvaluating || live.connecting || live.status !== 'Your examiner is listening'} onClick={() => void endTest()}><MicOff size={16} /> End</Button>
                : <Button className="finish-live-button" disabled={!live.connected || live.connecting} onClick={skipCurrentQuestion}><ArrowRight size={16} /> Skip</Button>}
            </div>
            {assessmentError && <p className="simulator-error" role="alert"><AlertCircle size={16} /> {assessmentError}</p>}
          </motion.div>
        )}

        {phase === 'ended' && (
          <motion.div key="ended" {...transition} transition={{ duration: shouldReduceMotion ? 0 : 0.2 }} className="evaluation-pending">
            <div className="evaluating-animation"><Check size={26} /></div>
            <h2>Your speaking test has ended.</h2>
            <p>Your recording is ready. Start the separate IELTS-criteria assessment when you’re ready.</p>
            {assessmentError && <p className="simulator-error" role="alert"><AlertCircle size={16} /> {assessmentError}</p>}
            <div className="simulator-start-row"><span><Clock3 size={15} /> Recorded speaking time · {formatTime(elapsedSeconds)}</span><Button className="start-button" disabled={!apiKey.trim() || !completedRecording || isEvaluating} onClick={() => void assessTest()}>{isEvaluating ? <><LoaderCircle className="spin-icon" size={16} /> Assessing…</> : <>Assessment <ArrowRight size={16} /></>}</Button></div>
          </motion.div>
        )}

        {phase === 'evaluating' && (
          <motion.div key="evaluating" {...transition} transition={{ duration: shouldReduceMotion ? 0 : 0.2 }} className="evaluation-pending">
            <div className="evaluating-animation"><Sparkles size={26} /></div><h2>Gemini is assessing your speaking.</h2><p>Compiling original transcript audio and assessing it with {ASSESSMENT_MODELS.find((model) => model.id === assessmentModel)?.label ?? assessmentModel}. Keep this page open.</p><div className="evaluation-pending-steps"><span><Check size={15} /> Practice recording captured</span><span className="pending-step-active"><LoaderCircle className="spin-icon" size={15} /> Gemini audio assessment in progress</span></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
