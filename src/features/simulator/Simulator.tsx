import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Type, type FunctionCall, type FunctionDeclaration, type FunctionResponse } from '@google/genai'
import { GoogleGenAI } from '@/lib/geminiClient'
import { getProdiaTextModel } from '@/lib/geminiModels'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  AudioLines,
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
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  WandSparkles,
  Volume2,
  Waves,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { partLabel, promptsForPart } from './questions'
import { generateAndSaveCueCard, useGeneratedCueCards, type CueCardTopic } from './cueCards'
import { createExaminerInstructions, createTranscriptAudioCopy, ASSESSMENT_MODELS, assessSpeakingAudio, type AssessmentModel } from './gemini'
import { useGeminiLive } from './useGeminiLive'
import { bankPrompts } from '@/features/topics/topicPrompts'
import type { TopicBankPrompt } from '@/features/topics/types'
import { TranscriptAudioList } from './TranscriptAudioList'
import { SpeechHighlight } from './SpeechHighlight'
import { lastWordIndex, wordIndexAtElapsed } from './speechTiming'
import { formatAssessmentDuration, getAssessmentModelLabel } from './assessmentDuration'
import type { TestPart, TestResult, TranscriptEntry } from './types'
import type { CoachAssignment } from '@/features/assignments/types'

type Phase = 'setup' | 'preparation' | 'live' | 'compiling' | 'ended' | 'evaluating' | 'error'

const markTestCompleteTool: FunctionDeclaration = {
  name: 'mark_speaking_test_complete',
  description: 'Mark the current IELTS speaking test complete only after completing every required section and enough questions for the selected test format. Never call just because the candidate asks to stop early.',
  parameters: { type: Type.OBJECT, properties: {} },
}

