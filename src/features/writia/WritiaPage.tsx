import { useCallback, useEffect, useRef, useState } from 'react'
import { Modality, Type, type FunctionCall, type FunctionDeclaration, type LiveServerMessage, type Session } from '@google/genai'
import { GoogleGenAI } from '@/lib/geminiClient'
import { getProdiaLiveModel } from '@/lib/geminiModels'
import { BookOpen, Check, CircleHelp, Compass, Lightbulb, LoaderCircle, Mic, Mic2, MicOff, PenLine, RefreshCw, Settings, Sparkles, Square, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { practicePromptsForPart } from '@/features/practiceModes/questions'
import type { SpeakingPrompt } from '@/features/simulator/questions'
import { mergeTranscriptText } from '@/features/simulator/transcript'
import { reportGeminiQuota } from '@/lib/geminiQuota'

type PracticePart = 'all' | 'part1' | 'part2' | 'part3'
type WritiaCoachLanguage = 'Urdu' | 'English' | 'Pakistani Punjabi' | 'Code Switching'
type WritiaState = 'idle' | 'connecting' | 'live'
type SpeakingCriterionId = 'fluency_coherence' | 'lexical_resource' | 'grammatical_range_accuracy' | 'pronunciation'
type SpeakingCriterionStatus = 'strength' | 'developing' | 'focus' | 'not_observed'
type WritiaFeedback = { id: string; text: string; createdAt: number }
type SentenceAlternative = { text: string; nuance: string }
type VocabularyHint = { phrase: string; meaning: string; example: string; useWhen: string }
type AnswerPlanStep = { label: string; guidance: string; sampleStarter: string }
type WritingIssue = {
  category: string
  originalText: string
  suggestion: string
  replacementText: string
}
type WritingReview = { summary: string; issues: WritingIssue[]; targetBand: string }
type SpeakingCriterionFeedback = {
  criterion: SpeakingCriterionId
  status: SpeakingCriterionStatus
  evidence: string
  nextStep: string
}
type RevisionContext = { targetText: string; start: number; end: number; draft: string; questionId: string }
type SavedWritiaData = {
  questionId: string
  part: PracticePart
  drafts: Record<string, string>
}

const questions: SpeakingPrompt[] = [
  ...practicePromptsForPart('part1'),
  ...practicePromptsForPart('part2'),
  ...practicePromptsForPart('part3'),
]
const questionById = new Map(questions.map((question) => [question.id, question]))
const storagePrefix = 'speakia-writia-v1'
const MAX_DRAFT_LENGTH = 12000
const MAX_SENTENCE_ALTERNATIVES = 4
const MAX_VOCABULARY_HINTS = 5
const MAX_WRITING_ISSUES = 8
const speakingCriteria: Array<{ id: SpeakingCriterionId; label: string; shortLabel: string; description: string }> = [
  { id: 'fluency_coherence', label: 'Fluency & Coherence', shortLabel: 'Flow', description: 'Develop ideas clearly and connect them naturally.' },
  { id: 'lexical_resource', label: 'Lexical Resource', shortLabel: 'Vocabulary', description: 'Choose precise, flexible words that fit your meaning.' },
  { id: 'grammatical_range_accuracy', label: 'Grammatical Range & Accuracy', shortLabel: 'Grammar', description: 'Build varied, accurate sentences for spoken English.' },
  { id: 'pronunciation', label: 'Pronunciation', shortLabel: 'Pronunciation', description: 'Rehearse aloud for clear, natural delivery.' },
]
const guidedStages = [
  { title: 'Find your point', detail: 'Answer the question directly with one main idea.' },
  { title: 'Build the idea', detail: 'Add a reason, example, or personal detail.' },
  { title: 'Shape the language', detail: 'Make the response clear, natural, and precise.' },
  { title: 'Rehearse aloud', detail: 'Practise the answer as a spoken response.' },
  { title: 'Review & reflect', detail: 'Use the four criteria to choose your next step.' },
]

const replaceWritingTextTool: FunctionDeclaration = {
  name: 'replace_writing_text',
  description: 'Replace only the exact text the learner explicitly asked you to improve. Keep the learner’s meaning and personal details, and use natural spoken English. Never call this tool during automatic feedback.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      targetText: { type: Type.STRING, description: 'The exact current selected text or complete draft to replace.' },
      replacementText: { type: Type.STRING, description: 'The improved text, preserving the learner’s intended meaning.' },
      feedback: { type: Type.STRING, description: 'A brief explanation of the most useful improvement.' },
    },
    required: ['targetText', 'replacementText', 'feedback'],
  },
}

const sentenceAlternativesTool: FunctionDeclaration = {
  name: 'provide_sentence_alternatives',
  description: 'Return a refined version and multiple natural paraphrases of the learner-selected sentence. Keep the same meaning, nuance, context, and personal details. Do not edit the pad; show options for the learner to choose.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      targetText: { type: Type.STRING, description: 'The exact sentence or selected text the learner asked to rephrase.' },
      refinedSentence: { type: Type.STRING, description: 'The best polished version, natural for spoken IELTS.' },
      explanation: { type: Type.STRING, description: 'Brief explanation of the improvement.' },
      alternatives: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: 'A distinct alternative sentence with the same meaning.' },
            nuance: { type: Type.STRING, description: 'Brief note about its tone or emphasis.' },
          },
          required: ['text', 'nuance'],
        },
      },
    },
    required: ['targetText', 'refinedSentence', 'explanation', 'alternatives'],
  },
}

const vocabularyHintsTool: FunctionDeclaration = {
  name: 'provide_vocabulary_hints',
  description: 'Provide concise, natural IELTS Speaking vocabulary and phrases that fit the current prompt and writing context. Avoid forced or overly formal wording. This tool displays suggestions; it never edits the writing pad.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      hints: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            phrase: { type: Type.STRING, description: 'A useful word, collocation, or spoken phrase.' },
            meaning: { type: Type.STRING, description: 'A plain-English meaning or nuance.' },
            example: { type: Type.STRING, description: 'A short example in the current answer context.' },
            useWhen: { type: Type.STRING, description: 'Where or how the learner could use it in their answer.' },
          },
          required: ['phrase', 'meaning', 'example', 'useWhen'],
        },
      },
    },
    required: ['hints'],
  },
}

const writingReviewTool: FunctionDeclaration = {
  name: 'review_writing',
  description: 'Return an opt-in IELTS Speaking writing-aid review of the learner’s exact current draft for the selected target band. Identify specific, high-value grammar, clarity, spoken-naturalness, vocabulary, cohesion, and idea-development opportunities. Give concise explanations and optional text replacements that preserve the learner’s ideas and personal details. Do not claim an official score or guarantee a band. Quote exact existing text for each issue. For development suggestions that require new personal details, provide guidance only and leave replacementText empty. Do not edit the pad; show suggestions for the learner to choose.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: 'A concise, encouraging overview of the strongest next improvement for this answer.' },
      issues: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: 'One of Grammar, Clarity, Spoken style, Vocabulary, Cohesion, or Idea development.' },
            originalText: { type: Type.STRING, description: 'An exact phrase or sentence from the current writing pad to anchor this suggestion.' },
            suggestion: { type: Type.STRING, description: 'A brief explanation or actionable next step.' },
            replacementText: { type: Type.STRING, description: 'Optional exact replacement text for originalText; use an empty string when guidance is preferable to rewriting.' },
          },
          required: ['category', 'originalText', 'suggestion', 'replacementText'],
        },
      },
    },
    required: ['summary', 'issues'],
  },
}

const speakingCriteriaTool: FunctionDeclaration = {
  name: 'review_speaking_criteria',
  description: 'Give diagnostic, non-official learning feedback against all four IELTS Speaking assessment criteria. Keep each judgement grounded in the supplied answer. Do not give an estimated IELTS band. Pronunciation must be marked not_observed unless the learner supplied an actual spoken rehearsal in this live session.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      criteria: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            criterion: { type: Type.STRING, description: 'One of fluency_coherence, lexical_resource, grammatical_range_accuracy, pronunciation.' },
            status: { type: Type.STRING, description: 'One of strength, developing, focus, not_observed. Never use a numeric band.' },
            evidence: { type: Type.STRING, description: 'A concise observation grounded in the supplied writing or spoken rehearsal.' },
            nextStep: { type: Type.STRING, description: 'One practical corrective practice step for the learner.' },
          },
          required: ['criterion', 'status', 'evidence', 'nextStep'],
        },
      },
    },
    required: ['criteria'],
  },
}

const answerPlanTool: FunctionDeclaration = {
  name: 'provide_answer_plan',
  description: 'Create a short, flexible answer structure for the current IELTS Speaking prompt and the learner draft. Provide actionable development steps, not a full model answer.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'A concise title for the answer structure.' },
      steps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING, description: 'A short step label, such as Point, Reason, Example, or Reflection.' },
            guidance: { type: Type.STRING, description: 'Specific guidance for this learner and prompt.' },
            sampleStarter: { type: Type.STRING, description: 'A short sentence opening, not a complete model answer.' },
          },
          required: ['label', 'guidance', 'sampleStarter'],
        },
      },
    },
    required: ['title', 'steps'],
  },
}

const writeModelAnswerTool: FunctionDeclaration = {
  name: 'write_model_answer',
  description: 'Write a complete, natural spoken-style sample answer into the Writia writing pad only when the learner explicitly asks for a model, sample, or example answer. Preserve all existing learner text and append the model answer; never overwrite or silently replace the learner’s draft.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      answer: { type: Type.STRING, description: 'A complete, natural spoken-style answer to the current IELTS Speaking prompt.' },
    },
    required: ['answer'],
  },
}

const writeRequestedTextTool: FunctionDeclaration = {
  name: 'write_requested_text',
  description: 'Type or edit a sentence in the writing pad only when the learner has explicitly asked by speaking to the live coach. For a request to write/type/add a sentence, use mode "append" and preserve the learner’s wording when they dictate it. For a request to edit/replace an existing sentence, use mode "replace" and provide its exact current text as targetText. Never use this tool for automatic feedback, typed chat requests, or without a clear spoken command.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      mode: { type: Type.STRING, description: 'Use append to add a requested sentence, or replace to edit exact existing text.' },
      text: { type: Type.STRING, description: 'The sentence to type into the pad. For dictated text, preserve the learner’s words.' },
      targetText: { type: Type.STRING, description: 'For replace only, the exact sentence currently in the pad that the learner asked to edit.' },
    },
    required: ['mode', 'text'],
  },
}

function readSavedData(username: string): SavedWritiaData | null {
  try {
    const stored = localStorage.getItem(`${storagePrefix}:${username}`)
    if (!stored) return null
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Saved Writia data is invalid.')
    const record = parsed as Record<string, unknown>
    const drafts = record.drafts
    if (typeof record.questionId !== 'string' || !questionById.has(record.questionId)
      || !['all', 'part1', 'part2', 'part3'].includes(String(record.part))
      || typeof drafts !== 'object' || drafts === null || Array.isArray(drafts)
      || !Object.values(drafts).every((draft) => typeof draft === 'string')) {
      throw new Error('Saved Writia data is not in a supported format.')
    }
    return {
      questionId: record.questionId,
      part: record.part as PracticePart,
      drafts: drafts as Record<string, string>,
    }
  } catch (error) {
    console.error('Unable to load the saved Writia writing pad.', error)
    return null
  }
}

function saveWritiaData(username: string, data: SavedWritiaData): boolean {
  try {
    localStorage.setItem(`${storagePrefix}:${username}`, JSON.stringify(data))
    return true
  } catch (error) {
    console.error('Unable to save the Writia writing pad.', error)
    return false
  }
}