function examinerConcludedTest(transcript: TranscriptEntry[]): boolean {
  return transcript.some(({ role, text }) => role === 'examiner' && (
    /\b(?:your|the|this)\s+(?:(?:speaking|practice)\s+)?test\s+(?:(?:is|has been|has)\s+(?:now\s+)?(?:concluded|complete|completed|finished|over)|(?:just\s+)?concluded)\b/i.test(text)
    || /\b(?:that|this)\s+concludes\s+(?:your|the)\s+(?:(?:speaking|practice)\s+)?test\b/i.test(text)
    || /\bwe(?:'ve| have) reached the end of (?:your|the) test\b/i.test(text)
    || /\bthat(?:'s| is) the end of (?:your|the) test\b/i.test(text)
  ))
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

function activeTestPart(selectedPart: TestPart, transcript: TranscriptEntry[]): TestPart {
  if (selectedPart !== 'full') return selectedPart

  let currentPart: TestPart = 'part1'
  for (const turn of transcript) {
    if (turn.role !== 'examiner') continue
    const text = turn.text.toLocaleLowerCase()
    if (currentPart === 'part1' && (
      /\bmove on to part (?:2|two)\b|\bmove to part (?:2|two)\b|\bproceed to part (?:2|two)\b|\bbegin part (?:2|two)\b/i.test(text)
      || /\b(?:cue card|one minute to prepare|you should say)\b/i.test(text)
    )) {
      currentPart = 'part2'
    }
    if (currentPart !== 'part3' && /\bmove on to part (?:3|three)\b|\bmove to part (?:3|three)\b|\bproceed to part (?:3|three)\b|\bbegin part (?:3|three)\b/i.test(text)) {
      currentPart = 'part3'
    }
  }
  return currentPart
}

export function Simulator({ onComplete, apiKey, assessmentModel, onAssessmentModelChange, onOpenSettings, initialPart, assignment, topicBankPrompts = [], selectedTopicBankPrompt, startImmediately = false, onStartRequestHandled }: { onComplete: (result: TestResult, recording: Blob, audioCopy: Blob, transcriptAudio: TranscriptEntry[]) => void; apiKey: string; assessmentModel: AssessmentModel; onAssessmentModelChange: (model: AssessmentModel) => void; onOpenSettings: () => void; initialPart?: TestPart; assignment?: CoachAssignment | null; topicBankPrompts?: TopicBankPrompt[]; selectedTopicBankPrompt?: TopicBankPrompt; startImmediately?: boolean; onStartRequestHandled?: () => void }) {
  const [selectedPart, setSelectedPart] = useState<TestPart>(initialPart ?? 'full')
  const [selectedCueCardId, setSelectedCueCardId] = useState(selectedTopicBankPrompt?.part === 'part2' ? selectedTopicBankPrompt.id : '')
  const [activeCueCardId, setActiveCueCardId] = useState('')
  const [cueCardSearch, setCueCardSearch] = useState('')
  const [newCueCardTheme, setNewCueCardTheme] = useState('')
  const [generatingCueCard, setGeneratingCueCard] = useState(false)
  const [choosingCueCard, setChoosingCueCard] = useState(false)
  const [phase, setPhase] = useState<Phase>('setup')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [preparationSeconds, setPreparationSeconds] = useState(PREPARATION_SECONDS)
  const [isPreparationTimerRunning, setIsPreparationTimerRunning] = useState(false)
  const [preparationNotes, setPreparationNotes] = useState('')
  const [showPart2Notes, setShowPart2Notes] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [assessmentElapsedMs, setAssessmentElapsedMs] = useState(0)
  const [isTestComplete, setIsTestComplete] = useState(false)
  const [completedRecording, setCompletedRecording] = useState<Blob | null>(null)
  const [completedAudioCopy, setCompletedAudioCopy] = useState<Blob | null>(null)
  const [completedRecordingUrl, setCompletedRecordingUrl] = useState('')
  const [audioCompileProgress, setAudioCompileProgress] = useState({ completed: 0, total: 0 })
  const [completedTranscript, setCompletedTranscript] = useState<TranscriptEntry[]>([])
  const [isImmersive, setIsImmersive] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false)
  const [assessmentError, setAssessmentError] = useState('')
  const simulatorPageRef = useRef<HTMLDivElement>(null)
  const completedRecordingUrlRef = useRef('')
  const preparationDeadlineRef = useRef<number | null>(null)
  const assessmentStartedAtRef = useRef<number | null>(null)
  const preparationStartRequestedRef = useRef(false)
  const startRequestHandledRef = useRef(false)
  const shouldReduceMotion = useReducedMotion() ?? false
  const generatedCueCards = useGeneratedCueCards()

  useEffect(() => {
    const startedAt = assessmentStartedAtRef.current
    if (!isEvaluating || startedAt === null) return
    const updateElapsed = () => setAssessmentElapsedMs(performance.now() - startedAt)
    const intervalId = window.setInterval(updateElapsed, 250)
    return () => window.clearInterval(intervalId)
  }, [isEvaluating])
  const topicBankCueCards = useMemo(() => [...bankPrompts, ...topicBankPrompts]
    .filter((prompt) => prompt.part === 'part2')
    .map((prompt) => ({
      id: prompt.id,
      title: prompt.topic,
      cueCard: prompt.cuePoints?.length
        ? `${prompt.question}\n\nYou should say:\n${prompt.cuePoints.map((point) => `• ${point}`).join('\n')}`
        : prompt.question,
    })), [topicBankPrompts])
  const availableCueCards = useMemo(() => {
    const seenTitles = new Set<string>()
    return [...topicBankCueCards, ...generatedCueCards].filter((card) => {
      const title = card.title.trim().toLocaleLowerCase()
      if (seenTitles.has(title)) return false
      seenTitles.add(title)
      return true
    })
  }, [generatedCueCards, topicBankCueCards])
  const prompts = useMemo(() => {
    if (selectedTopicBankPrompt?.part !== selectedPart) return promptsForPart(selectedPart)
    return [{
      ...selectedTopicBankPrompt,
      preparationSeconds: selectedTopicBankPrompt.preparationSeconds ?? (selectedPart === 'part2' ? PREPARATION_SECONDS : 0),
      responseSeconds: selectedTopicBankPrompt.responseSeconds ?? (selectedPart === 'part3' ? 60 : selectedPart === 'part2' ? 120 : 45),
    }]
  }, [selectedPart, selectedTopicBankPrompt])
  const choosePracticePart = useCallback((part: TestPart) => {
    setSelectedPart(part)
    if (part === 'full') {
      setSelectedCueCardId('')
      setActiveCueCardId('')
    }
  }, [])
  const filteredCueCards = useMemo(() => {
    const query = cueCardSearch.trim().toLocaleLowerCase()
    return availableCueCards.filter((card) => !query || `${card.title} ${card.cueCard}`.toLocaleLowerCase().includes(query))
  }, [availableCueCards, cueCardSearch])
  const cueCard = useMemo(() => {
    const selectedCard = availableCueCards.find((card) => card.id === activeCueCardId)
    if (selectedCard) return {
      id: selectedCard.id,
      part: 'part2' as const,
      topic: selectedCard.title,
      question: selectedCard.cueCard,
      preparationSeconds: PREPARATION_SECONDS,
      responseSeconds: 120,
    }
    return prompts.find((prompt) => prompt.part === 'part2')
  }, [activeCueCardId, availableCueCards, prompts])
  const systemInstruction = useMemo(
    () => {
      const baseInstructions = createExaminerInstructions(selectedPart, prompts.map((prompt) =>
        prompt.part === 'part2' && cueCard ? cueCard.question : prompt.question,
      ))
      if (!assignment && selectedPart === 'part2' && cueCard) {
        return `${baseInstructions}\nUse this exact selected cue card for the Part 2 long turn:\nTitle: ${cueCard.topic}\n${cueCard.question}\nThe candidate has already read the cue card and used or ended the private one-minute preparation period in the app. Do not present the card again or provide another preparation minute. Invite the candidate to begin their long turn based on this card.`
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
      setIsTestComplete(true)
      return { id: call.id, name: call.name, response: { status: 'success', instruction: 'The selected test format is complete. Tell the candidate they may end the session.' } }
    })
  ), [])
  const live = useGeminiLive({
    apiKey,
    systemInstruction,
    tools: [{ functionDeclarations: [markTestCompleteTool] }],
    onToolCall: handleLiveToolCall,
    openingPrompt: assignment
      ? `Begin the assigned IELTS Speaking ${assignment.part.replace('part', 'Part ')} practice on "${assignment.topic}". Introduce yourself exactly as Speakia: "Hello, my name is Speakia, and I’ll be your IELTS Speaking examiner today." Then guide the learner through the activity: ${assignment.activity}`
      : selectedPart === 'part2' && cueCard
        ? `Begin an IELTS Speaking Part 2 long turn. Introduce yourself exactly as Speakia: "Hello, my name is Speakia, and I’ll be your IELTS Speaking examiner today." The candidate has already read this cue card and used or chosen to end their preparation time:\n${cueCard.question}\nInvite them to begin speaking for up to two minutes about "${cueCard.topic}". Do not read the cue card again or give another preparation minute. After the long turn, ask one brief related follow-up question.`
      : 'Begin the IELTS Speaking practice by introducing yourself exactly as Speakia: "Hello, my name is Speakia, and I’ll be your IELTS Speaking examiner today." Then continue with the first question for the selected test format.',
  })
  const startLiveSession = live.start
  const visibleTranscript = live.transcript.slice(-30)
  const currentLivePart = activeTestPart(selectedPart, live.transcript)

  useEffect(() => {
    if (!isTestComplete && phase === 'live' && examinerConcludedTest(live.transcript)) {
      setIsTestComplete(true)
    }
  }, [isTestComplete, live.transcript, phase])

  useEffect(() => {
    function syncImmersiveMode() {
      setIsImmersive(document.fullscreenElement === simulatorPageRef.current)
    }
    document.addEventListener('fullscreenchange', syncImmersiveMode)
    return () => document.removeEventListener('fullscreenchange', syncImmersiveMode)
  }, [])

  useEffect(() => {
    if (!showDiscardConfirmation) return
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowDiscardConfirmation(false)
    }
    document.addEventListener('keydown', dismissOnEscape)
    return () => document.removeEventListener('keydown', dismissOnEscape)
  }, [showDiscardConfirmation])

  useEffect(() => () => {
    if (completedRecordingUrlRef.current) URL.revokeObjectURL(completedRecordingUrlRef.current)
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

  const startLivePractice = useCallback(async (fromPreparation = false, fullTestCueCard?: CueCardTopic) => {
    if (fromPreparation) {
      if (preparationStartRequestedRef.current) return
      preparationStartRequestedRef.current = true
    }
    preparationDeadlineRef.current = null
    setIsPreparationTimerRunning(false)
    setElapsedSeconds(0)
    setIsTestComplete(false)
    setCompletedRecording(null)
    setCompletedAudioCopy(null)
    setAudioCompileProgress({ completed: 0, total: 0 })
    if (completedRecordingUrlRef.current) URL.revokeObjectURL(completedRecordingUrlRef.current)
    completedRecordingUrlRef.current = ''
    setCompletedRecordingUrl('')
    setCompletedTranscript([])
    setShowPart2Notes(false)
    setIsImmersive(true)
    setPhase('live')
    try {
      const startOverrides = selectedPart === 'full' && fullTestCueCard
        ? {
          systemInstruction: `${createExaminerInstructions('full', prompts.map((prompt) => (
            prompt.part === 'part2' ? fullTestCueCard.cueCard : prompt.question
          )))}\nUse this exact Topic Bank cue card for Part 2:\nTitle: ${fullTestCueCard.title}\n${fullTestCueCard.cueCard}`,
          openingPrompt: `Begin the full IELTS Speaking test. Introduce yourself using the required wording, then conduct Part 1 first. Later, present this exact Part 2 cue card and give the candidate one minute to prepare: "${fullTestCueCard.title}".`,
        }
        : undefined
      const started = await startLiveSession(startOverrides)
      if (!started) {
        setIsImmersive(false)
        setPhase('setup')
      }
    } catch (error) {
      console.error('Unable to start the Part 2 examiner after preparation.', error)
      setAssessmentError(error instanceof Error ? error.message : 'Unable to connect to the live examiner.')
      setIsImmersive(false)
      setPhase('error')
    }
  }, [prompts, selectedPart, startLiveSession])

  useEffect(() => {
    if (phase === 'preparation' && preparationSeconds === 0) {
      void startLivePractice(true)
    }
  }, [phase, preparationSeconds, startLivePractice])

  async function generateNewCueCard() {
    setGeneratingCueCard(true)
    setAssessmentError('')
    try {
      const card = await generateAndSaveCueCard(apiKey, availableCueCards, newCueCardTheme)
      setSelectedCueCardId(card.id)
      setNewCueCardTheme('')
    } catch (error) {
      console.error('Unable to generate a new Exam Simulation cue card.', error)
      setAssessmentError(error instanceof Error ? error.message : 'Unable to generate a new cue-card topic.')
    } finally {
      setGeneratingCueCard(false)
    }
  }

  const beginPractice = useCallback(async () => {
    setAssessmentError('')
    if (selectedPart === 'part2' && !assignment) {
      preparationStartRequestedRef.current = false
      let cueCardId = selectedCueCardId
      if (!cueCardId) {
        if (!apiKey.trim()) {
          setAssessmentError('Add your Speakia AI API key before asking AI to choose a cue card.')
          return
        }
        setChoosingCueCard(true)
        try {
          const client = new GoogleGenAI({ apiKey: apiKey.trim() })
          const response = await client.models.generateContent({
            model: getProdiaTextModel(),
            contents: `Choose the most suitable IELTS Speaking Part 2 cue-card topic for a speaking practice session from this library. Select one id and return only the required JSON. Avoid choosing the same type of topic repeatedly when the list has variety.\n${JSON.stringify(availableCueCards.map(({ id, title }) => ({ id, title })))}`,
            config: {
              temperature: 0.8,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: { id: { type: Type.STRING } },
                required: ['id'],
              },
            },
          })
          if (!response.text?.trim()) throw new Error('Speakia AI did not choose a cue-card topic. Try selecting one from the library.')
          let choice: unknown
          try {
            choice = JSON.parse(response.text)
          } catch (error) {
            console.error('Speakia AI returned invalid JSON for the cue-card selection.', error)
            throw new Error('Speakia AI returned an unreadable topic choice. Try again or select a topic.')
          }
          if (typeof choice !== 'object' || choice === null || !('id' in choice) || typeof choice.id !== 'string'
            || !availableCueCards.some((card) => card.id === choice.id)) {
            throw new Error('Speakia AI selected an unavailable topic. Try again or select a topic.')
          }
          cueCardId = choice.id
          setSelectedCueCardId(cueCardId)
        } catch (error) {
          console.error('Unable to let Speakia AI select an IELTS Part 2 cue card.', error)
          setAssessmentError(error instanceof Error ? error.message : 'Unable to choose a cue-card topic.')
          return
        } finally {
          setChoosingCueCard(false)
        }
      }
      setActiveCueCardId(cueCardId)
      preparationDeadlineRef.current = null
      setPreparationSeconds(PREPARATION_SECONDS)
      setIsPreparationTimerRunning(false)
      setPreparationNotes('')
      setPhase('preparation')
      return
    }
    if (selectedPart === 'full' && !assignment) {
      const cueCard = availableCueCards[Math.floor(Math.random() * availableCueCards.length)]
      if (!cueCard) {
        setAssessmentError('No Part 2 cue cards are available. Add a cue card in Topics & Vocabulary and try again.')
        return
      }
      setActiveCueCardId(cueCard.id)
      await startLivePractice(false, cueCard)
      return
    }
    await startLivePractice()
  }, [apiKey, assignment, availableCueCards, selectedCueCardId, selectedPart, startLivePractice])

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
    if (isImmersive) {
      setIsImmersive(false)
      if (document.fullscreenElement === simulatorPageRef.current) {
        try {
          await document.exitFullscreen()
        } catch (error) {
          console.error('Unable to exit immersive mode.', error)
          setAssessmentError(error instanceof Error ? error.message : 'Unable to exit immersive mode.')
        }
      }
      return
    }

    setIsImmersive(true)
    try {
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

  async function discardSession() {
    if (isDiscarding) return
    setShowDiscardConfirmation(false)
    setIsDiscarding(true)
    setAssessmentError('')
    try {
      await live.stop()
      if (document.fullscreenElement === simulatorPageRef.current) {
        try {
          await document.exitFullscreen()
        } catch (error) {
          console.error('Unable to exit immersive mode after discarding the speaking session.', error)
          setAssessmentError('The session was discarded, but immersive mode could not be closed automatically. Press Escape to exit fullscreen.')
        }
      }
      preparationDeadlineRef.current = null
      preparationStartRequestedRef.current = false
      setIsPreparationTimerRunning(false)
      setPreparationSeconds(PREPARATION_SECONDS)
      setPreparationNotes('')
      setIsTestComplete(false)
      setCompletedRecording(null)
      setCompletedAudioCopy(null)
      setAudioCompileProgress({ completed: 0, total: 0 })
      if (completedRecordingUrlRef.current) URL.revokeObjectURL(completedRecordingUrlRef.current)
      completedRecordingUrlRef.current = ''
      setCompletedRecordingUrl('')
      setCompletedTranscript([])
      setElapsedSeconds(0)
      setIsImmersive(false)
      setPhase('setup')
    } catch (error) {
      console.error('Unable to discard the IELTS speaking session.', error)
      setAssessmentError(error instanceof Error ? error.message : 'Unable to discard this practice session.')
    } finally {
      setIsDiscarding(false)
    }
  }

  async function endTest() {
    if (phase !== 'live' || !isTestComplete || isEvaluating || isDiscarding) return
    setAssessmentError('')
    setAudioCompileProgress({ completed: 0, total: 0 })
    setPhase('compiling')
    try {
      const stoppedSession = await live.stop()
      if (stoppedSession.recording.size === 0) {
        setAssessmentError('No audio was recorded. Check microphone access and complete another live practice session.')
        setIsImmersive(false)
        setPhase('setup')
        return
      }
      setCompletedRecording(stoppedSession.recording)
      setCompletedAudioCopy(null)
      setCompletedTranscript(stoppedSession.transcript)
      if (completedRecordingUrlRef.current) URL.revokeObjectURL(completedRecordingUrlRef.current)
      completedRecordingUrlRef.current = ''
      setCompletedRecordingUrl('')
      setAudioCompileProgress({
        completed: 0,
        total: stoppedSession.transcript.filter((turn) => turn.role !== 'assessment' && turn.audio instanceof Blob).length,
      })
      setPhase('compiling')
      void compileReviewAudio(stoppedSession.transcript)
    } catch (error) {
      console.error('Unable to finish the Speakia AI Live recording.', error)
      setAssessmentError(error instanceof Error ? error.message : 'Could not finish the microphone recording.')
      setPhase('live')
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
    setIsImmersive(false)
  }

  async function compileReviewAudio(transcript: TranscriptEntry[]) {
    setAssessmentError('')
    try {
      const audioCopy = await createTranscriptAudioCopy(transcript, setAudioCompileProgress)
      const recordingUrl = URL.createObjectURL(audioCopy)
      if (completedRecordingUrlRef.current) URL.revokeObjectURL(completedRecordingUrlRef.current)
      completedRecordingUrlRef.current = recordingUrl
      setCompletedRecordingUrl(recordingUrl)
      setCompletedAudioCopy(audioCopy)
    } catch (error) {
      console.error('Unable to compile the speaking session transcript audio.', error)
      setAssessmentError(error instanceof Error ? error.message : 'Unable to compile the complete speaking session audio.')
    } finally {
      setPhase('ended')
    }
  }

  function retryAudioCompilation() {
    setAudioCompileProgress({ completed: 0, total: completedTranscript.filter((turn) => turn.role !== 'assessment' && turn.audio instanceof Blob).length })
    setPhase('compiling')
    void compileReviewAudio(completedTranscript)
  }

  async function assessTest() {
    if (phase !== 'ended' || !completedRecording || !completedAudioCopy || isEvaluating) return
    setIsEvaluating(true)
    setAssessmentError('')
    const assessmentStartedAt = performance.now()
    assessmentStartedAtRef.current = assessmentStartedAt
    setAssessmentElapsedMs(0)
    setPhase('evaluating')
    try {
      const result = await assessSpeakingAudio(
        apiKey,
        completedAudioCopy,
        completedTranscript,
        selectedPart,
        elapsedSeconds,
        assessmentModel,
      )
      const assessmentDurationMs = Math.round(performance.now() - assessmentStartedAt)
      setAssessmentElapsedMs(assessmentDurationMs)
      assessmentStartedAtRef.current = null
      onComplete({ ...result, assessmentModel, assessmentDurationMs }, completedRecording, completedAudioCopy, completedTranscript.filter((turn) => turn.audio))
    } catch (error) {
      console.error('Speakia AI could not assess this IELTS speaking recording.', error)
      setAssessmentError(error instanceof Error
        ? error.message
        : 'Speakia AI could not assess the recording. Check the selected models and try again.')
      setPhase('ended')
    } finally {
      setIsEvaluating(false)
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
          <p className="page-subtitle">A real-time conversation with a Speakia IELTS examiner, followed by a separate audio assessment.</p>
        </div>
        {phase === 'live' && <Badge className={`simulator-status ${isTestComplete ? 'simulator-status-complete' : ''}`}><span /> {isTestComplete ? 'TEST COMPLETE · END TO CONTINUE' : 'LIVE PRACTICE'}</Badge>}
      </div>

      <AnimatePresence mode="wait">
        {(phase === 'setup' || phase === 'error') && (
          <motion.div key="setup" {...transition} transition={{ duration: shouldReduceMotion ? 0 : 0.22 }} className="simulator-setup">
            <Card className="simulator-intro">
              <div className="simulator-intro-icon"><Volume2 size={22} /></div>
              <div><h2>Speaking Test Simulation</h2><p>Complete a realistic IELTS Speaking test and discover how your performance measures against the four assessment criteria.</p></div>
            </Card>
            {!apiKey.trim() && <Card className="simulator-key-notice"><AlertCircle size={17} /><p>Add your Speakia AI key in Settings to start live speaking practice.</p><Button variant="outline" size="sm" onClick={onOpenSettings}>Open Settings</Button></Card>}

            <div className="simulator-section-title"><div><span>MODULAR TEST WORKSTATIONS</span><h2>Choose your speaking practice</h2></div><span className="session-meta">Select a test format</span></div>
            {partOptions.filter((option) => option.id === 'full').map((option) => (
              <button key={option.id} type="button" aria-pressed={selectedPart === option.id} className={`part-option full-test-option ${selectedPart === option.id ? 'part-option-selected' : ''}`} onClick={() => choosePracticePart(option.id)}>
                <span className="part-option-label">{option.label}</span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
                <span className="part-option-footer"><span><Clock3 size={14} /> {option.time}</span><span>{selectedPart === option.id ? 'Selected' : 'Start'} <ArrowRight size={14} /></span></span>
              </button>
            ))}
            <div className="part-option-grid">
              {partOptions.filter((option) => option.id !== 'full').map((option) => (
                <button key={option.id} type="button" aria-pressed={selectedPart === option.id} className={`part-option ${selectedPart === option.id ? 'part-option-selected' : ''}`} onClick={() => choosePracticePart(option.id)}>
                  <span className="part-option-label">{option.label}</span>
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                  <span className="part-option-footer"><span><Clock3 size={14} /> {option.time}</span><span>{selectedPart === option.id ? 'Selected' : 'Start'} <ArrowRight size={14} /></span></span>
                </button>
              ))}
            </div>
            {selectedPart === 'part2' && !assignment && <section className="simulator-cue-library" aria-labelledby="simulator-cue-library-heading">
              <div className="simulator-cue-library-heading"><div><span className="section-kicker">PART 2 · TOPIC LIBRARY</span><h2 id="simulator-cue-library-heading">Choose your cue card</h2><p>Select a topic, ask Speakia to choose one, or generate a fresh topic for your library.</p></div><span>{availableCueCards.length} topics</span></div>
              <label className="simulator-cue-search"><Search size={15} /><span className="sr-only">Search cue-card topics</span><input type="search" value={cueCardSearch} onChange={(event) => setCueCardSearch(event.target.value)} placeholder="Search topics" /></label>
              <div className="simulator-cue-grid" role="group" aria-label="Part 2 cue-card topics">
                <button type="button" className={`simulator-cue-option simulator-cue-option-ai ${selectedCueCardId ? '' : 'simulator-cue-option-selected'}`} aria-pressed={!selectedCueCardId} onClick={() => setSelectedCueCardId('')}>
                  <span><Sparkles size={16} /></span><strong>Let Speakia choose</strong><small>Pick a suitable topic from the library</small>
                </button>
                {filteredCueCards.map((card) => <button type="button" key={card.id} className={`simulator-cue-option ${selectedCueCardId === card.id ? 'simulator-cue-option-selected' : ''}`} aria-pressed={selectedCueCardId === card.id} onClick={() => setSelectedCueCardId(card.id)}>
                  <span className="simulator-cue-option-tag">{generatedCueCards.some((generated) => generated.id === card.id) ? 'AI-GENERATED · SAVED' : 'IELTS PART 2'}</span><strong>{card.title}</strong><small>1 minute to prepare · up to 2 minutes to speak</small>
                </button>)}
                {filteredCueCards.length === 0 && <p className="simulator-cue-no-results">No cue cards match your search.</p>}
              </div>
              <div className="simulator-cue-generate">
                <label htmlFor="simulator-new-cue-theme">Want a different topic?</label>
                <div><input id="simulator-new-cue-theme" value={newCueCardTheme} onChange={(event) => setNewCueCardTheme(event.target.value)} maxLength={160} placeholder="Optional theme, e.g. a time you solved a problem" disabled={generatingCueCard || !apiKey.trim()} /><Button type="button" variant="outline" onClick={() => void generateNewCueCard()} disabled={generatingCueCard || !apiKey.trim()}>{generatingCueCard ? <><LoaderCircle size={14} className="spin-icon" /> Generating…</> : <><WandSparkles size={14} /> Generate new topic</>}</Button></div>
                <small>Speakia checks the topics above, creates a distinct cue card, and saves it to this library.</small>
              </div>
              {selectedCueCardId && <p className="simulator-cue-selected"><Check size={14} /> Selected: {availableCueCards.find((card) => card.id === selectedCueCardId)?.title}</p>}
            </section>}
            <Card className="simulator-guidance"><Lightbulb size={19} /><p><strong>What happens in the test</strong><br />Speakia asks your questions aloud, listens to your spoken answers, and keeps a conversation transcript. After the test, review the complete transcript and recording before manually starting your assessment.</p></Card>
            {(assessmentError || live.error) && <p className="simulator-error" role="alert"><AlertCircle size={16} /> {assessmentError || live.error}</p>}
            <div className="simulator-start-row"><span><Mic size={16} /> Microphone required · use headphones for best results</span><Button className="start-button" disabled={!apiKey.trim() || live.connecting || choosingCueCard || generatingCueCard} onClick={() => void beginPractice()}>{choosingCueCard ? <><LoaderCircle className="spin-icon" size={16} /> Speakia is choosing…</> : live.connecting ? <><LoaderCircle className="spin-icon" size={16} /> Connecting…</> : selectedPart === 'part2' && !assignment ? <>Start 1-minute preparation <ArrowRight size={16} /></> : <>Connect to live examiner <ArrowRight size={16} /></>}</Button></div>
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
              <p>Read the cue card, start your one-minute timer, and jot down keywords. Start speaking whenever you are ready; the examiner connects automatically when time runs out.</p>
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
              <Button className="start-button" disabled={!apiKey.trim() || live.connecting} onClick={() => void startLivePractice(true)}>{live.connecting ? <><LoaderCircle className="spin-icon" size={16} /> Connecting…</> : <>I’m ready · start speaking <ArrowRight size={16} /></>}</Button>
            </div>
            {assessmentError && <p className="simulator-error" role="alert"><AlertCircle size={16} /> {assessmentError}</p>}
          </motion.div>
        )}

        {phase === 'live' && (
          <motion.div key="live" {...transition} transition={{ duration: shouldReduceMotion ? 0 : 0.2 }} className="simulator-live">
            <div className="live-session-topline"><div><span className="live-current-part"><span className="section-kicker">CURRENT SECTION</span><Badge className="question-part-badge">{partLabel(currentLivePart)}</Badge></span><span><span className={`live-dot ${live.connected ? 'live-dot-on' : ''}`} />{live.status || 'Starting live session…'}</span></div><div className="live-session-actions">{live.connected && <button type="button" className={`live-mic-toggle ${live.micMuted ? 'live-mic-toggle-muted' : ''}`} aria-pressed={live.micMuted} aria-label={live.micMuted ? 'Unmute practice microphone' : 'Mute practice microphone'} title={live.micMuted ? 'Unmute microphone' : 'Mute microphone'} onClick={live.toggleMicMuted}>{live.micMuted ? <MicOff size={16} /> : <Mic size={16} />}<span>{live.micMuted ? 'Mic muted' : 'Mute mic'}</span></button>}<button type="button" className={`immersive-mode-toggle ${isImmersive ? 'immersive-mode-active' : ''}`} aria-pressed={isImmersive} onClick={() => void toggleImmersiveMode()} title={isImmersive ? 'Show live transcript' : 'Hide live transcript and enter immersive mode'}>{isImmersive ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{isImmersive ? 'Transcript mode' : 'Immersive mode'}</span></button><div className="live-elapsed"><Clock3 size={16} /> {formatTime(elapsedSeconds)}</div></div></div>
            <Card className={`live-examiner-card ${isImmersive ? 'live-examiner-immersive' : ''}`}>
              <div className={`live-orb ${live.connected ? 'live-orb-active' : ''}`}><Waves size={42} /></div>
              <div><span className="section-kicker">SPEAKIA LIVE EXAMINER</span><h2>{live.connected ? 'Your examiner is listening.' : live.connecting ? 'Connecting to the examiner…' : 'Waiting for live connection'}</h2><p>Answer aloud at your natural pace. Your Speakia examiner will guide you through the selected IELTS speaking test.</p></div>
              <div className={`live-session-footer ${live.micMuted ? 'live-session-footer-muted' : ''}`}><span>{live.micMuted ? <MicOff size={15} /> : <Mic size={15} />}{live.micMuted ? ' Microphone muted · no ambient audio is sent or recorded.' : ' Microphone audio is streamed live and recorded for this assessment.'}</span>{live.connected && <Badge className="live-active-badge"><span /> {live.micMuted ? 'MUTED' : 'LIVE'}</Badge>}</div>
            </Card>
            {selectedPart === 'full' && currentLivePart === 'part2' && <button type="button" className="live-notes-toggle" aria-expanded={showPart2Notes} onClick={() => setShowPart2Notes((shown) => !shown)}>
              <span><Lightbulb size={16} /> Part 2 cue-card scratchpad</span><span>{showPart2Notes ? 'Hide notes' : 'Open notes'} <ArrowRight size={14} /></span>
            </button>}
            {selectedPart === 'full' && currentLivePart === 'part2' && cueCard && <Card className="live-selected-cue-card">
              <span className="part2-cue-label">PART 2 · SPEAKING CUE CARD</span>
              <h3>{cueCard.topic}</h3>
              <p>{cueCard.question}</p>
            </Card>}
            {(selectedPart === 'part2' || (selectedPart === 'full' && currentLivePart === 'part2' && showPart2Notes)) && <Card className="live-part2-notes">
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
                      live.examinerSpeechDurationSeconds,
                    )}
                  />
                  : <div className="transcript-waiting"><LoaderCircle size={18} /><span>Your live transcript will appear here when the examiner starts speaking.</span></div>}
                {live.candidateDraft && <div className="live-transcript-line candidate-line live-draft-line"><span>YOU · LIVE</span><p><SpeechHighlight text={live.candidateDraft} wordIndex={lastWordIndex(live.candidateDraft)} /></p></div>}
              </div>
            </Card>}
            <div className="live-actions">
              <span><AlertCircle size={15} /> {isTestComplete
                ? 'The examiner has concluded this test. End the session to review your recording and continue to assessment.'
                : live.micMuted
                  ? 'Your microphone is muted. Unmute it to continue the test.'
                  : 'The test is in progress. The review action will appear when the examiner concludes.'}</span>
              {isTestComplete && <Button className="finish-live-button" disabled={isEvaluating || isDiscarding || live.connecting} onClick={() => void endTest()}><MicOff size={16} /> End session &amp; review</Button>}
              <Button className="discard-live-button" variant="outline" disabled={!live.connected || live.connecting || isDiscarding} onClick={() => setShowDiscardConfirmation(true)}>{isDiscarding ? <><LoaderCircle className="spin-icon" size={16} /> Discarding…</> : <><Trash2 size={16} /> Discard session</>}</Button>
            </div>
            {assessmentError && <p className="simulator-error" role="alert"><AlertCircle size={16} /> {assessmentError}</p>}
          </motion.div>
        )}

        {phase === 'ended' && (
          <motion.div key="ended" {...transition} transition={{ duration: shouldReduceMotion ? 0 : 0.2 }} className="evaluation-pending simulator-review-pending">
            <div className="evaluating-animation simulator-review-icon"><Check size={26} /></div>
            <h2>Review your speaking session</h2>
            {completedAudioCopy && completedRecordingUrl ? <>
              <p>Your test has ended. Listen to the complete recording and review the transcript before deciding whether to run the assessment.</p>
              <section className="simulator-recording-review" aria-label="Complete speaking session recording">
                <div><Volume2 size={18} /><div><strong>Complete session recording</strong><span>Original examiner and candidate turns, stitched in conversation order.</span></div></div>
                <audio controls preload="metadata" src={completedRecordingUrl} aria-label="Play the complete speaking session recording" />
              </section>
              <section className="simulator-transcript-review" aria-labelledby="simulator-transcript-review-title">
                <div className="simulator-transcript-review-heading"><div><span className="section-kicker">SESSION TRANSCRIPT</span><h3 id="simulator-transcript-review-title">Complete conversation</h3></div><span>{completedTranscript.length} turns</span></div>
                {completedTranscript.length
                  ? <div className="transcript-list"><TranscriptAudioList turns={completedTranscript} variant="evaluation" /></div>
                  : <p className="simulator-review-empty">No transcript was captured for this session.</p>}
              </section>
              <div className="simulator-review-actions">
                <span><Clock3 size={15} /> Recorded speaking time · {formatTime(elapsedSeconds)}</span>
                <div className="simulator-review-submit">
                  <label className="simulator-review-model-selector" htmlFor="simulator-assessment-model">Assessment model
                    <select id="simulator-assessment-model" className="settings-select" value={assessmentModel} onChange={(event) => {
                      const model = ASSESSMENT_MODELS.find((item) => item.id === event.target.value)
                      if (model) onAssessmentModelChange(model.id)
                    }}>
                      {ASSESSMENT_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label} · {model.description}</option>)}
                    </select>
                  </label>
                  <Button className="start-button" disabled={!apiKey.trim() || !completedRecording || isEvaluating} onClick={() => void assessTest()}>{isEvaluating ? <><LoaderCircle className="spin-icon" size={16} /> Assessing…</> : <>Run speaking assessment <ArrowRight size={16} /></>}</Button>
                </div>
              </div>
            </> : <div className="simulator-audio-compile-error" role="alert">
              <p><AlertCircle size={16} /> {assessmentError || 'The complete recording could not be prepared.'}</p>
              <Button className="start-button" onClick={retryAudioCompilation}><RefreshCw size={15} /> Try compiling again</Button>
            </div>}
          </motion.div>
        )}

        {phase === 'compiling' && (
          <motion.div key="compiling" {...transition} transition={{ duration: shouldReduceMotion ? 0 : 0.2 }} className="evaluation-pending simulator-audio-compiling" role="status" aria-live="polite">
            <div className="evaluating-animation"><AudioLines size={26} /></div>
            <h2>Preparing your complete recording</h2>
            <p>Stitching the original examiner and candidate audio turns into one recording. Your transcript and player will appear as soon as it is ready.</p>
            <div className="simulator-audio-compile-progress">
              <div className="simulator-audio-compile-progress-label"><span>Compiling audio turns</span><span>{audioCompileProgress.total ? `${audioCompileProgress.completed} of ${audioCompileProgress.total}` : 'Preparing turns…'}</span></div>
              <div className="simulator-audio-compile-progress-track" role="progressbar" aria-label="Audio compilation progress" aria-valuemin={0} aria-valuemax={audioCompileProgress.total || 1} aria-valuenow={audioCompileProgress.completed}>
                <span style={{ width: `${audioCompileProgress.total ? audioCompileProgress.completed / audioCompileProgress.total * 100 : 0}%` }} />
              </div>
              <span className="simulator-audio-compile-note"><LoaderCircle className="spin-icon" size={14} /> This can take a moment for longer sessions.</span>
            </div>
          </motion.div>
        )}

        {phase === 'evaluating' && (
          <motion.div key="evaluating" {...transition} transition={{ duration: shouldReduceMotion ? 0 : 0.2 }} className="evaluation-pending">
            <div className="evaluating-animation"><Sparkles size={26} /></div><h2>Speakia is assessing your speaking.</h2><p>Using your compiled conversation audio to assess with {getAssessmentModelLabel(assessmentModel)}. Keep this page open.</p><div className="evaluation-pending-duration"><Clock3 size={15} /> Assessment time · {formatAssessmentDuration(assessmentElapsedMs)} <span aria-hidden="true">·</span> {getAssessmentModelLabel(assessmentModel)}</div><div className="evaluation-pending-steps"><span><Check size={15} /> Practice recording captured</span><span className="pending-step-active"><LoaderCircle className="spin-icon" size={15} /> Speakia assessment in progress</span></div>
          </motion.div>
        )}
      </AnimatePresence>
      {showDiscardConfirmation && <div className="signout-dialog-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setShowDiscardConfirmation(false)
      }}>
        <section className="signout-dialog simulator-discard-dialog" role="alertdialog" aria-modal="true" aria-labelledby="discard-session-title" aria-describedby="discard-session-description">
          <div className="signout-dialog-icon"><Trash2 size={20} /></div>
          <h2 id="discard-session-title">Discard this practice session?</h2>
          <p id="discard-session-description">Its recording and transcript will not be saved or assessed.</p>
          <div>
            <Button type="button" variant="outline" autoFocus onClick={() => setShowDiscardConfirmation(false)}>Keep practicing</Button>
            <Button type="button" className="signout-confirm-button" disabled={isDiscarding} onClick={() => void discardSession()}>Discard session</Button>
          </div>
        </section>
      </div>}
    </div>
  )
}