function randomQuestion(part: PracticePart, currentId?: string): SpeakingPrompt {
  const pool = part === 'all' ? questions : questions.filter((question) => question.part === part)
  const alternatives = pool.filter((question) => question.id !== currentId)
  const choices = alternatives.length ? alternatives : pool
  return choices[Math.floor(Math.random() * choices.length)]
}

function questionPartLabel(part: SpeakingPrompt['part']): string {
  return part === 'part1' ? 'Part 1 · Introduction & interview'
    : part === 'part2' ? 'Part 2 · Long turn'
      : 'Part 3 · Discussion'
}

function promptForQuestion(question: SpeakingPrompt): string {
  return `Topic: ${question.topic}\n${question.question}`
}

function languageDirection(language: WritiaCoachLanguage): string {
  if (language === 'Urdu') return 'Speak to and coach the learner in natural Pakistani Urdu, using Pakistani Urdu vocabulary, idiom, and pronunciation in Urdu Perso-Arabic script. Do not use Hindi vocabulary, Indian Hindi pronunciation, or Devanagari. Keep IELTS answer examples, suggested replacement sentences, and target phrases in natural English unless the learner asks to practise another language. Explain grammar, vocabulary meanings, and your feedback in Pakistani Urdu.'
  if (language === 'English') return 'Speak to and coach the learner in clear, supportive English. Keep IELTS answer examples and suggested replacement sentences in natural spoken English.'
  if (language === 'Pakistani Punjabi') return 'Speak to and coach the learner in natural Pakistani Punjabi, using Pakistani Punjabi vocabulary and pronunciation, preferably in Shahmukhi script. Do not use Indian Punjabi vocabulary, pronunciation, or Gurmukhi script. Keep IELTS answer examples and suggested replacement sentences in natural spoken English unless the learner asks to practise Punjabi.'
  return 'Naturally code-switch between English, Pakistani Urdu, and Pakistani Punjabi as a Pakistani IELTS coach would. Use Pakistani Urdu vocabulary and pronunciation (not Hindi) and Pakistani Punjabi vocabulary and pronunciation (not Indian Punjabi), using Urdu Perso-Arabic script for Urdu and Shahmukhi for Punjabi when writing. Keep IELTS answer examples and suggested replacement sentences in natural spoken English unless the learner asks to practise another language.'
}

function liveInstructions(question: SpeakingPrompt, language: WritiaCoachLanguage): string {
  return `You are Writia, an expert IELTS Speaking guided response-practice coach. The learner is rehearsing spoken answers in a writing pad, not doing IELTS Writing. Coach all four IELTS Speaking criteria: Fluency & Coherence (clear, extended, logically connected ideas); Lexical Resource (accurate, flexible, natural vocabulary); Grammatical Range & Accuracy (varied, controlled spoken sentence forms); and Pronunciation (intelligibility, sounds, word stress, rhythm, and connected speech, assessed only from live spoken audio). COACH LANGUAGE REQUIREMENT: ${languageDirection(language)} Use the current speaking prompt:\n${promptForQuestion(question)}\n\nGuide the learner step by step: elicit their main point, help them add a reason or example, improve spoken phrasing, rehearse aloud, then reflect on one next step. Ask one useful question at a time and let the learner do the thinking. Give diagnostic and corrective feedback tied to evidence and the four criteria. Never infer pronunciation from typed text; mark it not observed without spoken rehearsal. Target-band settings are practice direction only: never predict, guarantee, or report an official band score. Give brief, specific feedback as the learner writes, focusing on the newest wording or highest-impact issue. Do not interrupt every keystroke. When there is enough context, call provide_vocabulary_hints with 2–3 useful English phrases and explain their meaning/use in the selected coach language. Do not invent personal details. Never change the pad unless explicitly requested. For requested refinements, call replace_writing_text with exact target text and a meaning-preserving natural spoken revision. For paraphrases, call provide_sentence_alternatives and do not change the pad. For a flexible answer outline, call provide_answer_plan; do not give a full answer. For an explicitly requested full sample/model answer, call write_model_answer; it appends and visibly types without replacing the learner's draft. When the learner verbally asks you to add a sentence or edit an existing one, call write_requested_text only after a clear spoken command, preserving exact dictated wording or targeting the exact existing text; never make unrequested edits. For a four-criteria diagnostic request, call review_speaking_criteria with one grounded observation and one actionable next step for each of all four criteria. Use not_observed for pronunciation if no spoken rehearsal was supplied. Keep examples in natural spoken English, not formal essay language.`
}

function decodeBase64(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

function audioBufferFromPcm(context: AudioContext, pcm: ArrayBuffer, sampleRate: number): AudioBuffer {
  const samples = new Int16Array(pcm, 0, Math.floor(pcm.byteLength / 2))
  const audio = context.createBuffer(1, samples.length, sampleRate)
  const channel = audio.getChannelData(0)
  for (let index = 0; index < samples.length; index += 1) channel[index] = samples[index] / 32768
  return audio
}

function resampleTo16k(samples: Float32Array, sampleRate: number): Float32Array {
  if (sampleRate === 16000) return samples
  const targetLength = Math.max(1, Math.round(samples.length * 16000 / sampleRate))
  const resampled = new Float32Array(targetLength)
  for (let index = 0; index < targetLength; index += 1) {
    const sourceIndex = index * sampleRate / 16000
    const left = Math.floor(sourceIndex)
    const right = Math.min(left + 1, samples.length - 1)
    const fraction = sourceIndex - left
    resampled[index] = samples[left] + (samples[right] - samples[left]) * fraction
  }
  return resampled
}

function float32ToPcmBase64(samples: Float32Array): string {
  const buffer = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buffer)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

export function WritiaPage({ apiKey, username, onOpenSettings }: {
  apiKey: string
  username: string
  onOpenSettings: () => void
}) {
  const [savedData] = useState(() => readSavedData(username))
  const [part, setPart] = useState<PracticePart>(savedData?.part ?? 'all')
  const [question, setQuestion] = useState<SpeakingPrompt>(() => questionById.get(savedData?.questionId ?? '') ?? randomQuestion(savedData?.part ?? 'all'))
  const [drafts, setDrafts] = useState<Record<string, string>>(savedData?.drafts ?? {})
  const [draft, setDraft] = useState(() => savedData?.drafts[question.id] ?? '')
  const [state, setState] = useState<WritiaState>('idle')
  const [micMuted, setMicMuted] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [status, setStatus] = useState('')
  const [feedback, setFeedback] = useState<WritiaFeedback[]>([])
  const [coachText, setCoachText] = useState('')
  const [pending, setPending] = useState(false)
  const [coachWriting, setCoachWriting] = useState(false)
  const [alternatives, setAlternatives] = useState<SentenceAlternative[]>([])
  const [refinedSentence, setRefinedSentence] = useState('')
  const [alternativeOriginal, setAlternativeOriginal] = useState('')
  const [alternativeExplanation, setAlternativeExplanation] = useState('')
  const [targetBand, setTargetBand] = useState('7.0')
  const [coachLanguage, setCoachLanguage] = useState<WritiaCoachLanguage>('Urdu')
  const [writingReview, setWritingReview] = useState<WritingReview | null>(null)
  const [criteriaFeedback, setCriteriaFeedback] = useState<SpeakingCriterionFeedback[]>([])
  const [activeStage, setActiveStage] = useState(0)
  const [isRehearsing, setIsRehearsing] = useState(false)
  const [spokenSample, setSpokenSample] = useState('')
  const [vocabularyHints, setVocabularyHints] = useState<VocabularyHint[]>([])
  const [answerPlan, setAnswerPlan] = useState<{ title: string; steps: AnswerPlanStep[] } | null>(null)
  const [coachQuestion, setCoachQuestion] = useState('')
  const [lastCoachTask, setLastCoachTask] = useState('')
  const targetBandRef = useRef(targetBand)
  const coachLanguageRef = useRef<WritiaCoachLanguage>(coachLanguage)
  const sessionRef = useRef<Session | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const nextAudioTimeRef = useRef(0)
  const connectedRef = useRef(false)
  const connectingRef = useRef(false)
  const micMutedRef = useRef(false)
  const coachBusyRef = useRef(false)
  const draftRef = useRef(draft)
  const draftsRef = useRef(drafts)
  const partRef = useRef(part)
  const questionRef = useRef(question)
  const vocabularyHintsRef = useRef<VocabularyHint[]>([])
  const queuedDraftRef = useRef<string | null>(null)
  const lastSentDraftRef = useRef('')
  const feedbackTextRef = useRef('')
  const pendingRevisionRef = useRef<RevisionContext | null>(null)
  const pendingAlternativesRef = useRef<RevisionContext | null>(null)
  const pendingWritingReviewRef = useRef<RevisionContext | null>(null)
  const pendingCriteriaReviewRef = useRef<{ questionId: string; draft: string; spokenSample: string } | null>(null)
  const pendingModelAnswerRef = useRef<{ questionId: string; draft: string } | null>(null)
  const voiceCommandRef = useRef<{ text: string; receivedAt: number; questionId: string } | null>(null)
  const voiceTranscriptDraftRef = useRef('')
  const rehearsalActiveRef = useRef(false)
  const rehearsalTranscriptRef = useRef('')
  const spokenSampleRef = useRef('')
  const editorRef = useRef<HTMLTextAreaElement | null>(null)
  const guidedDisclosureRef = useRef<HTMLDetailsElement | null>(null)
  const criteriaDisclosureRef = useRef<HTMLDetailsElement | null>(null)
  const debounceRef = useRef<number | null>(null)
  const coachTypingTimerRef = useRef<number | null>(null)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const microphoneSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const microphoneCaptureRef = useRef<AudioWorkletNode | null>(null)
  const microphoneGainRef = useRef<GainNode | null>(null)

  useEffect(() => { draftRef.current = draft }, [draft])
  useEffect(() => { questionRef.current = question }, [question])
  useEffect(() => {
    if (criteriaFeedback.length && criteriaDisclosureRef.current) criteriaDisclosureRef.current.open = true
  }, [criteriaFeedback])

  const stopMicrophone = useCallback(() => {
    const capture = microphoneCaptureRef.current
    microphoneCaptureRef.current = null
    if (capture) {
      capture.port.onmessage = null
      capture.port.close()
      capture.disconnect()
    }
    microphoneSourceRef.current?.disconnect()
    microphoneSourceRef.current = null
    microphoneGainRef.current?.disconnect()
    microphoneGainRef.current = null
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop())
    microphoneStreamRef.current = null
    micMutedRef.current = false
    setMicMuted(false)
  }, [])

  const toggleMicMuted = useCallback(() => {
    const nextMuted = !micMutedRef.current
    micMutedRef.current = nextMuted
    setMicMuted(nextMuted)
    for (const track of microphoneStreamRef.current?.getAudioTracks() ?? []) track.enabled = !nextMuted
    if (nextMuted) {
      voiceCommandRef.current = null
      voiceTranscriptDraftRef.current = ''
      try {
        sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true })
        setStatus('Microphone muted · no room audio is being sent')
      } catch (caughtError) {
        console.error('Unable to close Writia microphone input before muting.', caughtError)
        setError('The microphone is muted locally, but the live audio input could not be closed cleanly.')
      }
    } else {
      setStatus(isRehearsing ? 'Microphone on · continue your speaking rehearsal' : 'Microphone on · listening for spoken coaching requests')
      setError('')
    }
  }, [isRehearsing])

  const persistDraft = useCallback((value: string) => {
    const next = value.slice(0, MAX_DRAFT_LENGTH)
    const nextDrafts = { ...draftsRef.current, [questionRef.current.id]: next }
    draftsRef.current = nextDrafts
    draftRef.current = next
    setDraft(next)
    setDrafts(nextDrafts)
    setSaveError(saveWritiaData(username, { questionId: questionRef.current.id, part: partRef.current, drafts: nextDrafts })
      ? ''
      : 'Your draft could not be saved on this device.')
  }, [username])

  const typeModelAnswer = useCallback((answer: string, questionId: string) => {
    if (coachTypingTimerRef.current !== null) {
      setError('Writia is still typing the previous model answer. Let it finish before requesting another.')
      return false
    }
    const currentDraft = draftRef.current
    const prefix = `${currentDraft.trim() ? '\n\n' : ''}Model answer:\n`
    if (currentDraft.length + prefix.length + answer.length > MAX_DRAFT_LENGTH) {
      setError('The model answer would exceed the writing pad limit. Clear some text or ask Writia for a shorter answer.')
      return false
    }
    pendingModelAnswerRef.current = null
    setWritingReview(null)
    persistDraft(`${currentDraft}${prefix}`)
    setCoachWriting(true)
    setStatus('Writia is typing a model answer into your writing pad…')
    setLastCoachTask('Writia is typing a model answer into your writing pad. Your existing writing is preserved.')
    const words = answer.match(/\S+\s*/g) ?? []
    let wordIndex = 0
    const typeNextWord = () => {
      if (questionRef.current.id !== questionId) {
        setCoachWriting(false)
        coachTypingTimerRef.current = null
        return
      }
      if (wordIndex >= words.length) {
        setCoachWriting(false)
        coachTypingTimerRef.current = null
        setStatus('Model answer added · review and adapt it in your own voice')
        setLastCoachTask('Writia finished typing the model answer. Compare its structure and wording, then adapt it in your own voice.')
        return
      }
      persistDraft(`${draftRef.current}${words[wordIndex]}`)
      wordIndex += 1
      window.requestAnimationFrame(() => {
        const editor = editorRef.current
        if (!editor) return
        editor.setSelectionRange(editor.value.length, editor.value.length)
        editor.scrollTop = editor.scrollHeight
      })
      coachTypingTimerRef.current = window.setTimeout(typeNextWord, 75)
    }
    coachTypingTimerRef.current = window.setTimeout(typeNextWord, 75)
    return true
  }, [persistDraft])

  const typeRequestedText = useCallback((text: string, mode: 'append' | 'replace', targetText: string, questionId: string) => {
    if (coachTypingTimerRef.current !== null) {
      setError('Writia is still typing the previous text. Let it finish before requesting another edit.')
      return false
    }
    const currentDraft = draftRef.current
    let start = currentDraft.length
    let end = currentDraft.length
    let before = currentDraft
    let after = ''
    if (mode === 'replace') {
      if (!targetText) {
        setError('Writia needs the exact sentence to edit. Say which sentence you want changed and what to change it to.')
        return false
      }
      start = currentDraft.indexOf(targetText)
      if (start < 0 || currentDraft.indexOf(targetText, start + targetText.length) >= 0) {
        setError('Writia could not find one unique match for the sentence to edit. Read the exact sentence aloud and try again.')
        return false
      }
      end = start + targetText.length
      before = currentDraft.slice(0, start)
      after = currentDraft.slice(end)
    } else if (currentDraft && !/\s$/.test(currentDraft)) {
      before = `${currentDraft} `
      start = before.length
    }
    if (before.length + text.length + after.length > MAX_DRAFT_LENGTH) {
      setError('The requested sentence would exceed the writing pad limit. Remove some text and try again.')
      return false
    }
    const words = text.match(/\S+\s*/g) ?? []
    if (!words.length) {
      setError('Writia did not receive a sentence to type. Please say the sentence again.')
      return false
    }
    const insertionStart = start
    setWritingReview(null)
    persistDraft(`${before}${after}`)
    setCoachWriting(true)
    setError('')
    setStatus(mode === 'replace' ? 'Writia is typing your requested edit…' : 'Writia is typing your requested sentence…')
    setLastCoachTask(mode === 'replace'
      ? 'Writia is editing the exact sentence you requested in the writing pad.'
      : 'Writia is typing the sentence you requested into the writing pad.')
    let wordIndex = 0
    let typedText = ''
    const typeNextWord = () => {
      if (questionRef.current.id !== questionId) {
        setCoachWriting(false)
        coachTypingTimerRef.current = null
        return
      }
      if (wordIndex >= words.length) {
        setCoachWriting(false)
        coachTypingTimerRef.current = null
        setStatus(mode === 'replace' ? 'Requested edit complete · review the updated sentence' : 'Requested sentence added · review it in your answer')
        setLastCoachTask(mode === 'replace'
          ? 'Writia finished typing your requested edit. Review the updated sentence in your answer.'
          : 'Writia finished typing your requested sentence. Review it in your answer.')
        window.requestAnimationFrame(() => {
          const editor = editorRef.current
          if (!editor) return
          editor.setSelectionRange(insertionStart + typedText.length, insertionStart + typedText.length)
          editor.scrollTop = editor.scrollHeight
        })
        return
      }
      typedText += words[wordIndex]
      persistDraft(`${before}${typedText}${after}`)
      wordIndex += 1
      window.requestAnimationFrame(() => {
        const editor = editorRef.current
        if (!editor) return
        const cursor = insertionStart + typedText.length
        editor.setSelectionRange(cursor, cursor)
        editor.scrollTop = editor.scrollHeight
      })
      coachTypingTimerRef.current = window.setTimeout(typeNextWord, 65)
    }
    coachTypingTimerRef.current = window.setTimeout(typeNextWord, 65)
    return true
  }, [persistDraft])

  const sendUserTurn = useCallback((text: string) => {
    const session = sessionRef.current
    if (!session || !connectedRef.current) {
      setError('The Writia live coach is disconnected. Reconnect and try again.')
      return false
    }
    try {
      coachBusyRef.current = true
      setPending(true)
      session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      })
      return true
    } catch (caughtError) {
      coachBusyRef.current = false
      setPending(false)
      console.error('Unable to send a writing update to Writia Live.', caughtError)
      reportGeminiQuota(caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to send this update to Writia.')
      return false
    }
  }, [])

  const handleToolCalls = useCallback((functionCalls: FunctionCall[]) => {
    const session = sessionRef.current
    if (!session) return
    const functionResponses: Array<{ id?: string; name?: string; response: Record<string, unknown> }> = functionCalls.map((call) => {
      if (![replaceWritingTextTool, sentenceAlternativesTool, vocabularyHintsTool, writingReviewTool, speakingCriteriaTool, answerPlanTool, writeModelAnswerTool, writeRequestedTextTool].some((tool) => tool.name === call.name)) {
        return { id: call.id, name: call.name, response: { error: 'Unsupported Writia action.' } }
      }
      const args = call.args
      if (call.name === writeRequestedTextTool.name) {
        const authorization = voiceCommandRef.current
        voiceCommandRef.current = null
        const mode = args?.mode === 'replace' ? 'replace' : args?.mode === 'append' ? 'append' : null
        const text = typeof args?.text === 'string' ? args.text.trim() : ''
        const targetText = typeof args?.targetText === 'string' ? args.targetText.trim() : ''
        const command = authorization?.text ?? ''
        const asksToWrite = /\b(?:write|type|put|add|insert|compose|draft|generate|create|formulate|include|place)\b/i.test(command)
          || /\b(?:give|provide)\s+me\s+(?:a|the)\s+sentence\b/i.test(command)
        const asksToEdit = /\b(?:edit|replace|change|rewrite|update|improve|correct|polish|fix)\b/i.test(command)
        if (!authorization || authorization.questionId !== questionRef.current.id || Date.now() - authorization.receivedAt > 120000
          || !mode || !text || text.length > 1600
          || (mode === 'append' && !asksToWrite)
          || (mode === 'replace' && (!asksToEdit || !targetText))) {
          return { id: call.id, name: call.name, response: { error: 'The learner has not made a clear, recent spoken request to write or edit this text. Ask them to say exactly what they want added or changed.' } }
        }
        const started = typeRequestedText(text, mode, targetText, authorization.questionId)
        return { id: call.id, name: call.name, response: started
          ? { status: 'success', message: 'The learner-requested text is being typed visibly into the writing pad.' }
          : { error: 'The requested sentence could not be typed into the writing pad. Check the pad and retry.' } }
      }
      if (call.name === writeModelAnswerTool.name) {
        const authorization = pendingModelAnswerRef.current
        const answer = typeof args?.answer === 'string' ? args.answer.trim() : ''
        pendingModelAnswerRef.current = null
        if (!authorization || authorization.questionId !== questionRef.current.id || authorization.draft !== draftRef.current) {
          return { id: call.id, name: call.name, response: { error: 'The learner has not explicitly requested a model answer for this unchanged draft. Ask before writing one.' } }
        }
        if (!answer || answer.length > MAX_DRAFT_LENGTH) {
          return { id: call.id, name: call.name, response: { error: 'The model answer is empty or too long. Provide a concise answer that fits the writing pad.' } }
        }
        const started = typeModelAnswer(answer, authorization.questionId)
        return { id: call.id, name: call.name, response: started
          ? { status: 'success', message: 'The model answer is being typed into the pad after the learner’s existing writing.' }
          : { error: 'The model answer would exceed the writing pad limit.' } }
      }
      if (call.name === sentenceAlternativesTool.name) {
        const context = pendingAlternativesRef.current
        const targetText = typeof args?.targetText === 'string' ? args.targetText : ''
        const refined = typeof args?.refinedSentence === 'string' ? args.refinedSentence.trim() : ''
        const explanation = typeof args?.explanation === 'string' ? args.explanation.trim() : ''
        const rawAlternatives = Array.isArray(args?.alternatives) ? args.alternatives : []
        if (!context || context.questionId !== questionRef.current.id || targetText !== context.targetText
          || draftRef.current.slice(context.start, context.end) !== context.targetText || !refined) {
          return { id: call.id, name: call.name, response: { error: 'The selected sentence has changed. Ask Writia for alternatives again using the current text.' } }
        }
        const safeAlternatives = rawAlternatives
          .filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null)
          .map((value) => ({
            text: typeof value.text === 'string' ? value.text.trim() : '',
            nuance: typeof value.nuance === 'string' ? value.nuance.trim() : '',
          }))
          .filter((value) => value.text && value.text !== targetText && value.text.length <= 1600)
          .slice(0, MAX_SENTENCE_ALTERNATIVES)
        if (refined.length > 1600 || !safeAlternatives.length) {
          return { id: call.id, name: call.name, response: { error: 'Writia could not prepare distinct alternatives for the selected sentence. Try selecting one complete sentence.' } }
        }
        pendingAlternativesRef.current = context
        setAlternativeOriginal(targetText)
        setRefinedSentence(refined)
        setAlternatives(safeAlternatives)
        setAlternativeExplanation(explanation)
        setLastCoachTask('Sentence alternatives are ready. Compare the refined sentence with the other options, then choose what sounds like you.')
        return { id: call.id, name: call.name, response: { status: 'success', alternativeCount: safeAlternatives.length + 1 } }
      }
      if (call.name === vocabularyHintsTool.name) {
        const rawHints = Array.isArray(args?.hints) ? args.hints : []
        const parsedHints = rawHints
          .filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null)
          .map((value) => ({
            phrase: typeof value.phrase === 'string' ? value.phrase.trim() : '',
            meaning: typeof value.meaning === 'string' ? value.meaning.trim() : '',
            example: typeof value.example === 'string' ? value.example.trim() : '',
            useWhen: typeof value.useWhen === 'string' ? value.useWhen.trim() : '',
          }))
          .filter((value) => value.phrase && value.meaning && value.example)
          .slice(0, MAX_VOCABULARY_HINTS)
        const existing = new Set(vocabularyHintsRef.current.map((hint) => hint.phrase.toLocaleLowerCase()))
        const freshHints = parsedHints.filter((hint) => !existing.has(hint.phrase.toLocaleLowerCase()))
        if (freshHints.length) {
          const nextHints = [...freshHints, ...vocabularyHintsRef.current].slice(0, MAX_VOCABULARY_HINTS)
          vocabularyHintsRef.current = nextHints
          setVocabularyHints(nextHints)
        }
        setLastCoachTask(freshHints.length ? 'Context-fit vocabulary suggestions are ready. Use only the phrases that feel natural to you.' : 'Writia checked for vocabulary suggestions and avoided repeating earlier phrases.')
        return { id: call.id, name: call.name, response: { status: 'success', shown: freshHints.length } }
      }
      if (call.name === writingReviewTool.name) {
        const context = pendingWritingReviewRef.current
        pendingWritingReviewRef.current = null
        const summary = typeof args?.summary === 'string' ? args.summary.trim() : ''
        const rawIssues = Array.isArray(args?.issues) ? args.issues : []
        if (!context || context.questionId !== questionRef.current.id || context.draft !== draftRef.current) {
          return { id: call.id, name: call.name, response: { error: 'The writing changed while the review was being prepared. Review the current draft again so suggestions match it.' } }
        }
        const issues = rawIssues
          .filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null)
          .map((value) => ({
            category: typeof value.category === 'string' ? value.category.trim() : '',
            originalText: typeof value.originalText === 'string' ? value.originalText.trim() : '',
            suggestion: typeof value.suggestion === 'string' ? value.suggestion.trim() : '',
            replacementText: typeof value.replacementText === 'string' ? value.replacementText.trim() : '',
          }))
          .filter((issue) => issue.category && issue.originalText && issue.suggestion
            && issue.category.length <= 50 && issue.suggestion.length <= 500
            && issue.replacementText.length <= 1600
            && context.draft.includes(issue.originalText))
          .slice(0, MAX_WRITING_ISSUES)
        if (!summary || !issues.length) {
          return { id: call.id, name: call.name, response: { error: 'Writia could not create a review anchored to the current answer. Try again with a few complete sentences.' } }
        }
        const reviewBand = targetBandRef.current
        setWritingReview({ summary, issues, targetBand: reviewBand })
        setLastCoachTask(`Writing check ready · suggestions are tailored toward IELTS Speaking Band ${reviewBand}. Choose which, if any, to apply.`)
        return { id: call.id, name: call.name, response: { status: 'success', issueCount: issues.length } }
      }
      if (call.name === speakingCriteriaTool.name) {
        const context = pendingCriteriaReviewRef.current
        pendingCriteriaReviewRef.current = null
        if (!context || context.questionId !== questionRef.current.id || context.draft !== draftRef.current
          || context.spokenSample !== spokenSampleRef.current) {
          return { id: call.id, name: call.name, response: { error: 'The learner’s response changed during the criteria check. Run a fresh review against the current answer.' } }
        }
        const rawCriteria = Array.isArray(args?.criteria) ? args.criteria : []
        const allowedIds = new Set(speakingCriteria.map((criterion) => criterion.id))
        const parsed = rawCriteria
          .filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null)
          .map((value) => ({
            criterion: typeof value.criterion === 'string' ? value.criterion : '',
            status: typeof value.status === 'string' ? value.status : '',
            evidence: typeof value.evidence === 'string' ? value.evidence.trim() : '',
            nextStep: typeof value.nextStep === 'string' ? value.nextStep.trim() : '',
          }))
          .filter((value): value is SpeakingCriterionFeedback =>
            allowedIds.has(value.criterion as SpeakingCriterionId)
            && ['strength', 'developing', 'focus', 'not_observed'].includes(value.status)
            && Boolean(value.evidence && value.nextStep))
        const unique = new Map(parsed.map((item) => [item.criterion, item]))
        if (speakingCriteria.some((criterion) => !unique.has(criterion.id))) {
          return { id: call.id, name: call.name, response: { error: 'The review must include grounded feedback for all four Speaking criteria.' } }
        }
        const results = speakingCriteria.map((criterion) => unique.get(criterion.id)!)
        if (!spokenSampleRef.current.trim()) {
          const fluency = results.find((item) => item.criterion === 'fluency_coherence')!
          fluency.status = 'not_observed'
          fluency.evidence = 'Written coherence can be reviewed, but spoken fluency (such as pace, pausing, and self-correction) was not observed.'
          fluency.nextStep = 'Rehearse the answer aloud and run the four-criteria check again.'
          results.find((item) => item.criterion === 'pronunciation')!.status = 'not_observed'
          results.find((item) => item.criterion === 'pronunciation')!.evidence = 'No spoken rehearsal was supplied, so pronunciation cannot be evaluated from typed text.'
          results.find((item) => item.criterion === 'pronunciation')!.nextStep = 'Read your answer aloud, then run the four-criteria check again.'
        }
        setCriteriaFeedback(results)
        setLastCoachTask('Your four-criteria learning check is ready. These are practice observations, not an official score.')
        return { id: call.id, name: call.name, response: { status: 'success', criteriaCount: results.length } }
      }
      if (call.name === answerPlanTool.name) {
        const rawSteps = Array.isArray(args?.steps) ? args.steps : []
        const steps = rawSteps
          .filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null)
          .map((value) => ({
            label: typeof value.label === 'string' ? value.label.trim() : '',
            guidance: typeof value.guidance === 'string' ? value.guidance.trim() : '',
            sampleStarter: typeof value.sampleStarter === 'string' ? value.sampleStarter.trim() : '',
          }))
          .filter((value) => value.label && value.guidance && value.sampleStarter)
          .slice(0, 5)
        const title = typeof args?.title === 'string' ? args.title.trim() : ''
        if (!steps.length) return { id: call.id, name: call.name, response: { error: 'Writia could not build a usable answer plan. Try again with the current prompt.' } }
        setAnswerPlan({ title: title || 'Build your answer', steps })
        setLastCoachTask('Your answer map is ready. Use it as a flexible guide, not a script.')
        return { id: call.id, name: call.name, response: { status: 'success', stepCount: steps.length } }
      }
      if (call.name === replaceWritingTextTool.name) {
        const targetText = typeof args?.targetText === 'string' ? args.targetText : ''
        const replacementText = typeof args?.replacementText === 'string' ? args.replacementText.trim() : ''
        const explanation = typeof args?.feedback === 'string' ? args.feedback.trim() : ''
        const pendingRevision = pendingRevisionRef.current
        const currentDraft = draftRef.current
        if (replacementText.length > MAX_DRAFT_LENGTH) {
          return { id: call.id, name: call.name, response: { error: 'The suggested revision is too long for the writing pad. Provide a shorter revision.' } }
        }
        if (!targetText || !replacementText || !pendingRevision || pendingRevision.questionId !== questionRef.current.id || targetText !== pendingRevision.targetText) {
          return { id: call.id, name: call.name, response: { error: 'The requested revision did not match the active learner request. Ask the learner to request the refinement again.' } }
        }
        let updatedDraft: string | null = null
        if (currentDraft === pendingRevision.draft && targetText === pendingRevision.draft) {
          updatedDraft = replacementText
        } else if (currentDraft.slice(pendingRevision.start, pendingRevision.end) === targetText) {
          updatedDraft = `${currentDraft.slice(0, pendingRevision.start)}${replacementText}${currentDraft.slice(pendingRevision.end)}`
        }
        if (updatedDraft === null) {
          return { id: call.id, name: call.name, response: { error: 'The writing changed while the revision was being prepared. Nothing was replaced; use the current draft and try again.' } }
        }
        pendingRevisionRef.current = null
        setWritingReview(null)
        const nextDrafts = { ...draftsRef.current, [questionRef.current.id]: updatedDraft }
        draftsRef.current = nextDrafts
        draftRef.current = updatedDraft
        setDrafts(nextDrafts)
        setDraft(updatedDraft)
        setSaveError(saveWritiaData(username, { questionId: questionRef.current.id, part: partRef.current, drafts: nextDrafts })
          ? ''
          : 'Your draft could not be saved on this device.')
        setFeedback((current) => [{
          id: crypto.randomUUID(),
          text: explanation || 'Writia refined the requested text while preserving your meaning.',
          createdAt: Date.now(),
        }, ...current].slice(0, 8))
        setLastCoachTask('Your requested refinement is in the writing pad. Review it and keep or change anything you like.')
        return { id: call.id, name: call.name, response: { status: 'success', message: 'The requested text was updated in the writing pad.' } }
      }
      return { id: call.id, name: call.name, response: { error: 'Unsupported Writia action.' } }
    })
    try {
      session.sendToolResponse({ functionResponses })
    } catch (caughtError) {
      console.error('Unable to return Writia’s text revision result to Speakia AI Live.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Writia could not apply the requested revision.')
    }
  }, [typeModelAnswer, typeRequestedText, username])

  const handleMessage = useCallback((message: LiveServerMessage) => {
    const inputTranscription = message.serverContent?.inputTranscription
    if (!micMutedRef.current && inputTranscription?.text) {
      if (rehearsalActiveRef.current) {
        if (inputTranscription.finished === false) {
          rehearsalTranscriptRef.current = mergeTranscriptText(rehearsalTranscriptRef.current, inputTranscription.text)
        } else {
          const finalText = mergeTranscriptText(rehearsalTranscriptRef.current, inputTranscription.text)
          rehearsalTranscriptRef.current = ''
          spokenSampleRef.current = mergeTranscriptText(spokenSampleRef.current, finalText)
          setSpokenSample(spokenSampleRef.current)
        }
      } else if (inputTranscription.finished === false) {
        voiceCommandRef.current = null
        voiceTranscriptDraftRef.current = mergeTranscriptText(voiceTranscriptDraftRef.current, inputTranscription.text)
      } else {
        const finalText = mergeTranscriptText(voiceTranscriptDraftRef.current, inputTranscription.text)
        voiceCommandRef.current = { text: finalText, receivedAt: Date.now(), questionId: questionRef.current.id }
        voiceTranscriptDraftRef.current = ''
        coachBusyRef.current = true
        setPending(true)
        setStatus('Writia heard your spoken request · preparing a response')
      }
    }
    const functionCalls = message.toolCall?.functionCalls
    if (functionCalls?.length) {
      handleToolCalls(functionCalls)
      return
    }
    const content = message.serverContent
    if (!content) return
    const text = content.outputTranscription?.text
      ?? content.modelTurn?.parts?.map((part) => part.text ?? '').join('')
      ?? ''
    if (text) {
      feedbackTextRef.current = mergeTranscriptText(feedbackTextRef.current, text)
      setCoachText(feedbackTextRef.current)
    }
    const context = audioContextRef.current
    for (const part of content.modelTurn?.parts ?? []) {
      const audioData = part.inlineData?.data
      if (!audioData || !context) continue
      try {
        const buffer = audioBufferFromPcm(
          context,
          decodeBase64(audioData),
          Number(part.inlineData?.mimeType?.match(/rate=(\d+)/i)?.[1]) || 24000,
        )
        const source = context.createBufferSource()
        source.buffer = buffer
        source.connect(context.destination)
        const startAt = Math.max(context.currentTime + 0.025, nextAudioTimeRef.current)
        nextAudioTimeRef.current = startAt + buffer.duration
        audioSourcesRef.current.push(source)
        source.onended = () => {
          audioSourcesRef.current = audioSourcesRef.current.filter((item) => item !== source)
        }
        source.start(startAt)
      } catch (caughtError) {
        console.error('Unable to play Writia Live audio feedback.', caughtError)
        setError('Writia’s spoken feedback could not be played. Check your audio output and reconnect if needed.')
      }
    }
    if (content.turnComplete) {
      pendingModelAnswerRef.current = null
      const finalFeedback = feedbackTextRef.current.trim()
      if (finalFeedback) setFeedback((current) => [{
        id: crypto.randomUUID(),
        text: finalFeedback,
        createdAt: Date.now(),
      }, ...current].slice(0, 8))
      feedbackTextRef.current = ''
      setCoachText('')
      coachBusyRef.current = false
      setPending(false)
      setStatus('Live coach ready')
      const queuedDraft = queuedDraftRef.current
      queuedDraftRef.current = null
      if (queuedDraft && queuedDraft !== lastSentDraftRef.current) {
        const sent = sendUserTurn(`The learner's latest writing pad snapshot is below. Give concise spoken feedback on the newest change or most important issue only, calibrated toward IELTS Speaking Band ${targetBandRef.current}. Also call provide_vocabulary_hints with 2–3 useful, non-repeating expressions that fit the answer if there is enough context. Do not score or rewrite it unless explicitly requested.\n\n${queuedDraft}`)
        if (sent) lastSentDraftRef.current = queuedDraft
      }
    }
  }, [handleToolCalls, sendUserTurn])

  const startCoach = useCallback(async () => {
    if (connectingRef.current || connectedRef.current) return
    setError('')
    if (!apiKey.trim()) {
      setError('Add your Speakia AI API key in Settings before starting the Writia live coach.')
      return
    }
    connectingRef.current = true
    setState('connecting')
    setStatus('Connecting to Speakia Live…')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is not available in this browser. Use a supported browser and try again.')
      setStatus('Requesting microphone permission for spoken commands…')
      const microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      microphoneStreamRef.current = microphoneStream
      const context = new AudioContext()
      audioContextRef.current = context
      await context.resume()
      await context.audioWorklet.addModule('/pcm-capture-processor.js')
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const session = await client.live.connect({
        model: getProdiaLiveModel(),
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          realtimeInputConfig: { automaticActivityDetection: { disabled: false } },
          systemInstruction: `${liveInstructions(questionRef.current, coachLanguageRef.current)}\n\nPractice target: IELTS Speaking Band ${targetBand}. Use this only to calibrate feedback and examples toward the learner's selected practice level. Never predict, guarantee, or report an official band score.`,
          tools: [{ functionDeclarations: [replaceWritingTextTool, sentenceAlternativesTool, vocabularyHintsTool, writingReviewTool, speakingCriteriaTool, answerPlanTool, writeModelAnswerTool, writeRequestedTextTool] }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
        },
        callbacks: {
          onopen: () => setStatus('Connected · Writia is ready'),
          onmessage: handleMessage,
          onerror: (event) => {
            console.error('Writia Speakia AI Live connection failed.', event)
            reportGeminiQuota(event)
            setError('The Writia live connection failed. Check API access, quota, and your network.')
            connectedRef.current = false
            connectingRef.current = false
            setState('idle')
            setIsRehearsing(false)
            rehearsalActiveRef.current = false
            stopMicrophone()
            const context = audioContextRef.current
            audioContextRef.current = null
            if (context && context.state !== 'closed') {
              void context.close().catch((caughtError: unknown) => {
                console.error('Unable to close Writia audio after a connection failure.', caughtError)
              })
            }
          },
          onclose: () => {
            if (connectedRef.current || connectingRef.current) {
              setError('The Writia live connection closed. Reconnect to continue.')
              connectedRef.current = false
              connectingRef.current = false
              setState('idle')
              setIsRehearsing(false)
              rehearsalActiveRef.current = false
              stopMicrophone()
              const context = audioContextRef.current
              audioContextRef.current = null
              if (context && context.state !== 'closed') {
                void context.close().catch((caughtError: unknown) => {
                  console.error('Unable to close Writia audio after the connection closed.', caughtError)
                })
              }
            }
          },
        },
      })
      sessionRef.current = session
      const microphone = context.createMediaStreamSource(microphoneStream)
      const capture = new AudioWorkletNode(context, 'speakia-pcm-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'discrete',
      })
      const silentGain = context.createGain()
      silentGain.gain.value = 0
      microphone.connect(capture)
      capture.connect(silentGain)
      silentGain.connect(context.destination)
      microphoneSourceRef.current = microphone
      microphoneCaptureRef.current = capture
      microphoneGainRef.current = silentGain
      capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (sessionRef.current !== session || micMutedRef.current) return
        try {
          session.sendRealtimeInput({
            audio: {
              data: float32ToPcmBase64(resampleTo16k(event.data, context.sampleRate)),
              mimeType: 'audio/pcm;rate=16000',
            },
          })
        } catch (caughtError) {
          console.error('Unable to send microphone audio to Writia Live.', caughtError)
          setError(caughtError instanceof Error ? caughtError.message : 'Writia could not receive microphone audio.')
          stopMicrophone()
        }
      }
      connectedRef.current = true
      connectingRef.current = false
      micMutedRef.current = false
      setMicMuted(false)
      coachBusyRef.current = false
      lastSentDraftRef.current = ''
      setState('live')
      setStatus('Live coach ready · listening for spoken requests and writing updates')
      voiceCommandRef.current = null
      voiceTranscriptDraftRef.current = ''
      rehearsalActiveRef.current = false
      rehearsalTranscriptRef.current = ''
      spokenSampleRef.current = ''
      setSpokenSample('')
      setCriteriaFeedback([])
      session.sendClientContent({
        turns: [{
          role: 'user',
          parts: [{ text: `Welcome the learner briefly in ${coachLanguageRef.current} and invite them to write a natural spoken-style answer to this IELTS Speaking prompt. Explain the task and coaching in the selected coach language. Read the English prompt clearly, then briefly explain it in the selected coach language:\n\n${promptForQuestion(questionRef.current)}` }],
        }],
        turnComplete: true,
      })
    } catch (caughtError) {
      console.error('Unable to start Writia Speakia AI Live.', caughtError)
      reportGeminiQuota(caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'The Writia live coach could not be started.')
      connectedRef.current = false
      connectingRef.current = false
      setState('idle')
      setIsRehearsing(false)
      rehearsalActiveRef.current = false
      sessionRef.current?.close()
      sessionRef.current = null
      stopMicrophone()
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') await audioContextRef.current.close()
      audioContextRef.current = null
    }
  }, [apiKey, handleMessage, stopMicrophone, targetBand])

  const stopCoach = useCallback(async () => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    debounceRef.current = null
    if (coachTypingTimerRef.current !== null) window.clearTimeout(coachTypingTimerRef.current)
    coachTypingTimerRef.current = null
    setCoachWriting(false)
    connectedRef.current = false
    connectingRef.current = false
    coachBusyRef.current = false
    queuedDraftRef.current = null
    voiceCommandRef.current = null
    voiceTranscriptDraftRef.current = ''
    rehearsalActiveRef.current = false
    rehearsalTranscriptRef.current = ''
    pendingCriteriaReviewRef.current = null
    setIsRehearsing(false)
    setPending(false)
    const session = sessionRef.current
    sessionRef.current = null
    if (session) {
      try {
        session.close()
      } catch (caughtError) {
        console.error('Unable to close the Writia Speakia AI Live session cleanly.', caughtError)
        setError('The Writia session ended, but its connection could not be closed cleanly.')
      }
    }
    for (const source of audioSourcesRef.current) {
      try { source.stop() } catch (caughtError) { console.info('A Writia audio response had already stopped.', caughtError) }
    }
    audioSourcesRef.current = []
    stopMicrophone()
    const context = audioContextRef.current
    audioContextRef.current = null
    if (context && context.state !== 'closed') await context.close()
    setState('idle')
    setStatus('Live coach disconnected')
  }, [stopMicrophone])

  useEffect(() => () => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    if (coachTypingTimerRef.current !== null) window.clearTimeout(coachTypingTimerRef.current)
    connectedRef.current = false
    rehearsalActiveRef.current = false
    sessionRef.current?.close()
    stopMicrophone()
    for (const source of audioSourcesRef.current) {
      try { source.stop() } catch { /* The response may already have ended. */ }
    }
    const context = audioContextRef.current
    if (context && context.state !== 'closed') void context.close()
  }, [stopMicrophone])

  const updateDraft = (value: string) => {
    const next = value.slice(0, MAX_DRAFT_LENGTH)
    setWritingReview(null)
    setCriteriaFeedback([])
    pendingWritingReviewRef.current = null
    pendingCriteriaReviewRef.current = null
    if (spokenSampleRef.current) {
      spokenSampleRef.current = ''
      setSpokenSample('')
    }
    persistDraft(next)
    if (!connectedRef.current || !next.trim()) return
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      const snapshot = draftRef.current.trim()
      if (!snapshot || snapshot === lastSentDraftRef.current) return
      const update = `The learner has paused typing. Here is the complete current writing-pad snapshot for the prompt "${promptForQuestion(questionRef.current)}". Coach language: ${languageDirection(coachLanguageRef.current)} Give one short spoken observation or suggestion about the newest wording or highest-impact issue, calibrated toward IELTS Speaking Band ${targetBand}. Be specific, do not repeat earlier advice, do not score, and do not rewrite the answer. Prioritize natural spoken English, clear development, and precise vocabulary over formal essay language. If there are at least 8 words and useful non-repeating vocabulary can be suggested naturally, call provide_vocabulary_hints with English phrases/examples and meanings/use guidance in the selected coach language.\n\n${snapshot}`
      if (coachBusyRef.current) {
        queuedDraftRef.current = snapshot
        return
      }
      if (sendUserTurn(update)) {
        lastSentDraftRef.current = snapshot
        setStatus('Draft shared · listening for feedback')
      }
    }, 1600)
  }

  const selectQuestion = (nextPart: PracticePart, nextQuestion: SpeakingPrompt) => {
    if (nextQuestion.id === question.id) {
      setPart(nextPart)
      return
    }
    const nextDrafts = { ...draftsRef.current, [question.id]: draft }
    draftsRef.current = nextDrafts
    partRef.current = nextPart
    questionRef.current = nextQuestion
    const nextDraft = nextDrafts[nextQuestion.id] ?? ''
    draftRef.current = nextDraft
    setDrafts(nextDrafts)
    setPart(nextPart)
    setQuestion(nextQuestion)
    setDraft(nextDraft)
    setSaveError(saveWritiaData(username, { questionId: nextQuestion.id, part: nextPart, drafts: nextDrafts })
      ? ''
      : 'Your draft could not be saved on this device.')
    setFeedback([])
    setCoachText('')
    setAlternatives([])
    setRefinedSentence('')
    setAlternativeOriginal('')
    setAlternativeExplanation('')
    setWritingReview(null)
    pendingCriteriaReviewRef.current = null
    setCriteriaFeedback([])
    setSpokenSample('')
    spokenSampleRef.current = ''
    rehearsalTranscriptRef.current = ''
    rehearsalActiveRef.current = false
    setIsRehearsing(false)
    setActiveStage(0)
    vocabularyHintsRef.current = []
    setVocabularyHints([])
    setAnswerPlan(null)
    pendingRevisionRef.current = null
    setWritingReview(null)
    pendingAlternativesRef.current = null
    setError('')
  }

  const captureSelection = (): RevisionContext | null => {
    const editor = editorRef.current
    if (!editor || !draft.trim()) return null
    const start = editor.selectionStart
    const end = editor.selectionEnd
    if (start === end) return null
    const targetText = draft.slice(start, end).trim()
    if (!targetText) return null
    const actualStart = draft.indexOf(targetText, start)
    if (actualStart < 0) return null
    return { targetText, start: actualStart, end: actualStart + targetText.length, draft, questionId: question.id }
  }

  const requestRefinement = (selectionOnly: boolean) => {
    if (!connectedRef.current) {
      setError('Connect the Writia live coach before requesting a refinement.')
      return
    }
    if (coachBusyRef.current || isRehearsing) {
      setError('Wait for Writia’s current feedback to finish before requesting a refinement.')
      return
    }
    const editor = editorRef.current
    const start = selectionOnly && editor ? editor.selectionStart : 0
    const end = selectionOnly && editor ? editor.selectionEnd : draft.length
    const selectedText = draft.slice(start, end)
    const targetText = selectionOnly ? selectedText.trim() : selectedText
    if (!targetText.trim()) {
      setError(selectionOnly ? 'Select a sentence or phrase in your answer first.' : 'Write an answer before asking Writia to refine it.')
      return
    }
    const actualStart = selectionOnly ? draft.indexOf(targetText, start) : 0
    if (actualStart < 0) {
      setError('The selected text changed. Select it again and retry.')
      return
    }
    const actualEnd = actualStart + targetText.length
    pendingRevisionRef.current = { targetText, start: actualStart, end: actualEnd, draft, questionId: question.id }
    const instruction = selectionOnly
      ? `Coach language: ${languageDirection(coachLanguage)} The learner explicitly selected this text for improvement: "${targetText}". Revise only this selection toward IELTS Speaking Band ${targetBand}, preserve its meaning and personal details, and keep the replacement in natural spoken English. Call replace_writing_text with this exact targetText. Explain the main change briefly in the selected coach language.`
      : `Coach language: ${languageDirection(coachLanguage)} The learner explicitly asked you to refine the complete current answer toward IELTS Speaking Band ${targetBand}. Preserve their ideas and personal details, keep the replacement in natural spoken English, and call replace_writing_text with the exact complete targetText below. Explain the main change briefly in the selected coach language.`
    if (sendUserTurn(`${instruction}\n\nComplete current draft:\n${draft}`)) {
      setError('')
      setStatus('Writia is preparing your requested refinement…')
    } else {
      pendingRevisionRef.current = null
    }
  }

  const requestWritingReview = () => {
    if (!connectedRef.current) {
      setError('Connect Writia before running the grammar and speaking-style check.')
      return
    }
    if (coachBusyRef.current || isRehearsing) {
      setError('Wait for Writia’s current response to finish before running another writing aid.')
      return
    }
    const snapshot = draft.trim()
    if (!snapshot) {
      setError('Write a few sentences first so Writia can review your grammar, clarity, and spoken answer development.')
      return
    }
    pendingWritingReviewRef.current = {
      targetText: snapshot,
      start: 0,
      end: snapshot.length,
      draft,
      questionId: question.id,
    }
    setWritingReview(null)
    const instruction = `Coach language: ${languageDirection(coachLanguage)} Call review_writing to review the learner's current IELTS Speaking answer against a practice target of Band ${targetBand}. The target is a learning direction, not a predicted or official score. Check a small number of the highest-value issues across grammar, clarity, natural spoken style, vocabulary precision, cohesion, and answer development. The response must be anchored to the complete current draft below. Keep summary and suggestions in the selected coach language. Return exact originalText excerpts copied from the draft, concise supportive explanations, and replacementText in natural English only where a correction or rephrase preserves the learner's meaning and personal details. Leave replacementText empty when the learner needs to add their own detail or make a choice. Prioritize speaking: clear, developed ideas and flexible, natural phrasing over memorized/formal essay language. Do not edit the pad; the learner will choose suggestions individually.\n\nIELTS Speaking prompt:\n${promptForQuestion(question)}\n\nComplete current writing-pad draft:\n${snapshot}`
    if (sendUserTurn(instruction)) {
      setError('')
      setStatus(`Writia is checking grammar, clarity, and spoken answer development for Band ${targetBand}…`)
    } else {
      pendingWritingReviewRef.current = null
    }
  }

  const requestCriteriaCheck = () => {
    if (!connectedRef.current) {
      setError('Connect Writia before running a four-criteria check.')
      return
    }
    if (coachBusyRef.current || coachWriting || isRehearsing) {
      setError('Finish the current coaching activity before running the four-criteria check.')
      return
    }
    if (!draft.trim()) {
      setError('Write a response before asking Writia to check the four Speaking criteria.')
      return
    }
    const spoken = spokenSampleRef.current.trim()
    setCriteriaFeedback([])
    pendingCriteriaReviewRef.current = { questionId: question.id, draft, spokenSample: spoken }
    const instruction = `Coach language: ${languageDirection(coachLanguage)} Call review_speaking_criteria with diagnostic, non-official feedback for all four IELTS Speaking criteria, calibrated to a practice target of Band ${targetBand}. Do not provide any numeric score or estimate. Ground Fluency & Coherence, Lexical Resource, and Grammatical Range & Accuracy in the learner's answer. For Pronunciation, assess only the actual spoken rehearsal audio from this live session when the supplied rehearsal transcript is present; do not infer pronunciation from text or transcript alone. If no spoken rehearsal is supplied, mark Pronunciation not_observed and explain how to practise it. For every criterion give one concise evidence-based observation and one specific next practice step. Use the status strength, developing, focus, or not_observed. Return exactly one item for each of the four criteria.\n\nPractice target (not an official score): Band ${targetBand}\nPrompt:\n${promptForQuestion(question)}\n\nWritten response:\n${draft}\n\n${spoken ? `Learner's spoken rehearsal transcript:\n${spoken}` : 'No spoken rehearsal transcript has been captured.'}` 
    if (sendUserTurn(instruction)) {
      setError('')
      setStatus(spoken ? 'Writia is reviewing your response across all four Speaking criteria…' : 'Writia is checking your answer; pronunciation will be marked not observed until you rehearse aloud…')
      setActiveStage(4)
    } else {
      pendingCriteriaReviewRef.current = null
    }
  }

  const guideStage = (stageIndex: number) => {
    if (stageIndex === 3) {
      pendingCriteriaReviewRef.current = null
      setActiveStage(stageIndex)
      setError('')
      setStatus('Rehearse your answer aloud, then ask Writia for a four-criteria check.')
      return
    }
    if (stageIndex === 4) {
      requestCriteriaCheck()
      return
    }
    if (!connectedRef.current) {
      setError('Connect the Writia live coach to begin guided response practice.')
      return
    }
    if (coachBusyRef.current || coachWriting || isRehearsing) {
      setError('Finish the current coaching activity before moving to another practice step.')
      return
    }
    const stage = guidedStages[stageIndex]
    const instruction = `Coach language: ${languageDirection(coachLanguage)} The learner chose guided response practice step ${stageIndex + 1}: "${stage.title}". ${stage.detail} Ask one focused coaching question and give a brief scaffold for this step, using the current prompt and answer below. Help the learner build their own answer; do not write it for them unless they explicitly ask you to write a sentence or model answer. Relate your guidance to the relevant IELTS Speaking criteria where useful. Do not estimate a band or change the pad.\n\nPractice target: IELTS Speaking Band ${targetBand} (learning direction only)\nPrompt:\n${promptForQuestion(question)}\n\nCurrent response:\n${draft || '(The learner has not started writing yet.)'}`
    if (sendUserTurn(instruction)) {
      setActiveStage(stageIndex)
      setError('')
      setStatus(`Guided practice · ${stage.title}`)
    }
  }

  const startGuidedPractice = () => {
    if (guidedDisclosureRef.current) {
      guidedDisclosureRef.current.open = true
      guidedDisclosureRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    setActiveStage(0)
    guideStage(0)
  }

  const startSpeakingRehearsal = () => {
    if (!connectedRef.current) {
      setError('Connect Writia and allow microphone access before starting a speaking rehearsal.')
      return
    }
    if (micMutedRef.current) {
      setError('Unmute the microphone before starting a speaking rehearsal so Writia can hear your answer.')
      return
    }
    if (coachBusyRef.current || coachWriting) {
      setError('Wait for Writia to finish its current response before starting a rehearsal.')
      return
    }
    spokenSampleRef.current = ''
    rehearsalTranscriptRef.current = ''
    setSpokenSample('')
    setCriteriaFeedback([])
    rehearsalActiveRef.current = true
    setIsRehearsing(true)
    setActiveStage(3)
    voiceCommandRef.current = null
    voiceTranscriptDraftRef.current = ''
    if (sendUserTurn(`Coach language: ${languageDirection(coachLanguage)} The learner is about to rehearse their current IELTS Speaking answer aloud. Acknowledge briefly, then listen without interrupting. Do not give feedback until they click Finish rehearsal. The current prompt is:\n${promptForQuestion(question)}\n\nCurrent written answer:\n${draft}`)) {
      setError('')
      setStatus('Rehearsal in progress · read your answer aloud, then finish to review.')
    } else {
      rehearsalActiveRef.current = false
      setIsRehearsing(false)
    }
  }

  const finishSpeakingRehearsal = () => {
    if (coachBusyRef.current) {
      setError('Wait for Writia’s acknowledgement to finish, then end your rehearsal.')
      return
    }
    rehearsalActiveRef.current = false
    setIsRehearsing(false)
    const transcript = spokenSampleRef.current.trim()
    if (!transcript) {
      setError('Writia did not receive a clear rehearsal transcript. Check microphone access and try again.')
      setStatus('No speech was captured')
      return
    }
    setCriteriaFeedback([])
    setStatus('Rehearsal captured · run the four-criteria check when ready.')
    setLastCoachTask('Your spoken rehearsal is ready for review. Run the four-criteria check to get targeted feedback, including pronunciation from the live audio.')
  }

  const requestAlternatives = () => {
    if (!connectedRef.current) {
      setError('Connect Writia before exploring sentence alternatives.')
      return
    }
    if (coachBusyRef.current || isRehearsing) {
      setError('Wait for the current Writia response to finish first.')
      return
    }
    const context = captureSelection()
    if (!context) {
      setError('Select a sentence or phrase in your answer first, then explore its alternatives.')
      return
    }
    pendingAlternativesRef.current = context
    const instruction = `Coach language: ${languageDirection(coachLanguage)} The learner wants to see sentence variety without changing the pad. For the exact selected text below, create one refined sentence plus three distinct natural English paraphrases calibrated toward IELTS Speaking Band ${targetBand}. Preserve meaning, nuance, context, and personal details; use natural spoken phrasing, not essay language or forced idioms. Keep alternatives in English and explain differences in the selected coach language. Call provide_sentence_alternatives with this exact targetText. Do not edit the pad.\n\nCurrent IELTS Speaking prompt:\n${promptForQuestion(question)}\n\nFull answer for context:\n${draft}\n\nExact selected text:\n${context.targetText}`
    if (sendUserTurn(instruction)) {
      setError('')
      setStatus('Writia is exploring sentence alternatives…')
      setAlternatives([])
      setRefinedSentence('')
    } else {
      pendingAlternativesRef.current = null
    }
  }

  const requestVocabularyHints = () => {
    if (!connectedRef.current) {
      setError('Connect Writia before asking for vocabulary suggestions.')
      return
    }
    if (coachBusyRef.current || isRehearsing) {
      setError('Wait for the current Writia response to finish first.')
      return
    }
    const context = captureSelection()
    const focus = context?.targetText ?? draft.trim()
    if (!focus) {
      setError('Write a few words first so Writia can suggest vocabulary that fits your answer.')
      return
    }
    const instruction = `Coach language: ${languageDirection(coachLanguage)} Call provide_vocabulary_hints with three specific, natural English words or phrases that fit the selected text or latest answer. Keep phrases and IELTS examples in English; explain meanings and use guidance in the selected coach language. Prefer useful collocations and spoken phrases over rare vocabulary. Do not force any suggestion.\n\nPrompt:\n${promptForQuestion(question)}\n\nLatest answer:\n${draft}\n\n${context ? `Selected sentence to focus on:\n${context.targetText}` : ''}`
    if (sendUserTurn(instruction)) {
      setError('')
      setStatus('Writia is finding vocabulary for your answer…')
    }
  }

  const requestAnswerPlan = () => {
    if (!connectedRef.current) {
      setError('Connect Writia before building an answer plan.')
      return
    }
    if (coachBusyRef.current || isRehearsing) {
      setError('Wait for the current Writia response to finish first.')
      return
    }
    const instruction = `Coach language: ${languageDirection(coachLanguage)} Call provide_answer_plan with a concise, flexible structure tailored to the current IELTS Speaking part and prompt. Give 3–5 steps with clear labels and guidance in the selected coach language, connected to the learner's current answer. Keep optional sentence starters in natural English. For Part 2, use a coherent story arc across the cue-card points. Do not write a complete model answer.\n\nPrompt:\n${promptForQuestion(question)}\n\nCurrent answer:\n${draft || '(The learner has not started writing yet.)'}`
    if (sendUserTurn(instruction)) {
      setError('')
      setStatus('Writia is building a flexible answer map…')
    }
  }

  const changeCoachLanguage = (nextLanguage: WritiaCoachLanguage) => {
    const previousLanguage = coachLanguageRef.current
    coachLanguageRef.current = nextLanguage
    setCoachLanguage(nextLanguage)
    setWritingReview(null)
    setCriteriaFeedback([])
    if (state !== 'live') return
    if (!sendUserTurn(`Update your coach language immediately to ${nextLanguage}. ${languageDirection(nextLanguage)} Continue the IELTS practice without changing the learner's writing. Briefly acknowledge the selected language in that language and use it for all coaching, spoken feedback, explanations, review summaries, vocabulary meanings, and answer-plan guidance from now on. Keep IELTS model sentences and suggested replacements in natural English. Practice target remains IELTS Speaking Band ${targetBand}.`)) {
      coachLanguageRef.current = previousLanguage
      setCoachLanguage(previousLanguage)
      return
    }
    setStatus(`Switching Writia's coaching language to ${nextLanguage}…`)
  }

  const sendCoachQuestion = () => {
    const request = coachQuestion.trim()
    if (!request) return
    if (!connectedRef.current) {
      setError('Connect Writia to ask the live coach for help.')
      return
    }
    if (coachBusyRef.current || isRehearsing) {
      setError('Wait for the current Writia response to finish first.')
      return
    }
    if (coachTypingTimerRef.current !== null) {
      setError('Wait for Writia to finish typing the current model answer first.')
      return
    }
    const requestsModelAnswer = /\b(?:write|draft|create|generate|give|show|provide|compose)\b[\s\S]{0,60}\b(?:answer|response)\b/i.test(request)
      || /\b(?:answer|respond to)\s+(?:the|this|my)\s+(?:question|prompt)\b/i.test(request)
    pendingModelAnswerRef.current = requestsModelAnswer ? { questionId: question.id, draft } : null
    const instruction = requestsModelAnswer
      ? `Coach language: ${languageDirection(coachLanguage)} The learner explicitly requested a complete sample/model answer. Write a natural spoken-style response in English for the current IELTS Speaking prompt, tailored to their existing answer where appropriate. Call write_model_answer with the complete answer; do not replace or paraphrase their existing text. Explain it in the selected coach language.`
      : `Coach language: ${languageDirection(coachLanguage)} The learner is asking for on-demand writing help. Respond directly and specifically in the selected coach language, using their current prompt and answer and calibrating examples toward IELTS Speaking Band ${targetBand}. Keep IELTS example phrases in English when appropriate. Give a small actionable step or an example if helpful. Do not call write_model_answer or rewrite the pad unless they explicitly request a complete model answer or a refinement.`
    if (sendUserTurn(`${instruction}\n\nLearner's question: ${request}\n\nPractice target: IELTS Speaking Band ${targetBand} (learning direction only, not a score)\n\nPrompt:\n${promptForQuestion(question)}\n\nCurrent answer:\n${draft || '(No answer written yet.)'}`)) {
      setCoachQuestion('')
      setError('')
      setLastCoachTask('On-demand help from Writia')
    } else {
      pendingModelAnswerRef.current = null
    }
  }

  const applyAlternative = (text: string) => {
    const context = pendingAlternativesRef.current
    if (!context || context.questionId !== question.id || draft.slice(context.start, context.end) !== context.targetText) {
      setError('Your selected sentence changed. Select it again to generate fresh alternatives.')
      return
    }
    const updated = `${draft.slice(0, context.start)}${text}${draft.slice(context.end)}`
    updateDraft(updated)
    pendingAlternativesRef.current = { ...context, targetText: text, end: context.start + text.length, draft: updated }
    window.requestAnimationFrame(() => {
      editorRef.current?.focus()
      editorRef.current?.setSelectionRange(context.start, context.start + text.length)
    })
    setError('')
  }

  const applyWritingSuggestion = (issue: WritingIssue) => {
    if (!issue.replacementText) return
    if (typeRequestedText(issue.replacementText, 'replace', issue.originalText, question.id)) {
      setWritingReview(null)
    }
  }

  const insertVocabulary = (phrase: string) => {
    const editor = editorRef.current
    const start = editor?.selectionStart ?? draft.length
    const end = editor?.selectionEnd ?? draft.length
    const before = draft.slice(0, start)
    const after = draft.slice(end)
    const leadingSpace = before && !/\s$/.test(before) ? ' ' : ''
    const trailingSpace = after && !/^\s/.test(after) ? ' ' : ''
    const inserted = `${leadingSpace}${phrase}${trailingSpace}`
    updateDraft(`${before}${inserted}${after}`)
    const selectionStart = before.length + leadingSpace.length
    window.requestAnimationFrame(() => {
      editorRef.current?.focus()
      editorRef.current?.setSelectionRange(selectionStart, selectionStart + phrase.length)
    })
    setError('')
  }

  const changePart = (nextPart: PracticePart) => {
    if (state !== 'idle') return
    selectQuestion(nextPart, randomQuestion(nextPart, question.id))
  }

  const nextQuestion = () => {
    if (state !== 'idle') return
    selectQuestion(part, randomQuestion(part, question.id))
  }

  const clearDraft = () => {
    if (!draft || coachWriting || isRehearsing) return
    if (!window.confirm('Clear your answer to this question?')) return
    updateDraft('')
    setFeedback([])
    setError('')
  }

  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0

  return <div className="page-content inner-page writia-page">
    <div className="inner-page-heading writia-heading">
      <div>
        <p className="eyebrow">IELTS SPEAKING PRACTICE</p>
        <h1>Writia</h1>
        <p className="writia-hero-copy">Build clear, developed answers to IELTS Speaking questions. Draft in the writing pad while your live adaptive coach guides you with timely prompts and feedback.</p>
      </div>
      <div className="writia-heading-actions">
        <label className="writia-part-select"><span>Speaking part</span><select aria-label="Choose IELTS Speaking part" value={part} disabled={state !== 'idle'} onChange={(event) => changePart(event.target.value as PracticePart)}>
          <option value="all">Any part</option><option value="part1">Part 1</option><option value="part2">Part 2</option><option value="part3">Part 3</option>
        </select></label>
        <Button variant="outline" onClick={nextQuestion} disabled={state !== 'idle'}><RefreshCw size={15} /> New question</Button>
      </div>
    </div>

    <Card className="writia-question-card">
      <div className="writia-question-icon"><CircleHelp size={20} /></div>
      <div className="writia-question-copy">
        <span>{questionPartLabel(question.part)} <i /> {question.topic}</span>
        <h2>{question.question}</h2>
        {question.part === 'part2' && <small>Use the cue-card points to shape your long turn.</small>}
      </div>
      <BookOpen size={19} className="writia-question-mark" aria-hidden="true" />
    </Card>

    <details ref={guidedDisclosureRef} className="writia-guided-disclosure">
      <summary><Sparkles size={15} /><span>Guided practice</span><small>{activeStage > 0 ? `Step ${activeStage + 1} of 5 · ${guidedStages[activeStage].title}` : 'Build your answer in 5 steps'}</small></summary>
      <div className="writia-guided-content">
        <div className="writia-guided-actions">
          <span>Choose a step or let Writia guide you from the beginning.</span>
          <Button size="sm" onClick={startGuidedPractice} disabled={state !== 'live' || pending || coachWriting || isRehearsing}><Sparkles size={14} /> Start guided practice</Button>
        </div>
        <ol className="writia-stage-list" aria-label="Guided response practice steps">
          {guidedStages.map((stage, index) => (
            <li key={stage.title} className={activeStage === index ? 'writia-stage-active' : ''}>
              <button type="button" onClick={() => guideStage(index)} aria-current={activeStage === index ? 'step' : undefined} disabled={state !== 'live' || pending || coachWriting || isRehearsing}>
                <span>{index + 1}</span><strong>{stage.title}</strong>
              </button>
            </li>
          ))}
        </ol>
        {activeStage === 3 && <div className="writia-rehearsal-bar">
          <p>{isRehearsing ? micMuted ? 'Microphone muted. Unmute to continue.' : pending ? 'Writia is readying the rehearsal…' : 'Read your answer aloud at a natural pace.' : spokenSample ? 'Rehearsal captured. Run the four-criteria check for feedback.' : 'Read your answer aloud for pronunciation feedback.'}</p>
          {isRehearsing
            ? <Button size="sm" variant="outline" onClick={finishSpeakingRehearsal} disabled={pending || micMuted}><Check size={14} /> Finish rehearsal</Button>
            : <Button size="sm" onClick={startSpeakingRehearsal} disabled={state !== 'live' || pending || coachWriting || micMuted}><Mic2 size={14} /> {spokenSample ? 'Rehearse again' : 'Rehearse aloud'}</Button>}
        </div>}
      </div>
    </details>

    <div className="writia-workspace">
      <section className="writia-editor-column" aria-label="Writing pad">
        <Card className="writia-editor-card">
          <div className="writia-editor-toolbar">
            <div><span className="writia-editor-icon"><PenLine size={17} /></span><div><strong>Your answer</strong><small>Write naturally, as you would speak</small></div></div>
            <span className="writia-word-count">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          </div>
          <div className="writia-pad-tools" aria-label="Writing aids">
            <label className="writia-target-band"><span>Target speaking band</span><select aria-label="IELTS Speaking practice target band" value={targetBand} disabled={pending || isRehearsing} onChange={(event) => { targetBandRef.current = event.target.value; setTargetBand(event.target.value); setWritingReview(null); setCriteriaFeedback([]) }}>
              <option value="6.0">6.0</option><option value="6.5">6.5</option><option value="7.0">7.0</option><option value="7.5">7.5</option><option value="8.0">8.0</option>
            </select></label>
            <button type="button" onClick={startGuidedPractice} disabled={state !== 'live' || pending || coachWriting || isRehearsing}><Sparkles size={14} /> Guided practice</button>
            <button type="button" onClick={requestWritingReview} disabled={state !== 'live' || pending || coachWriting || isRehearsing || !draft.trim()}><Check size={14} /> Grammar &amp; clarity</button>
            <button type="button" onClick={requestAlternatives} disabled={state !== 'live' || pending || coachWriting || isRehearsing} title="Select a sentence first to compare natural rephrasings"><WandSparkles size={14} /> Sentence variety</button>
            <button type="button" onClick={requestVocabularyHints} disabled={state !== 'live' || pending || coachWriting || isRehearsing}><BookOpen size={14} /> Find vocabulary</button>
            <button type="button" onClick={requestAnswerPlan} disabled={state !== 'live' || pending || coachWriting || isRehearsing}><Compass size={14} /> Answer map</button>
            <button type="button" onClick={requestCriteriaCheck} disabled={state !== 'live' || pending || coachWriting || isRehearsing || !draft.trim()}><Check size={14} /> 4 criteria</button>
          </div>
          <label className="sr-only" htmlFor="writia-writing-pad">Write your IELTS Speaking answer</label>
          <textarea
            id="writia-writing-pad"
            ref={editorRef}
            className={`writia-writing-pad ${coachWriting ? 'writia-writing-pad-coach-typing' : ''}`}
            value={draft}
            maxLength={MAX_DRAFT_LENGTH}
            placeholder="Start writing your answer here. Writia will follow your draft and offer concise feedback as you work…"
            onChange={(event) => updateDraft(event.target.value)}
            disabled={state === 'connecting' || coachWriting || isRehearsing}
          />
          <div className="writia-editor-footer">
            <span role={coachWriting ? 'status' : undefined}>{coachWriting ? 'Writia is typing in your answer…' : saveError || (draft ? 'Draft saved on this device' : 'Your answer is saved locally as you write')}</span>
            <div>
              <Button variant="outline" size="sm" onClick={clearDraft} disabled={!draft || state === 'connecting' || coachWriting || isRehearsing}>Clear</Button>
              <Button variant="outline" size="sm" onClick={() => requestRefinement(true)} disabled={!draft || state !== 'live' || pending || coachWriting || isRehearsing}><WandSparkles size={14} /> Improve selection</Button>
              <Button size="sm" className="writia-refine-button" onClick={() => requestRefinement(false)} disabled={!draft || state !== 'live' || pending || coachWriting || isRehearsing}><Sparkles size={14} /> Refine full answer</Button>
            </div>
          </div>
        </Card>
        {criteriaFeedback.length > 0 && <details ref={criteriaDisclosureRef} className="writia-criteria-disclosure">
          <summary><Check size={15} /><span>Speaking criteria feedback</span><small>Practice guidance · not an official score</small></summary>
          <div className="writia-criteria-grid">
            {speakingCriteria.map((criterion) => {
              const result = criteriaFeedback.find((item) => item.criterion === criterion.id)
              if (!result) return null
              return <article className={`writia-criterion-card writia-criterion-${result.status.replace('_', '-')}`} key={criterion.id}>
                <div><span className="writia-criterion-indicator" /><h3>{criterion.label}</h3></div>
                <small>{result.status.replace('_', ' ')}</small>
                <p>{result.evidence}</p>
                <p className="writia-criterion-next"><strong>Next:</strong> {result.nextStep}</p>
              </article>
            })}
          </div>
        </details>}
        {(writingReview || alternatives.length > 0 || vocabularyHints.length > 0 || answerPlan) && <div className="writia-aid-grid" aria-label="Writia writing aid results">
          {writingReview && <Card className="writia-aid-card writia-writing-review writia-aid-card-active">
              <div className="writia-aid-heading"><span><Check size={15} /></span><div><strong>Grammar, clarity &amp; speaking check</strong><small>Practice target: Band {writingReview.targetBand}</small></div></div>
              <div className="writia-writing-review-list">
                <p className="writia-writing-review-summary" dir="auto">{writingReview.summary}</p>
                {writingReview.issues.map((issue, index) => <article className="writia-writing-issue" key={`${issue.category}-${issue.originalText}-${index}`}>
                  <div><span>{issue.category}</span>{issue.replacementText && <button type="button" onClick={() => applyWritingSuggestion(issue)} disabled={coachWriting || isRehearsing}>Apply</button>}</div>
                  <p className="writia-writing-issue-original" dir="auto">“{issue.originalText}”</p>
                  <p dir="auto">{issue.suggestion}</p>
                </article>)}
                <p className="writia-aid-note">Suggestions are practice guidance, not an official IELTS score. Use only edits that keep your meaning and sound natural when spoken.</p>
              </div>
          </Card>}
          {alternatives.length > 0 && <Card className="writia-aid-card writia-sentence-lab writia-aid-card-active">
              <div className="writia-aid-heading"><span><WandSparkles size={15} /></span><div><strong>Sentence variety</strong><small>Same meaning, different natural phrasing</small></div></div>
              <div className="writia-alternative-list">
                <div className="writia-original-sentence"><span>Your original</span><p>{alternativeOriginal}</p></div>
                <div className="writia-alternative-option writia-refined-option"><div><span>Refined version</span><button type="button" onClick={() => applyAlternative(refinedSentence)} disabled={pending || isRehearsing}>Use this</button></div><p dir="auto">{refinedSentence}</p></div>
                {alternatives.map((alternative, index) => <div className="writia-alternative-option" key={`${alternative.text}-${index}`}><div><span>Alternative {index + 1} · {alternative.nuance}</span><button type="button" onClick={() => applyAlternative(alternative.text)} disabled={pending || isRehearsing}>Use this</button></div><p dir="auto">{alternative.text}</p></div>)}
                {alternativeExplanation && <p className="writia-aid-note" dir="auto">{alternativeExplanation}</p>}
              </div>
          </Card>}
          {vocabularyHints.length > 0 && <Card className="writia-aid-card writia-vocabulary-lens writia-aid-card-active">
              <div className="writia-aid-heading"><span><Lightbulb size={15} /></span><div><strong>Context vocabulary</strong><small>Useful language for this answer</small></div></div>
              <div className="writia-vocabulary-list">{vocabularyHints.map((hint) => <article className="writia-vocabulary-hint" key={hint.phrase}>
                <div><strong>{hint.phrase}</strong><button type="button" onClick={() => insertVocabulary(hint.phrase)} disabled={isRehearsing} title={`Insert ${hint.phrase} at the cursor`}>Insert</button></div>
                <p dir="auto">{hint.meaning}</p><small dir="auto">{hint.example}</small>{hint.useWhen && <em dir="auto">{hint.useWhen}</em>}
              </article>)}</div>
          </Card>}
          {answerPlan && <Card className="writia-aid-card writia-answer-map writia-aid-card-active">
              <div className="writia-aid-heading"><span><Compass size={15} /></span><div><strong>{answerPlan.title}</strong><small>Flexible outline · not a script</small></div></div>
              <ol className="writia-answer-steps">{answerPlan.steps.map((step, index) => <li key={`${step.label}-${index}`}><span>{index + 1}</span><div><strong dir="auto">{step.label}</strong><p dir="auto">{step.guidance}</p><small dir="auto">{step.sampleStarter}</small><button type="button" onClick={() => insertVocabulary(step.sampleStarter)} disabled={isRehearsing}>Use starter</button></div></li>)}</ol>
          </Card>}
        </div>}
      </section>

      <aside className="writia-coach-column" aria-label="Writia live coach">
        <Card className="writia-coach-card">
          <div className="writia-coach-header">
            <span className="writia-coach-icon"><Sparkles size={17} /></span>
            <div className="writia-coach-title"><strong>Writia live coach</strong><small>Speak to add or edit sentences</small></div>
            <label className="writia-language-picker"><span>Coach language</span><select value={coachLanguage} aria-label="Writia coach language" disabled={state === 'connecting' || pending || coachWriting} onChange={(event) => changeCoachLanguage(event.target.value as WritiaCoachLanguage)}>
              <option value="Urdu">Urdu (Pakistan)</option><option value="English">English</option><option value="Pakistani Punjabi">Pakistani Punjabi</option><option value="Code Switching">Code Switching (Pakistan)</option>
            </select></label>
            <span className={`writia-live-indicator ${state === 'live' ? 'writia-live-indicator-on' : ''}`} aria-label={state === 'live' ? 'Live' : 'Offline'} />
          </div>
          <div className={`writia-coach-status ${state === 'live' ? 'writia-coach-status-live' : ''}`} role="status">
            {state === 'connecting' ? <><LoaderCircle size={14} className="writia-spin" /> Connecting to Speakia Live…</>
              : state === 'live' ? <><span /> {micMuted ? 'Microphone muted · room audio is not being sent. Writing and on-demand text help still work.' : status || 'Listening for spoken requests and writing updates'}</>
                : <><span /> Start the live coach to get spoken feedback while writing.</>}
          </div>
          <div className="writia-feedback-list" aria-live="polite">
            {coachText && <div className="writia-feedback-card writia-feedback-current"><span>Writia · responding in {coachLanguage}</span><p dir="auto">{coachText}</p></div>}
            {feedback.map((item) => <div className="writia-feedback-card" key={item.id}><span>Writia · {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span><p dir="auto">{item.text}</p></div>)}
            {!coachText && !feedback.length && <div className="writia-coach-empty"><strong>Live writing feedback appears here</strong></div>}
          </div>
          {state === 'idle'
            ? <Button className="writia-connect-button" onClick={() => void startCoach()}><Sparkles size={16} /> Start live coach</Button>
            : <div className="writia-session-controls">
              {state === 'live' && <Button className={`writia-mic-toggle ${micMuted ? 'writia-mic-toggle-muted' : ''}`} variant="outline" onClick={toggleMicMuted} aria-label={micMuted ? 'Unmute Writia microphone' : 'Mute Writia microphone'} aria-pressed={micMuted} title={micMuted ? 'Unmute microphone' : 'Mute microphone'}>{micMuted ? <MicOff size={15} /> : <Mic size={15} />}{micMuted ? 'Unmute mic' : 'Mute mic'}</Button>}
              <Button className="writia-disconnect-button" variant="outline" onClick={() => void stopCoach()} disabled={state === 'connecting'}>{state === 'connecting' ? <LoaderCircle size={15} className="writia-spin" /> : <Square size={14} />} {state === 'connecting' ? 'Connecting…' : 'End live session'}</Button>
            </div>}
          {state === 'idle' && !apiKey.trim() && <button className="writia-settings-link" onClick={onOpenSettings}><Settings size={13} /> Set up Speakia AI API in Settings</button>}
        </Card>
        <details className="writia-quick-help-card">
          <summary><span className="writia-quick-help-icon"><Sparkles size={15} /></span><span><strong>Ask Writia</strong><small>Get focused help on your answer</small></span></summary>
          {lastCoachTask && <p className="writia-task-status" role="status">{lastCoachTask}</p>}
          <label className="sr-only" htmlFor="writia-coach-question">Ask Writia for writing help</label>
          <textarea id="writia-coach-question" value={coachQuestion} onChange={(event) => setCoachQuestion(event.target.value)} placeholder="e.g. How can I make this explanation clearer?" disabled={state !== 'live' || pending || coachWriting || isRehearsing} />
          <Button size="sm" onClick={sendCoachQuestion} disabled={state !== 'live' || pending || coachWriting || isRehearsing || !coachQuestion.trim()}><Sparkles size={13} /> Ask Writia</Button>
        </details>
      </aside>
    </div>
    {error && <p className="writia-error" role="alert">{error}</p>}
    <p className="writia-disclaimer">Practice feedback only—not an official IELTS score. Drafts are saved on this device.</p>
  </div>
}
