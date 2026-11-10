import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { motion } from 'framer-motion'
import { Behavior, FunctionCallingConfigMode, FunctionResponseScheduling, type FunctionCall, type FunctionResponse, type Tool } from '@google/genai'
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Mic,
  MicOff,
  ListFilter,
  Repeat2,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  Timer,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { practicePromptsForPart } from './questions'
import { createTranscriptAudioCopy } from '@/features/simulator/gemini'
import { useGeminiLive } from '@/features/simulator/useGeminiLive'
import type { TestPart, TestResult, TranscriptEntry } from '@/features/simulator/types'
import { loadConversationAudioCopy, loadTranscriptAudio } from '@/features/simulator/recordingStorage'
import { TranscriptAudioList } from '@/features/simulator/TranscriptAudioList'
import { SpeechHighlight } from '@/features/simulator/SpeechHighlight'
import { lastWordIndex, transcriptPositionAtTime, wordIndexAtElapsed } from '@/features/simulator/speechTiming'
import { loadPracticeModeArchive, loadPracticeModeAudio, savePracticeModeArchive, savePracticeModeAudio, type PracticeModeArchiveRecord, type PracticeModeArchiveTurn } from './archive'
import { AdaptiveAidWidget } from './AdaptiveAid'
import { isAdaptiveSupportType, type AdaptiveAid } from './adaptiveAidTypes'
import { drillRecommendationToolName, drillRecommendationTools, processDrillRecommendationToolCalls, type DrillRecommendation } from '@/features/drills/recommendations'
import { DrillRecommendations } from '@/features/drills/DrillRecommendations'

export type PracticeModeId = 'adaptive-scaffold' | 'live-feedback' | 'live-tips' | 'live-template' | 'criterion-builder' | 'timed-challenge' | 'guided-practice' | 'performance-analysis' | 'retry-improve' | 'model-answer' | 'mock-test' | 'cue-card-studio' | 'perspective-lab'
export interface GuidedPracticeLaunchRequest {
  id: string
  mode: PracticeModeId
  part?: TestPart
  question?: string
}
type SkillFocus = 'all' | 'fluency' | 'grammar' | 'vocabulary' | 'pronunciation'
type FullTestCoaching = 'part-by-part' | 'answer-by-answer'
type PracticeArchivePartFilter = 'all' | TestPart
type PracticeArchiveAudioFilter = 'all' | 'with-audio' | 'transcript-only'
const modelAnswerToolName = 'prepare_question_and_model_answer'
const modelAnswerTools: Tool[] = [{ functionDeclarations: [{
  name: modelAnswerToolName,
  behavior: Behavior.NON_BLOCKING,
  description: 'Create the next IELTS speaking question and its natural model answer together. The examiner will speak only the question; the app displays the answer for the learner to mirror.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The single IELTS speaking question to ask aloud.' },
      modelAnswer: { type: 'string', description: 'A natural, speakable model answer for the displayed question. Never read this aloud.' },
    },
    required: ['question', 'modelAnswer'],
    additionalProperties: false,
  },
}] }]
const liveTemplateToolName = 'prepare_question_and_answer_template'
const liveTemplateTools: Tool[] = [{ functionDeclarations: [{
  name: liveTemplateToolName,
  behavior: Behavior.NON_BLOCKING,
  description: 'Prepare one relevant IELTS speaking question and a flexible answer-building framework for the learner. The examiner speaks only the question; the app displays the framework.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The single IELTS speaking question to ask aloud.' },
      framework: {
        type: 'array',
        items: { type: 'string' },
        minItems: 3,
        maxItems: 5,
        description: 'Three to five concise ordered steps that help the learner build their own answer to this exact question.',
      },
      sentenceFrames: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 4,
        description: 'Two to four adaptable partial sentence frames with blanks, not completed answers.',
      },
    },
    required: ['question', 'framework', 'sentenceFrames'],
    additionalProperties: false,
  },
}] }]
const liveTipsToolName = 'prepare_question_and_live_tips'
const liveTipsTools: Tool[] = [{ functionDeclarations: [{
  name: liveTipsToolName,
  behavior: Behavior.NON_BLOCKING,
  description: 'Prepare the next IELTS speaking question with concise ideas and useful vocabulary for the learner to use naturally. Do not provide a full model answer.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The single IELTS speaking question to ask aloud.' },
      hints: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3, description: 'Two or three short idea prompts or answer-structure cues.' },
      vocabulary: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            phrase: { type: 'string', description: 'A useful word, collocation, or phrase.' },
            meaning: { type: 'string', description: 'A concise learner-friendly meaning.' },
            example: { type: 'string', description: 'A short example that fits the question.' },
          },
          required: ['phrase', 'meaning', 'example'],
          additionalProperties: false,
        },
        minItems: 2,
        maxItems: 4,
        description: 'Two to four natural expressions for the learner to use if they fit their answer.',
      },
    },
    required: ['question', 'hints', 'vocabulary'],
    additionalProperties: false,
  },
}] }]
const adaptiveScaffoldToolName = 'prepare_adaptive_speaking_scaffold'
const adaptiveScaffoldTools: Tool[] = [{ functionDeclarations: [{
  name: adaptiveScaffoldToolName,
  behavior: Behavior.NON_BLOCKING,
  description: 'Choose the smallest useful support for a learner who is stuck or requests help, and prepare that support for display. Do not call this when the learner is already expressing a clear idea; ask a Socratic follow-up instead.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      supportType: {
        type: 'string',
        enum: ['idea-cue', 'vocabulary', 'answer-structure', 'sentence-frames', 'worked-example'],
        description: 'The single most useful scaffold for the learner right now. Use a worked example only after they have tried and still need substantial help.',
      },
      question: { type: 'string', description: 'The exact current IELTS question this support is for.' },
      reason: { type: 'string', description: 'A short, encouraging explanation of why this support may help.' },
      hints: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3, description: 'Brief idea cues for idea-cue support.' },
      vocabulary: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            phrase: { type: 'string' },
            meaning: { type: 'string' },
            example: { type: 'string' },
          },
          required: ['phrase', 'meaning', 'example'],
          additionalProperties: false,
        },
        minItems: 2,
        maxItems: 4,
        description: 'Useful vocabulary and short examples for vocabulary support.',
      },
      framework: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5, description: 'Ordered answer steps for answer-structure support.' },
      sentenceFrames: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4, description: 'Adaptable partial sentence frames with blanks.' },
      workedExample: { type: 'string', description: 'A short illustrative sample, only when this is the least support that will help after the learner has already tried.' },
    },
    required: ['supportType', 'question', 'reason'],
    additionalProperties: false,
  },
}] }]

function completeNonBlockingToolCall(call: FunctionCall, response: Record<string, unknown>): FunctionResponse {
  return {
    id: call.id,
    name: call.name,
    response,
    willContinue: false,
    scheduling: FunctionResponseScheduling.WHEN_IDLE,
  }
}

interface PracticeMode {
  id: PracticeModeId
  title: string
  tagline: string
  description: string
  outcome: string
  icon: typeof MessageCircle
  tone: string
}

interface RetryAnswer {
  id: string
  testTitle: string
  prompt: string
  answer: string
  part: Exclude<TestPart, 'full'>
  completedAt: string
}

const adaptiveMode: PracticeMode = {
  id: 'adaptive-scaffold',
  title: 'Adaptive Coach',
  tagline: 'Support when you need it. Challenge when you’re ready.',
  description: 'One responsive coach combines ideas, vocabulary, answer structures, sentence frames, feedback, and Socratic follow-ups—choosing what fits your response and gradually easing support as you gain confidence.',
  outcome: 'Build independent, thoughtful answers with support that adapts to you',
  icon: Sparkles,
  tone: 'violet',
}

const modes: PracticeMode[] = [
  { id: 'live-feedback', title: 'Coach & Refine', tagline: 'One useful note after each answer', description: 'Practise a real IELTS part. After each answer, get one criterion-linked strength, one priority improvement, and a short natural rephrase.', outcome: 'Turn feedback into a stronger next answer', icon: MessageCircle, tone: 'coral' },
  { id: 'live-tips', title: 'Live Tips & Suggestions', tagline: 'See helpful ideas while you speak', description: 'Get a live question with concise idea prompts and useful vocabulary. Build your own answer and use only the suggestions that fit naturally.', outcome: 'Speak independently with just-in-time support', icon: Sparkles, tone: 'mint' },
  { id: 'live-template', title: 'Live Template', tagline: 'Build your answer with a live framework', description: 'Get a relevant question with a flexible, question-specific framework and sentence frames to help you shape your own response.', outcome: 'Structure your answer without memorising a script', icon: BookOpen, tone: 'blue' },
  { id: 'criterion-builder', title: 'Criterion Builder', tagline: 'Target one or more IELTS criteria', description: 'Practise with focused coaching on any one criterion, a combination of criteria, or all four together.', outcome: 'Build the speaking skills your answers need', icon: Target, tone: 'violet' },
  { id: 'timed-challenge', title: 'Timed Response Coach', tagline: 'Practise with a clock and coaching', description: 'Try realistic response timing, then get focused feedback and a chance to retry before moving on.', outcome: 'Improve pacing with guided feedback', icon: Timer, tone: 'amber' },
  { id: 'guided-practice', title: 'Guided Confidence', tagline: 'Use a scaffold, then make it your own', description: 'Get a small idea cue or answer structure when needed, then practise expressing the answer independently in your own words.', outcome: 'Move from supported ideas to independent speaking', icon: Lightbulb, tone: 'mint' },
  { id: 'performance-analysis', title: 'Part Practice Coach', tagline: 'Get guidance throughout one test part', description: 'Practise Part 1, 2, or 3 with helpful structure, optional hints, and a focused improvement cue before you finish.', outcome: 'Build confidence in a specific test section', icon: Lightbulb, tone: 'blue' },
  { id: 'retry-improve', title: 'Answer Replay', tagline: 'Use coaching to improve a saved answer', description: 'Revisit an earlier response with a targeted strategy, answer the same question again, and compare what changed.', outcome: 'Make guided progress visible across attempts', icon: RotateCcw, tone: 'rose' },
  { id: 'model-answer', title: 'Model & Mirror Coach', tagline: 'Study, try, and refine a model answer', description: 'Hear a live-generated question, study its model answer, then get a focused cue as you mirror and retry it.', outcome: 'Develop more natural spoken language', icon: BookOpen, tone: 'blue' },
  { id: 'mock-test', title: 'Full Guided Test', tagline: 'Get coaching across all three test parts', description: 'Work through Part 1, Part 2, and Part 3 in order, with AI coaching between sections and optional guidance whenever you need it.', outcome: 'Practise the complete test with support along the way', icon: Mic, tone: 'amber' },
  { id: 'cue-card-studio', title: 'Cue Card Studio', tagline: 'Plan, speak, extend', description: 'Focus on one Part 2 topic: organise quick notes, deliver a developed long turn, then handle natural follow-up questions.', outcome: 'Turn a prompt into a clear two-minute talk', icon: BookOpen, tone: 'mint' },
  { id: 'perspective-lab', title: 'Part 3 Perspective Lab', tagline: 'Develop and defend a point of view', description: 'Explore a broader issue through reasons, examples, comparisons, and a respectful counter-perspective.', outcome: 'Give deeper, more coherent discussion answers', icon: Sparkles, tone: 'violet' },
]

const skillOptions: { id: SkillFocus; label: string; prompt: string; description: string; icon: typeof Target }[] = [
  { id: 'fluency', label: 'Fluency & coherence', prompt: 'IELTS Fluency and Coherence: answering without long unnatural pauses, linking ideas clearly, extending answers with relevant reasons and examples, and staying on topic', description: 'Link ideas, extend answers, and keep a natural pace.', icon: MessageCircle },
  { id: 'vocabulary', label: 'Lexical resource', prompt: 'IELTS Lexical Resource: choosing precise topic vocabulary, natural collocations, and flexible paraphrases without forcing memorised phrases or idioms', description: 'Use precise words and natural collocations.', icon: Sparkles },
  { id: 'grammar', label: 'Grammar range & accuracy', prompt: 'IELTS Grammatical Range and Accuracy: expressing ideas with clear accurate sentences and a natural mix of simple and complex structures', description: 'Build accurate, varied spoken sentences.', icon: BookOpen },
  { id: 'pronunciation', label: 'Pronunciation', prompt: 'IELTS Pronunciation: speaking intelligibly with clear word sounds, natural word stress, connected speech, and varied intonation', description: 'Practise clarity, stress, and intonation.', icon: Mic },
]

const criterionModes: { id: SkillFocus; label: string; description: string; icon: typeof Target }[] = [
  { id: 'all', label: 'All criteria', description: 'Balanced practice across all four criteria.', icon: Sparkles },
  ...skillOptions.map(({ id, label, description, icon }) => ({ id, label, description, icon })),
]

const partOptions: { id: TestPart; label: string; help: string }[] = [
  { id: 'full', label: 'Full Speaking Test', help: 'Part 1 interview, Part 2 long turn, and Part 3 discussion' },
  { id: 'part1', label: 'Part 1 · Interview', help: 'Everyday topics and concise personal answers' },
  { id: 'part2', label: 'Part 2 · Long turn', help: 'Cue card, preparation, and extended response' },
  { id: 'part3', label: 'Part 3 · Discussion', help: 'Developed opinions and broader ideas' },
]

function makeSystemInstruction(mode: PracticeModeId, part: TestPart, question: string, skills: SkillFocus[], questionCount: number, retryAnswer: RetryAnswer | undefined, fullTestCoaching: FullTestCoaching): string {
  const selectedSkills = skills.includes('all') ? skillOptions : skillOptions.filter((option) => skills.includes(option.id))
  const skillLabels = selectedSkills.map((option) => option.label).join(', ')
  const skillPrompt = selectedSkills.map((option) => option.prompt).join('; ')
  const skillFocus = skills.includes('all') || selectedSkills.length === skillOptions.length ? 'all four IELTS Speaking criteria' : skillLabels
  const partDescription = part === 'full'
    ? 'a complete IELTS Speaking test in official order: Part 1 interview, one Part 2 cue card with one minute preparation and up to two minutes speaking, then related Part 3 discussion. Keep it around 11–14 minutes.'
    : part === 'part1'
      ? 'IELTS Speaking Part 1: about 4–5 minutes and 4–6 short questions across familiar topics.'
      : part === 'part2'
        ? 'IELTS Speaking Part 2: one cue card, one minute to prepare, up to two minutes to speak, and no more than two brief follow-ups.'
        : 'IELTS Speaking Part 3: about 4–5 minutes and 4–6 developed discussion questions.'
  const base = [
    'You are Speakia Coach, a warm and skilled IELTS Speaking practice partner.',
    'Speak clearly and naturally in English. Ask one question at a time and wait for the learner to answer.',
    `The selected practice format is ${part === 'full' ? 'a full IELTS Speaking mock test' : part}. The starting prompt is: "${question}"`,
    'Keep the practice within a realistic IELTS speaking part and its approximate test time: Part 1 is 4–5 minutes with at most six short questions, Part 2 is 3–4 minutes with one cue card long turn and no more than two brief same-topic follow-ups, and Part 3 is 4–5 minutes with at most six discussion questions. Count the starting prompt in these limits. Do not add extra questions, bonus rounds, or a new topic after the limit; end the practice briefly when the selected part is complete.',
    'Keep all feedback specific, supportive, realistic, and focused on the learner’s actual response. Never promise an IELTS band score.',
    `Develop the learner across ${skillFocus}: ${skillPrompt}. Integrate these criteria into practice rather than treating them as unrelated modes.`,
  ]
  base.push(`Practice boundary: ${partDescription} Count the starting prompt in the relevant part limit. Do not add bonus questions after the limit. In a full test, progress once from Part 1 to one Part 2 cue card and then to related Part 3 questions; do not restart a section.`)
  const instructions: Partial<Record<PracticeModeId, string>> = {
    'adaptive-scaffold': `Run an adaptive IELTS speaking coaching session, not a fixed sequence of exercises. Decide moment by moment whether this learner needs support, a deeper thinking challenge, focused feedback, or room to speak independently. Use observable evidence from what they say and their explicit requests; do not assume confidence or ability from accent, identity, or a single short reply. Ask one question at a time and allow the learner to finish.\n\nADAPTIVE DECISION RULE: When the learner gives a relevant, sufficiently developed answer, avoid adding unnecessary help. Respond briefly, then use one respectful Socratic follow-up to deepen their reasoning: ask for a reason, a concrete example, a comparison, a consequence, another perspective, or a reflection. Choose only the probe that naturally follows their idea; do not interrogate or stack questions. When they are stuck, give a very short/vague answer, say they do not know, or ask for help, switch to scaffolding. Call ${adaptiveScaffoldToolName} to display just one smallest-useful aid: an idea cue, a few relevant words, an answer structure, partial sentence frames, or (only after they have tried and still need substantial help) a brief worked example. Tailor it to the exact current question and explain briefly why it may help. Speak the question naturally, but never read the displayed aid or a worked example aloud as the candidate's answer. Invite them to adapt the aid and express their own ideas.\n\nFADE SUPPORT: Start with a light prompt, not a solution. After a successful supported attempt, reduce or remove the next scaffold and invite a more independent answer. If the learner remains blocked, increase support by only one step. Do not repeatedly show aids the learner has already used, and do not call the scaffold tool for every question. Keep feedback concise, evidence-based, and connected to ${skillFocus}; offer one strength and one practical next step when useful. Never provide a memorised script or claim an official IELTS band score. Integrate useful elements from live tips, answer templates, guided confidence, criterion-focused feedback, answer reflection, model-and-mirror practice, and discussion practice only when they fit the learner's need. For a full test, preserve IELTS part order and realistic timing; use adaptive coaching between sections without turning the test into a rigid lesson.` ,
    'live-feedback': `After each candidate answer, briefly identify one strength, one priority improvement connected to ${skillFocus}, and one natural rephrase or retry cue. Do not score or overwhelm the learner. Then ask the next related question.`,
    'live-tips': `Before every examiner response, call ${liveTipsToolName} with one relevant IELTS question, two or three concise idea or structure hints, and two to four useful vocabulary items with brief meanings and short examples. For the first pair, use this starting question: "${question}". For each later pair, create the next relevant IELTS question for ${part}. The app displays the hints and vocabulary, so speak only the question value aloud. Never provide or display a complete model answer; encourage the learner to choose and adapt suggestions in their own words. After each attempt, give one concise, evidence-based observation and a practical next step.`,
    'live-template': `Before every examiner response, call ${liveTemplateToolName} once to prepare a relevant question and a flexible answer-building framework. For the first question, use this starting question: "${question}". For later questions, create the next relevant IELTS question for ${part}. The framework must show three to five concise ordered steps and two to four partial sentence frames with blanks. Do not supply a completed answer or script. After the tool responds, speak only the question aloud; the app displays the framework. After each attempt, give one concise, evidence-based observation and a practical next step.`,
    'timed-challenge': `Coach the learner through a realistic, focused ${part} speaking challenge with response timing. Before each attempt, briefly explain the response goal. Never interrupt while the learner is speaking. After each answer, give one specific observation and one practical retry cue before continuing. For Part 2, present the cue card, respect the one-minute preparation shown in the interface, then invite a long turn of up to two minutes and give a focused coaching note afterward.`,
    'guided-practice': 'Act as a patient speaking tutor. Present the question, offer one small idea or answer framework if the learner requests help or appears stuck, then let them formulate their own answer. Ask supportive follow-up questions and gradually reduce scaffolding. Never dictate a full answer for the learner to memorise.',
    'performance-analysis': `Act as a supportive coach for ${part}, not a neutral examiner. Set a clear, manageable goal before the starting question, ask up to two natural follow-ups, and allow uninterrupted answers. Between answers, offer one concise observation and a practical improvement cue; provide a hint if asked. Close with one strength and one achievable next step.`,
    'retry-improve': `Help the learner retry this previous question: "${retryAnswer?.prompt ?? question}". Their original response was: "${retryAnswer?.answer ?? 'No earlier response was selected'}". Do not read their old answer aloud or copy it. Give one concise strategy based on the original, ask the same question, and invite an independent retry. Then compare the responses using specific evidence; do not claim an improvement unless the transcript supports it.`,
    'model-answer': `Run coach-led IELTS model-answer practice for ${part}. Before every examiner response, call ${modelAnswerToolName} once with a JSON question and its matching natural modelAnswer. For the first pair, use this starting question: "${question}". For each later pair, create the next relevant IELTS question for ${part}. Make Part 1 answers about 2–3 sentences, Part 2 answers a developed long turn, and Part 3 answers a concise developed response. After the tool responds, speak only the question value verbatim; never read or mention modelAnswer. Let the learner study the displayed answer and mirror it aloud. After the attempt, identify one useful language or delivery choice from the model, give one specific retry cue, and invite the learner to say it again in their own natural voice before moving on.`,
    'criterion-builder': `Run guided IELTS speaking practice that deliberately targets ${skillFocus}. Give specific, practical coaching tied to the selected criterion or criteria after each response, but keep the practice conversational and do not assign an official band score.`,
  }
  instructions['mock-test'] = `Act as a supportive IELTS speaking coach guiding a complete Part 1, Part 2, and Part 3 practice in official order. This is not an independent exam simulation. At the start of each part, briefly explain its goal and give one useful strategy. Ask one question at a time and never interrupt a candidate answer. ${fullTestCoaching === 'answer-by-answer' ? 'After every answer, give one concise, evidence-based strength and one practical improvement cue, then let the learner continue; keep coaching brief so all three parts can be completed.' : 'After each part, give a short, evidence-based strength and one improvement cue, then explain how to apply it in the next part.'} If the learner asks for help, offer a small scaffold without supplying a memorised answer. Keep Part 2 preparation and speaking timing realistic, connect Part 3 to the cue-card topic, and end with a concise review of progress across the three parts. The starting question is the first Part 1 question.`
  instructions['cue-card-studio'] = `Run a focused Part 2 session. Present the selected cue card, allow one minute for brief planning notes, and then invite a long turn of up to two minutes. Do not interrupt. Ask up to two natural same-topic follow-ups, then give one useful ${skillFocus} note and one next-step cue.`
  instructions['perspective-lab'] = `Run an IELTS Part 3 discussion. Ask the starting question, then no more than ${Math.min(questionCount, 6)} broader questions. Invite reasons, examples, comparisons, and a counter-view without forcing a memorised structure. Give one brief cue focused on ${skillFocus} after each answer, then one strength and next step at the end.`
  return `${base.join('\n')}\n${instructions[mode] ?? 'Conduct a short IELTS speaking practice within the selected part and question limit.'}`
}

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

async function prepareArchiveTurns(transcript: TranscriptEntry[], archiveId: string, completedAt: string): Promise<PracticeModeArchiveTurn[]> {
  const ordered = transcript
    .filter((turn) => turn.role !== 'assessment' && turn.text.trim())
    .map((turn, index) => ({ turn, index, order: typeof turn.audioOrder === 'number' ? turn.audioOrder : Number.MAX_SAFE_INTEGER + index }))
    .sort((left, right) => left.order - right.order)
  const spoken = ordered.filter(({ turn }) => turn.role === 'examiner' || turn.role === 'candidate')
  let durationByIndex = new Map<number, number>()
  let timingAvailable = spoken.length > 0 && spoken.every(({ turn }) => turn.audio instanceof Blob)
  if (timingAvailable) {
    const context = new AudioContext()
    try {
      for (const { turn, index } of spoken) {
        durationByIndex.set(index, (await context.decodeAudioData(await (turn.audio as Blob).arrayBuffer())).duration)
      }
    } catch (error) {
      console.error('Unable to time individual Practice Modes transcript turns.', error)
      timingAvailable = false
      durationByIndex = new Map()
    } finally {
      if (context.state !== 'closed') await context.close()
    }
  }
  let audioOffset = 0
  return ordered.map(({ turn, index }) => {
    const duration = durationByIndex.get(index)
    const timed = timingAvailable && typeof duration === 'number'
    const archivedTurn: PracticeModeArchiveTurn = {
      id: turn.id ?? `${archiveId}-${index}`,
      role: turn.role === 'candidate' ? 'candidate' : 'examiner',
      text: turn.text.trim(),
      completedAt,
      ...(timed ? { audioStartSeconds: audioOffset, audioDurationSeconds: duration } : {}),
    }
    if (timed) audioOffset += duration + 0.25
    return archivedTurn
  })
}

const archivedModeNames = ['Live Feedback', 'Live Tips & Suggestions', 'Drill Mode', 'Timed Challenge', 'Guided Practice', 'Performance Analysis', 'Retry & Improve', 'Live Model Answer', 'Coach & Refine', 'Criterion Builder', 'Timed Response', 'Guided Confidence', 'Independent Recording', 'Answer Replay', 'Model & Mirror', 'Full Mock Test', 'Cue Card Studio', 'Part 3 Perspective Lab', 'Scoring Skill Coach', 'Timed Response Coach', 'Part Practice Coach', 'Model & Mirror Coach', 'Full Guided Test']
function isLegacyPracticeModeResult(result: TestResult) {
  return archivedModeNames.some((name) => result.title.startsWith(`${name} ·`) || result.title === name)
}

function ArchiveAudio({ username, record, audioRef, onPlayback }: {
  username: string
  record: PracticeModeArchiveRecord
  audioRef: RefObject<HTMLAudioElement | null>
  onPlayback: (time: number, duration: number, playing: boolean) => void
}) {
  const [audioUrl, setAudioUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let url = ''
    setAudioUrl('')
    setError('')
    if (record.audioAvailable) void loadPracticeModeAudio(username, record.id).then((audio) => {
      if (!active) return
      if (!audio) { setError('The saved audio is unavailable on this device.'); return }
      url = URL.createObjectURL(audio)
      setAudioUrl(url)
    }).catch(() => { if (active) setError('Unable to load this session audio.') })
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [username, record.id, record.audioAvailable])
  return <div className="practice-mode-archive-audio"><strong>Session recording</strong>{audioUrl ? <audio ref={audioRef} controls preload="metadata" src={audioUrl} onTimeUpdate={(event) => onPlayback(event.currentTarget.currentTime, event.currentTarget.duration, !event.currentTarget.paused)} onDurationChange={(event) => onPlayback(event.currentTarget.currentTime, event.currentTarget.duration, !event.currentTarget.paused)} onPlay={(event) => onPlayback(event.currentTarget.currentTime, event.currentTarget.duration, true)} onPause={(event) => onPlayback(event.currentTarget.currentTime, event.currentTarget.duration, false)} onEnded={(event) => onPlayback(event.currentTarget.currentTime, event.currentTarget.duration, false)}>Your browser does not support audio playback.</audio> : <small>{error || (record.audioAvailable ? 'Loading audio…' : 'No audio copy was saved for this session.')}</small>}</div>
}

function PracticeModeArchiveItem({ username, record, open, search }: { username: string; record: PracticeModeArchiveRecord; open: boolean; search: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playback, setPlayback] = useState({ time: 0, duration: 0, playing: false })
  const position = playback.playing ? transcriptPositionAtTime(record.turns, playback.time, playback.duration) : null
  const playTurn = (turn: PracticeModeArchiveTurn, index: number) => {
    const audio = audioRef.current
    if (!audio) return
    if (position?.turnIndex === index && playback.playing) { audio.pause(); return }
    const turnStart = typeof turn.audioStartSeconds === 'number'
      ? turn.audioStartSeconds
      : playback.duration * record.turns.slice(0, index).reduce((sum, item) => sum + Math.max(1, item.text.trim().split(/\s+/).filter(Boolean).length), 0)
        / Math.max(1, record.turns.reduce((sum, item) => sum + Math.max(1, item.text.trim().split(/\s+/).filter(Boolean).length), 0))
    audio.currentTime = turnStart
    void audio.play().catch((error) => console.error('Unable to play this Practice Modes transcript turn.', error))
  }
  return <details className="practice-mode-archive-item" open={open}>
    <summary><span className="practice-mode-archive-icon"><Mic size={17} /></span><span className="practice-mode-archive-meta"><strong>{record.mode} <small>{partOptions.find((option) => option.id === record.part)?.label ?? record.part}</small></strong><span>{record.topic} · {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.completedAt))}</span></span><span className="practice-mode-archive-duration">{formatDuration(record.durationSeconds)} · {record.turns.length} turns</span></summary>
    <div className="practice-mode-archive-content"><ArchiveAudio username={username} record={record} audioRef={audioRef} onPlayback={(time, duration, playing) => setPlayback({ time, duration: Number.isFinite(duration) ? duration : 0, playing })} /><div className="practice-mode-saved-transcript">{record.turns.map((turn, index) => {
      const active = position?.turnIndex === index
      const wordIndex = active ? position.wordIndex : -1
      return <article className={`practice-mode-turn practice-mode-turn-${turn.role}`} key={turn.id}>
        <span>{turn.role === 'candidate' ? 'You' : 'Speakia examiner'}<button type="button" className="practice-mode-turn-audio" aria-label={`Play ${turn.role === 'candidate' ? 'your' : 'examiner'} turn`} title="Play this turn in the session recording" disabled={!record.audioAvailable || (!Number.isFinite(turn.audioStartSeconds) && playback.duration <= 0)} onClick={() => playTurn(turn, index)}>{active && playback.playing ? <VolumeX size={15} /> : <Volume2 size={15} />}</button></span>
        <p><SpeechHighlight text={turn.text} wordIndex={wordIndex} search={search} /></p>
      </article>
    })}</div></div>
  </details>
}

export function PracticeModesPage({ apiKey, results, username, onOpenSettings, onOpenDrills, onOpenDrill, launchRequest, onLaunchHandled }: {
  apiKey: string
  results: TestResult[]
  username: string
  onOpenSettings: () => void
  onOpenDrills: () => void
  onOpenDrill: (drillId: string, context?: string) => void
  launchRequest?: GuidedPracticeLaunchRequest | null
  onLaunchHandled?: (id: string) => void
}) {
  const [selectedMode, setSelectedMode] = useState<PracticeModeId | null>(null)
  const [part, setPart] = useState<TestPart>('part1')
  const [selectedCriteria, setSelectedCriteria] = useState<SkillFocus[]>(['all'])
  const [fullTestCoaching, setFullTestCoaching] = useState<FullTestCoaching>('part-by-part')
  const [questionId, setQuestionId] = useState('')
  const [discussionQuestionCount, setDiscussionQuestionCount] = useState(5)
  const [retryAnswerId, setRetryAnswerId] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [challengeSeconds, setChallengeSeconds] = useState(0)
  const [challengeActive, setChallengeActive] = useState(false)
  const [challengeStage, setChallengeStage] = useState<'prep' | 'answer'>('answer')
  const [challengeStarted, setChallengeStarted] = useState(false)
  const [prepNotes, setPrepNotes] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [modelAnswer, setModelAnswer] = useState('')
  const [modelAnswerQuestion, setModelAnswerQuestion] = useState('')
  const [modelAnswerReady, setModelAnswerReady] = useState(false)
  const [liveTips, setLiveTips] = useState<{ question: string; hints: string[]; vocabulary: { phrase: string; meaning: string; example: string }[] } | null>(null)
  const [liveTemplate, setLiveTemplate] = useState<{ question: string; framework: string[]; sentenceFrames: string[] } | null>(null)
  const [adaptiveAid, setAdaptiveAid] = useState<AdaptiveAid | null>(null)
  const [drillRecommendation, setDrillRecommendation] = useState<DrillRecommendation | null>(null)
  const [archive, setArchive] = useState<PracticeModeArchiveRecord[]>(() => loadPracticeModeArchive(username))
  const [archiveSearch, setArchiveSearch] = useState('')
  const [archiveModeFilter, setArchiveModeFilter] = useState('all')
  const [archivePartFilter, setArchivePartFilter] = useState<PracticeArchivePartFilter>('all')
  const [archiveAudioFilter, setArchiveAudioFilter] = useState<PracticeArchiveAudioFilter>('all')
  const [lastArchivedId, setLastArchivedId] = useState('')
  const sessionStartedAt = useRef('')
  const processedLaunchRequestRef = useRef<string | null>(null)
  const modeConfigurationRef = useRef<HTMLDivElement>(null)
  const [pendingLaunchId, setPendingLaunchId] = useState('')
  const modelAnswerQuestionCountRef = useRef(0)
  const liveTipsQuestionCountRef = useRef(0)
  const liveTemplateQuestionCountRef = useRef(0)
  const challengeSecondsRef = useRef(0)
  const promptPart = part === 'full' ? 'part1' : part
  const questions = useMemo(() => practicePromptsForPart(promptPart), [promptPart])
  const selectedQuestion = questions.find((question) => question.id === questionId) ?? questions[0]
  const availablePartOptions = selectedMode === 'mock-test'
    ? partOptions.filter((option) => option.id === 'full')
    : selectedMode === 'adaptive-scaffold'
      ? partOptions
    : selectedMode === 'cue-card-studio'
      ? partOptions.filter((option) => option.id === 'part2')
      : selectedMode === 'perspective-lab'
        ? partOptions.filter((option) => option.id === 'part3')
        : partOptions.filter((option) => option.id !== 'full')
  const archiveModes = useMemo(() => [...new Set(archive.map((record) => record.mode))].sort((a, b) => a.localeCompare(b)), [archive])
  const filteredArchive = useMemo(() => {
    const query = archiveSearch.trim().toLocaleLowerCase()
    return archive.filter((record) => (archiveModeFilter === 'all' || record.mode === archiveModeFilter)
      && (archivePartFilter === 'all' || record.part === archivePartFilter)
      && (archiveAudioFilter === 'all' || (archiveAudioFilter === 'with-audio' ? record.audioAvailable : !record.audioAvailable))
      && (!query || `${record.mode} ${record.topic} ${record.turns.map((turn) => turn.text).join(' ')}`.toLocaleLowerCase().includes(query)))
  }, [archive, archiveAudioFilter, archiveModeFilter, archivePartFilter, archiveSearch])
  const hasArchiveFilters = Boolean(archiveSearch || archiveModeFilter !== 'all' || archivePartFilter !== 'all' || archiveAudioFilter !== 'all')
  const retryAnswers = useMemo<RetryAnswer[]>(() => results.filter((result) => !isLegacyPracticeModeResult(result)).flatMap((result) => result.answers.map((answer, index) => ({
    id: `${result.id}:${index}`,
    testTitle: result.title,
    prompt: answer.prompt,
    answer: answer.answer,
    part: answer.part,
    completedAt: result.completedAt,
  }))).filter((answer) => Boolean(answer.prompt && answer.answer)), [results])
  const retryAnswer = retryAnswers.find((answer) => answer.id === retryAnswerId)
  const activeMode = selectedMode === adaptiveMode.id ? adaptiveMode : modes.find((mode) => mode.id === selectedMode)
  const practiceQuestion = selectedMode === 'retry-improve' && retryAnswer ? retryAnswer.prompt : selectedQuestion?.question ?? ''
  const timedLimit = part === 'part2' ? 120 : part === 'part3' ? 60 : 45
  const questionLimit = part === 'part2' ? (selectedMode === 'model-answer' || selectedMode === 'live-template' ? 1 : 3) : part === 'full' ? 16 : 6
  const effectiveQuestionCount = Math.min(discussionQuestionCount, part === 'part2' ? 1 : 6)
  const timeRemaining = challengeSeconds
  const sessionInstruction = selectedMode && selectedQuestion
    ? makeSystemInstruction(selectedMode, part, practiceQuestion, selectedMode === 'criterion-builder' ? selectedCriteria : ['all'], effectiveQuestionCount, retryAnswer, fullTestCoaching)
    : ''
  const handleModelAnswerToolCall = useCallback(async (functionCalls: FunctionCall[]): Promise<FunctionResponse[]> => functionCalls.map((call) => {
    if (modelAnswerQuestionCountRef.current >= questionLimit) {
      return completeNonBlockingToolCall(call, { complete: true, instruction: 'The selected IELTS part is complete. Give a brief closing sentence and do not ask another question or call this function again.' })
    }
    const question = typeof call.args?.question === 'string' ? call.args.question.trim() : ''
    const answer = typeof call.args?.modelAnswer === 'string' ? call.args.modelAnswer.trim() : ''
    if (call.name !== modelAnswerToolName || !question || !answer) {
      setError('The live examiner could not prepare a question and model answer. Please try again.')
      return completeNonBlockingToolCall(call, { error: 'Provide both a non-empty question and modelAnswer, then continue by speaking only the question.' })
    }
    const isFirstQuestion = modelAnswerQuestionCountRef.current === 0
    setModelAnswerQuestion(question)
    setModelAnswer(answer)
    setModelAnswerReady(true)
    modelAnswerQuestionCountRef.current += 1
    return completeNonBlockingToolCall(call, {
      accepted: true,
      instruction: isFirstQuestion
        ? 'The app has displayed the model answer. Speak only the question value aloud, verbatim, then invite the learner to answer. Do not speak or mention modelAnswer.'
        : 'The app has displayed the next model answer. First give one brief, specific observation about the learner’s immediately preceding answer, then speak only the question value aloud and invite a retry or next answer. Do not speak or mention modelAnswer.',
    })
  }), [questionLimit])
  const handleLiveTipsToolCall = useCallback(async (functionCalls: FunctionCall[]): Promise<FunctionResponse[]> => functionCalls.map((call) => {
    if (liveTipsQuestionCountRef.current >= questionLimit) {
      return completeNonBlockingToolCall(call, { complete: true, instruction: 'The selected IELTS part is complete. Give a brief closing sentence and do not ask another question or call this function again.' })
    }
    const question = typeof call.args?.question === 'string' ? call.args.question.trim() : ''
    const rawHints = call.args?.hints
    const hints = Array.isArray(rawHints) ? rawHints.filter((hint): hint is string => typeof hint === 'string' && Boolean(hint.trim())).map((hint) => hint.trim()).slice(0, 3) : []
    const rawVocabulary = call.args?.vocabulary
    const vocabulary = Array.isArray(rawVocabulary) ? rawVocabulary.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) return []
      const item = entry as Record<string, unknown>
      if (typeof item.phrase !== 'string' || typeof item.meaning !== 'string' || typeof item.example !== 'string') return []
      const phrase = item.phrase.trim()
      const meaning = item.meaning.trim()
      const example = item.example.trim()
      return phrase && meaning && example ? [{ phrase, meaning, example }] : []
    }).slice(0, 4) : []
    if (call.name !== liveTipsToolName || !question || hints.length < 2 || vocabulary.length < 2) {
      setError('The live examiner could not prepare complete tips for this question. Please try again.')
      return completeNonBlockingToolCall(call, { error: 'Provide a non-empty question, at least two concise hints, and at least two complete vocabulary suggestions.' })
    }
    setLiveTips({ question, hints, vocabulary })
    liveTipsQuestionCountRef.current += 1
    return completeNonBlockingToolCall(call, { accepted: true, instruction: 'The app has displayed the hints and vocabulary. Ask the question aloud, then invite the learner to answer in their own words. After their answer, give one concise, evidence-based observation before preparing the next question and suggestions.' })
  }), [questionLimit])
  const handleLiveTemplateToolCall = useCallback(async (functionCalls: FunctionCall[]): Promise<FunctionResponse[]> => functionCalls.map((call) => {
    if (liveTemplateQuestionCountRef.current >= questionLimit) {
      return completeNonBlockingToolCall(call, { complete: true, instruction: 'The selected IELTS part is complete. Give a brief closing sentence and do not ask another question or call this function again.' })
    }
    const question = typeof call.args?.question === 'string' ? call.args.question.trim() : ''
    const rawFramework = call.args?.framework
    const framework = Array.isArray(rawFramework)
      ? rawFramework.filter((step): step is string => typeof step === 'string' && Boolean(step.trim())).map((step) => step.trim()).slice(0, 5)
      : []
    const rawFrames = call.args?.sentenceFrames
    const sentenceFrames = Array.isArray(rawFrames)
      ? rawFrames.filter((frame): frame is string => typeof frame === 'string' && Boolean(frame.trim())).map((frame) => frame.trim()).slice(0, 4)
      : []
    if (call.name !== liveTemplateToolName || !question || framework.length < 3 || sentenceFrames.length < 2) {
      setError('The live examiner could not prepare a complete answer template for this question. Please try again.')
      return completeNonBlockingToolCall(call, { error: 'Provide a non-empty question, at least three framework steps, and at least two partial sentence frames.' })
    }
    setLiveTemplate({ question, framework, sentenceFrames })
    liveTemplateQuestionCountRef.current += 1
    return completeNonBlockingToolCall(call, { accepted: true, instruction: 'The app has displayed the question-specific framework and partial sentence frames. Ask only the question aloud, then invite the learner to build an original answer using any helpful parts of the framework. Do not speak a full answer.' })
  }), [questionLimit])
  const handleAdaptiveScaffoldToolCall = useCallback(async (functionCalls: FunctionCall[]): Promise<FunctionResponse[]> => functionCalls.map((call) => {
    const supportType = call.args?.supportType
    const question = typeof call.args?.question === 'string' ? call.args.question.trim() : ''
    const reason = typeof call.args?.reason === 'string' ? call.args.reason.trim() : ''
    const textList = (value: unknown, limit: number) => Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()).slice(0, limit)
      : []
    const hints = textList(call.args?.hints, 3)
    const framework = textList(call.args?.framework, 5)
    const sentenceFrames = textList(call.args?.sentenceFrames, 4)
    const vocabulary = Array.isArray(call.args?.vocabulary) ? call.args.vocabulary.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) return []
      const item = entry as Record<string, unknown>
      if (typeof item.phrase !== 'string' || typeof item.meaning !== 'string' || typeof item.example !== 'string') return []
      const phrase = item.phrase.trim()
      const meaning = item.meaning.trim()
      const example = item.example.trim()
      return phrase && meaning && example ? [{ phrase, meaning, example }] : []
    }).slice(0, 4) : []
    const workedExample = typeof call.args?.workedExample === 'string' ? call.args.workedExample.trim() : ''
    const validType = isAdaptiveSupportType(supportType)
    const hasSupport = supportType === 'idea-cue' ? hints.length > 0
      : supportType === 'vocabulary' ? vocabulary.length >= 2
        : supportType === 'answer-structure' ? framework.length >= 3
          : supportType === 'sentence-frames' ? sentenceFrames.length >= 2
            : supportType === 'worked-example' && Boolean(workedExample)
    if (call.name !== adaptiveScaffoldToolName || !validType || !question || !reason || !hasSupport) {
      setError('The adaptive coach could not prepare a complete support aid. Please ask it to try again.')
      return completeNonBlockingToolCall(call, { error: 'Provide a valid supportType, exact question, short reason, and the matching complete support content.' })
    }
    const aid: AdaptiveAid = {
      supportType,
      question,
      reason,
      ...(hints.length ? { hints } : {}),
      ...(vocabulary.length ? { vocabulary } : {}),
      ...(framework.length ? { framework } : {}),
      ...(sentenceFrames.length ? { sentenceFrames } : {}),
      ...(workedExample ? { workedExample } : {}),
    }
    setAdaptiveAid(aid)
    return completeNonBlockingToolCall(call, {
      accepted: true,
      instruction: 'The app has displayed this single scaffold for the learner. Do not read the scaffold or any worked example aloud. Invite the learner to use only what helps and answer in their own words. After their attempt, reduce support if they are ready, or adjust one step if they remain stuck.',
    })
  }), [])
  const handleDrillRecommendationToolCall = useCallback(async (functionCalls: FunctionCall[]) => processDrillRecommendationToolCalls(
    functionCalls,
    setDrillRecommendation,
    setError,
  ), [])
  const selectedModeTools = selectedMode === 'adaptive-scaffold' ? adaptiveScaffoldTools
    : selectedMode === 'model-answer' ? modelAnswerTools
      : selectedMode === 'live-tips' ? liveTipsTools
        : selectedMode === 'live-template' ? liveTemplateTools
          : []
  const handleLiveToolCall = useCallback(async (functionCalls: FunctionCall[]): Promise<FunctionResponse[]> => {
    const recommendationCalls = functionCalls.filter((call) => call.name === drillRecommendationToolName)
    const modeCalls = functionCalls.filter((call) => call.name !== drillRecommendationToolName)
    const modeHandler = selectedMode === 'adaptive-scaffold' ? handleAdaptiveScaffoldToolCall
      : selectedMode === 'model-answer' ? handleModelAnswerToolCall
        : selectedMode === 'live-tips' ? handleLiveTipsToolCall
          : selectedMode === 'live-template' ? handleLiveTemplateToolCall
            : null
    const modeResponses = modeCalls.length && modeHandler ? await modeHandler(modeCalls) : []
    const recommendationResponses = recommendationCalls.length ? await handleDrillRecommendationToolCall(recommendationCalls) : []
    return [...modeResponses, ...recommendationResponses]
  }, [handleAdaptiveScaffoldToolCall, handleDrillRecommendationToolCall, handleLiveTemplateToolCall, handleLiveTipsToolCall, handleModelAnswerToolCall, selectedMode])
  const live = useGeminiLive({
    apiKey,
    systemInstruction: `${sessionInstruction}\n\nAfter at least two meaningful candidate attempts, if you observe a specific recurring speaking-skill gap, call ${drillRecommendationToolName} with concise evidence from this session and one to three matching drill IDs. Do not infer a weakness from one minor slip or make a stable diagnosis. The app will show the learner a choice of targeted drills; explain it briefly and let them decide.`,
    openingPrompt: selectedMode === 'adaptive-scaffold'
      ? `Welcome the learner to Adaptive Coach. Explain that you will offer just enough help when needed and ask deeper follow-up questions when they are ready. Start with this exact IELTS question: "${selectedQuestion?.question ?? ''}". Do not provide support automatically if the learner can begin independently.`
      : selectedMode === 'retry-improve' && retryAnswer
      ? `Ask the learner this exact IELTS question again: "${retryAnswer.prompt}". Wait for their answer, then compare it carefully with their earlier response.`
      : selectedMode === 'guided-practice'
        ? `Welcome the learner to guided ${part} practice. Present this question: "${selectedQuestion?.question ?? ''}". Tell them they can ask for a hint whenever they need one.`
        : selectedMode === 'live-tips'
          ? `Start Live Tips & Suggestions. Call ${liveTipsToolName} to prepare the first question "${selectedQuestion?.question ?? ''}" with two or three concise hints and useful vocabulary. Speak only the question aloud; the app displays the suggestions. Ask the learner to answer independently and weave in suggestions only when natural.`
          : selectedMode === 'live-template'
            ? `Start Live Template practice. Call ${liveTemplateToolName} to prepare the first question "${selectedQuestion?.question ?? ''}" and a question-specific answer framework with partial sentence frames. Speak only the question aloud; the app displays the framework for the learner to build their own answer. Never provide a completed answer.`
        : selectedMode === 'mock-test'
          ? `Begin a full guided IELTS Speaking practice. Explain that you will coach ${fullTestCoaching === 'answer-by-answer' ? 'briefly after each answer' : 'between sections'}, then start with this Part 1 question: "${selectedQuestion?.question ?? ''}". Follow the Part 1, Part 2, and Part 3 sequence in order and offer a small scaffold whenever the learner asks for help.`
        : selectedMode === 'cue-card-studio'
          ? `Welcome the learner to Cue Card Studio. Present this exact Part 2 cue card: "${selectedQuestion?.question ?? ''}". Explain that they have one minute to make notes, then invite a long turn of up to two minutes.`
        : selectedMode === 'perspective-lab'
          ? `Welcome the learner to the Part 3 Perspective Lab. Ask this starting question: "${selectedQuestion?.question ?? ''}" and invite them to explain their view with a reason or example.`
        : selectedMode === 'model-answer'
            ? `Start coach-led model-answer practice. Generate the first question and its model answer together by calling ${modelAnswerToolName}. Use this starting question as the first question: "${selectedQuestion?.question ?? ''}". Once the tool returns, speak only the question aloud, then let the learner study and mirror the displayed answer. After their attempt, give one useful observation and a short retry cue.`
          : `Welcome the learner to ${activeMode?.title ?? 'speaking practice'}. Present this IELTS question: "${selectedQuestion?.question ?? ''}".`,
    tools: [...selectedModeTools, ...drillRecommendationTools],
    toolConfig: { functionCallingConfig: {
      mode: FunctionCallingConfigMode.AUTO,
      allowedFunctionNames: [
        ...selectedModeTools.flatMap((tool) => tool.functionDeclarations?.flatMap((declaration) => declaration.name ? [declaration.name] : []) ?? []),
        drillRecommendationToolName,
      ],
    } },
    onToolCall: handleLiveToolCall,
  })
  const isLive = live.connected || live.connecting
  const latestCoachQuestion = [...live.transcript].reverse().find((turn) => turn.role === 'examiner' && turn.text.trim())?.text.trim()
  const drillContext = latestCoachQuestion
    || modelAnswerQuestion
    || liveTips?.question
    || liveTemplate?.question
    || practiceQuestion

  useEffect(() => {
    if (!selectedMode || selectedMode === adaptiveMode.id || isLive || pendingLaunchId) return
    const frameId = window.requestAnimationFrame(() => {
      modeConfigurationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [isLive, pendingLaunchId, selectedMode])

  useEffect(() => {
    let active = true
    void (async () => {
      let next = loadPracticeModeArchive(username)
      let changed = false
      for (const result of results.filter(isLegacyPracticeModeResult)) {
        const existing = next.find((record) => record.id === result.id)
        if (existing?.audioOrderVersion === 2 || (result.part !== 'full' && result.part !== 'part1' && result.part !== 'part2' && result.part !== 'part3')) continue
        const id = result.id
        let audioAvailable = existing?.audioAvailable ?? false
        let repairedTurns: PracticeModeArchiveTurn[] | null = null
        try {
          const sourceTurns = result.transcript.filter((turn) => turn.role !== 'assessment' && turn.text.trim())
          const turnsWithAudio = await Promise.all(sourceTurns.map(async (turn) => ({
            ...turn,
            audio: turn.id ? await loadTranscriptAudio(result.id, turn.id).catch(() => null) ?? undefined : undefined,
          })))
          if (turnsWithAudio.length > 0 && turnsWithAudio.every((turn) => turn.audio instanceof Blob)) {
            const orderedAudio = await createTranscriptAudioCopy(turnsWithAudio)
            await savePracticeModeAudio(username, id, orderedAudio)
            audioAvailable = true
            repairedTurns = await prepareArchiveTurns(turnsWithAudio, id, result.completedAt)
          } else {
            const audio = await loadConversationAudioCopy(result.id)
            if (audio) { await savePracticeModeAudio(username, id, audio); audioAvailable = true }
          }
        } catch (migrationError) { console.error('Unable to migrate a previous Practice Modes recording.', migrationError) }
        if (existing) {
          next = next.map((record) => record.id === id ? { ...record, turns: repairedTurns ?? record.turns, audioAvailable, audioOrderVersion: 2 } : record)
          changed = true
          continue
        }
        const turns = repairedTurns ?? await prepareArchiveTurns(result.transcript, id, result.completedAt)
        next.push({
          id, mode: result.title.split(' · ')[0], part: result.part,
          topic: result.answers[0]?.prompt ?? 'Speaking practice',
          startedAt: new Date(Date.parse(result.completedAt) - result.durationSeconds * 1000).toISOString(),
          completedAt: result.completedAt, durationSeconds: result.durationSeconds, turns, audioAvailable, audioOrderVersion: 2,
        })
        changed = true
      }
      if (changed) {
        next.sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
        savePracticeModeArchive(username, next)
      }
      if (active) setArchive(next)
    })()
    return () => { active = false }
  }, [username, results])

  useEffect(() => {
    if (!live.connected) return
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(interval)
  }, [live.connected])

  useEffect(() => {
    if (!challengeActive) return
    const interval = window.setInterval(() => {
      if (challengeSecondsRef.current <= 1) {
        setChallengeTime(0)
        setChallengeActive(false)
        if (challengeStage === 'prep') {
          setChallengeStage('answer')
          setChallengeTime(120)
          setChallengeStarted(false)
        }
      } else setChallengeTime(challengeSecondsRef.current - 1)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [challengeActive, challengeStage])

  function setChallengeTime(seconds: number) {
    challengeSecondsRef.current = seconds
    setChallengeSeconds(seconds)
  }
  function clearArchiveFilters() {
    setArchiveSearch('')
    setArchiveModeFilter('all')
    setArchivePartFilter('all')
    setArchiveAudioFilter('all')
  }
  function toggleCriterion(id: SkillFocus) {
    if (id === 'all') {
      setSelectedCriteria(['all'])
      return
    }
    setSelectedCriteria((current) => {
      const selected = current.includes('all') ? [] : current.filter((criterion) => criterion !== 'all')
      const next = selected.includes(id) ? selected.filter((criterion) => criterion !== id) : [...selected, id]
      return next.length ? next : ['all']
    })
  }
  function selectMode(id: PracticeModeId) {
    setSelectedMode(id)
    setQuestionId('')
    setError('')
    setModelAnswer('')
    setModelAnswerQuestion('')
    setModelAnswerReady(false)
    modelAnswerQuestionCountRef.current = 0
    setLiveTips(null)
    liveTipsQuestionCountRef.current = 0
    setLiveTemplate(null)
    liveTemplateQuestionCountRef.current = 0
    setAdaptiveAid(null)
    setDrillRecommendation(null)
    if (id === 'perspective-lab') setDiscussionQuestionCount(5)
    if (id === 'mock-test') setPart('full')
    else if (id === 'cue-card-studio') setPart('part2')
    else if (id === 'perspective-lab') setPart('part3')
    else if (part === 'full') setPart('part1')
    if (id === 'retry-improve') {
      const firstAnswer = retryAnswers[0]
      if (firstAnswer) {
        setRetryAnswerId(firstAnswer.id)
        setPart(firstAnswer.part)
      }
    }
  }

  async function beginSession() {
    setError('')
    setElapsed(0)
    setPrepNotes('')
    const startsWithPreparation = part === 'part2' && (selectedMode === 'timed-challenge' || selectedMode === 'cue-card-studio' || selectedMode === 'adaptive-scaffold')
    setChallengeStage(startsWithPreparation ? 'prep' : 'answer')
    setChallengeTime(startsWithPreparation ? 60 : 0)
    setChallengeActive(false)
    setChallengeStarted(false)
    setModelAnswer('')
    setModelAnswerQuestion('')
    setModelAnswerReady(false)
    modelAnswerQuestionCountRef.current = 0
    setLiveTips(null)
    liveTipsQuestionCountRef.current = 0
    setLiveTemplate(null)
    liveTemplateQuestionCountRef.current = 0
    setAdaptiveAid(null)
    setDrillRecommendation(null)
    if (!apiKey.trim()) {
      setError('Add your Speakia AI API key in Settings before starting a live practice session.')
      return
    }
    if (!selectedMode || !selectedQuestion) {
      setError('Choose a practice mode and question before starting.')
      return
    }
    if (selectedMode === 'retry-improve' && !retryAnswer) {
      setError('Choose a previous answer to retry, or complete a speaking practice first.')
      return
    }
    try {
      const connected = await live.start()
      if (!connected) setError(live.error || 'The live speaking session could not connect.')
      else sessionStartedAt.current = new Date().toISOString()
    } catch (caughtError) {
      console.error('Unable to start the Speakia practice mode session.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to start this practice session.')
    }
  }

  useEffect(() => {
    if (!launchRequest || processedLaunchRequestRef.current === launchRequest.id) return
    processedLaunchRequestRef.current = launchRequest.id
    const launchPart = launchRequest.mode === 'mock-test'
      ? 'full'
      : launchRequest.mode === 'cue-card-studio'
        ? 'part2'
        : launchRequest.mode === 'perspective-lab'
          ? 'part3'
          : launchRequest.part === 'full' || !launchRequest.part
            ? 'part1'
            : launchRequest.part
    const promptPart = launchPart === 'full' ? 'part1' : launchPart
    const availableQuestions = practicePromptsForPart(promptPart)
    const requestedQuestion = launchRequest.question?.trim().toLocaleLowerCase()
    const matchedQuestion = requestedQuestion
      ? availableQuestions.find((question) => `${question.topic}: ${question.question}`.toLocaleLowerCase().includes(requestedQuestion))
      : undefined
    setSelectedMode(launchRequest.mode)
    setPart(launchPart)
    setQuestionId(matchedQuestion?.id ?? '')
    if (launchRequest.mode === 'retry-improve') {
      const firstAnswer = retryAnswers[0]
      setRetryAnswerId(firstAnswer?.id ?? '')
      if (firstAnswer) setPart(firstAnswer.part)
    }
    setError('')
    setPendingLaunchId(launchRequest.id)
  }, [launchRequest, retryAnswers])

  useEffect(() => {
    if (!launchRequest || pendingLaunchId !== launchRequest.id || selectedMode !== launchRequest.mode) return
    const expectedPart = launchRequest.mode === 'mock-test'
      ? 'full'
      : launchRequest.mode === 'cue-card-studio'
        ? 'part2'
        : launchRequest.mode === 'perspective-lab'
          ? 'part3'
          : launchRequest.mode === 'retry-improve'
            ? retryAnswer?.part ?? part
            : launchRequest.part === 'full' || !launchRequest.part
              ? 'part1'
              : launchRequest.part
    if (part !== expectedPart) return
    setPendingLaunchId('')
    void beginSession().finally(() => onLaunchHandled?.(launchRequest.id))
  }, [beginSession, launchRequest, onLaunchHandled, part, pendingLaunchId, retryAnswer?.part, selectedMode])

  async function requestHint() {
    if (!live.connected) return
    if (selectedMode === 'adaptive-scaffold') {
      live.sendInstruction(`The learner has explicitly asked for support with the current IELTS question "${adaptiveAid?.question ?? practiceQuestion}". Choose the smallest useful scaffold based on the conversation so far, call ${adaptiveScaffoldToolName} to display that one aid, then invite the learner to answer independently. Do not give a complete model answer unless they have already tried and still need substantial support.`)
      return
    }
    live.sendInstruction(`Offer one concise hint for the IELTS question "${selectedQuestion?.question ?? ''}". Give a short idea, vocabulary cue, or simple structure only; do not provide a complete model answer. Then invite the learner to answer in their own words.`)
  }

  async function finishSession() {
    if (!live.connected || working) return
    setWorking(true)
    setError('')
    try {
      const stopped = await live.stop()
      if (stopped.recording.size === 0) throw new Error('No audio was recorded. Check microphone access and try the session again.')
      const audioCopy = await createTranscriptAudioCopy(stopped.transcript)
      const id = crypto.randomUUID()
      let audioAvailable = false
      if (audioCopy.size) {
        try { await savePracticeModeAudio(username, id, audioCopy); audioAvailable = true }
        catch (audioError) { console.error('Unable to archive Practice Modes audio.', audioError) }
      }
      const completedAt = new Date().toISOString()
      const turns = await prepareArchiveTurns(stopped.transcript, id, completedAt)
      const record: PracticeModeArchiveRecord = {
        id, mode: activeMode?.title ?? 'Practice', part,
        topic: selectedMode === 'mock-test'
          ? 'Part 1 interview · Part 2 cue card · Part 3 discussion'
          : selectedMode === 'retry-improve'
            ? retryAnswer?.prompt ?? 'Retry practice'
            : selectedQuestion?.topic ?? 'Speaking practice',
        startedAt: sessionStartedAt.current || new Date(Date.now() - elapsed * 1000).toISOString(),
        completedAt, durationSeconds: elapsed, turns, audioAvailable, audioOrderVersion: 2,
      }
      const nextArchive = [record, ...archive.filter((item) => item.id !== record.id)]
      if (!savePracticeModeArchive(username, nextArchive)) throw new Error('The session transcript could not be saved in this browser.')
      setArchive(nextArchive)
      setLastArchivedId(id)
    } catch (caughtError) {
      console.error('Unable to archive the Practice Modes session.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'The practice session could not be saved.')
    } finally {
      setWorking(false)
    }
  }

  function renderModeConfiguration() {
    if (!selectedMode) return null
    return <Card className="practice-mode-config">
      <div className="practice-mode-config-heading"><div><span className="section-kicker">SET UP YOUR SESSION</span><h2>{activeMode?.title}</h2><p>{activeMode?.tagline}</p></div><button type="button" aria-label="Close mode setup" onClick={() => { setSelectedMode(null); setError('') }}><X size={17} /></button></div>
      {selectedMode === 'criterion-builder' && <section className="practice-mode-criterion-picker" aria-label="Select IELTS criteria to focus on">
        <div><strong>Choose your criterion focus</strong><p>Select one criterion, combine several, or choose all four.</p></div>
        <div className="practice-mode-criterion-options" role="group" aria-label="Criterion Builder focus">
          {criterionModes.map((criterion) => {
            const CriterionIcon = criterion.icon
            const selected = criterion.id === 'all' ? selectedCriteria.includes('all') : selectedCriteria.includes(criterion.id)
            return <button type="button" key={criterion.id} className={selected ? 'practice-mode-criterion-option-active' : ''} aria-pressed={selected} onClick={() => toggleCriterion(criterion.id)}>
              <span><CriterionIcon size={15} /></span><strong>{criterion.label}</strong><small>{criterion.description}</small>{selected && <Check size={14} />}
            </button>
          })}
        </div>
      </section>}
      <div className="practice-mode-config-grid">
        <label>IELTS speaking format<select value={part} disabled={availablePartOptions.length === 1} onChange={(event) => { const nextPart = event.target.value as TestPart; setPart(nextPart); setQuestionId('') }}>{availablePartOptions.map((option) => <option key={option.id} value={option.id}>{option.label} — {option.help}</option>)}</select></label>
        <label>Starting question<select value={selectedQuestion?.id ?? ''} onChange={(event) => setQuestionId(event.target.value)}>{questions.map((question) => <option key={question.id} value={question.id}>{question.topic}: {question.question}</option>)}</select></label>
        {selectedMode === 'mock-test' && <label>Full-test coaching style<select value={fullTestCoaching} onChange={(event) => setFullTestCoaching(event.target.value as FullTestCoaching)}><option value="part-by-part">Coach between parts · guidance and feedback at each transition</option><option value="answer-by-answer">Coach after each answer · brief feedback throughout all three parts</option></select></label>}
        {selectedMode === 'retry-improve' && <label>Response to retry<select value={retryAnswerId} onChange={(event) => { setRetryAnswerId(event.target.value); const answer = retryAnswers.find((item) => item.id === event.target.value); if (answer) setPart(answer.part) }}>{retryAnswers.map((answer) => <option key={answer.id} value={answer.id}>{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(answer.completedAt))} · {answer.prompt.slice(0, 90)}</option>)}</select>{retryAnswers.length === 0 && <small>Complete a practice test first to add responses to your history.</small>}</label>}
        {selectedMode === 'perspective-lab' && <label>Discussion questions<select value={effectiveQuestionCount} onChange={(event) => setDiscussionQuestionCount(Number(event.target.value))}>{[3, 5, 6].map((count) => <option key={count} value={count}>{count} questions</option>)}</select></label>}
      </div>
      <div className="practice-mode-behaviour"><span><BookOpen size={15} /></span><p><strong>How this mode works</strong>{activeMode?.description}</p></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!apiKey.trim() && <div className="practice-mode-key-notice">Connect Speakia AI in Settings before starting voice practice. <button type="button" onClick={onOpenSettings}>Open Settings <ArrowRight size={13} /></button></div>}
      <div className="practice-mode-config-footer"><span><Mic size={15} /> Live AI-guided practice · saved in Guided Practice</span><Button className="practice-mode-start" onClick={() => void beginSession()} disabled={!apiKey.trim() || (selectedMode === 'retry-improve' && !retryAnswer)}><Mic size={16} /> Start {activeMode?.title} <ArrowRight size={15} /></Button></div>
    </Card>
  }

  return <div className="page-content inner-page practice-modes-page">
    <header className="practice-modes-heading">
      <div><p className="eyebrow">SPEAKIA IELTS · TRAINING STUDIO</p><h1>Guided Practice</h1><p className="page-subtitle">Choose a practice style, strengthen all four speaking criteria, and build the confidence to use your skills on test day.</p></div>
      <Button type="button" variant="outline" className="practice-mode-drills-link" onClick={onOpenDrills}><Repeat2 size={15} /> Need repetition? Explore Speaking Drills <ArrowRight size={14} /></Button>
    </header>

    {isLive ? <Card className="practice-mode-live">
      <div className="practice-mode-live-top"><div><span className="practice-mode-live-indicator" /><div><p className="section-kicker">{activeMode?.title.toLocaleUpperCase()}</p><h2>{partOptions.find((option) => option.id === part)?.label}</h2></div></div><div className="practice-mode-live-meta"><span className="practice-mode-clock"><Clock3 size={15} /> {formatDuration(elapsed)}</span></div></div>
      {(selectedMode === 'timed-challenge' || selectedMode === 'cue-card-studio' || (selectedMode === 'adaptive-scaffold' && part === 'part2')) && <div className={`practice-mode-countdown ${timeRemaining === 0 && !challengeActive ? 'practice-mode-countdown-ended' : ''}`}><Timer size={17} /><span>{challengeStage === 'prep' ? 'ONE-MINUTE PLANNING' : 'LONG-TURN TIMER'}</span><strong>{formatDuration(timeRemaining)}</strong><button type="button" onClick={() => { if (challengeActive) setChallengeActive(false); else { if (challengeSeconds === 0) setChallengeTime(challengeStage === 'prep' ? 60 : timedLimit); setChallengeStarted(true); setChallengeActive(true) } }}>{challengeActive ? 'Pause' : !challengeStarted && challengeStage === 'prep' ? 'Start planning' : !challengeStarted && challengeStage === 'answer' && part === 'part2' ? 'Start long turn' : challengeSeconds === 0 ? 'Start answer timer' : 'Resume'}</button></div>}
      {part === 'part2' && (selectedMode === 'cue-card-studio' || selectedMode === 'timed-challenge' || selectedMode === 'adaptive-scaffold') && <label className="practice-mode-prep-notes"><span>Quick planning notes</span><small>Jot down a few keywords or a simple story path. Keep it to ideas, not a written script.</small><textarea value={prepNotes} onChange={(event) => setPrepNotes(event.target.value)} rows={3} maxLength={600} placeholder="Who / where / what happened / why it mattered…" /></label>}
      <div className="practice-mode-live-question"><span>{selectedMode === 'adaptive-scaffold' ? 'ADAPTIVE COACH · SUPPORT FADES AS YOU GAIN INDEPENDENCE' : selectedMode === 'model-answer' || selectedMode === 'live-tips' || selectedMode === 'live-template' ? 'QUESTION' : selectedMode === 'criterion-builder' ? `CRITERION FOCUS · ${selectedCriteria.includes('all') ? 'ALL FOUR' : selectedCriteria.map((id) => skillOptions.find((option) => option.id === id)?.label).filter(Boolean).join(' · ').toLocaleUpperCase()}` : 'ALL FOUR IELTS SPEAKING CRITERIA'}</span><strong>{selectedMode === 'model-answer' ? modelAnswerQuestion || 'The live examiner is preparing a question…' : selectedMode === 'live-tips' ? liveTips?.question || 'The live examiner is preparing a question and suggestions…' : selectedMode === 'live-template' ? liveTemplate?.question || 'The live examiner is preparing a question and answer framework…' : practiceQuestion}</strong><p>{live.status || 'Connecting your live practice…'}</p></div>
      {selectedMode === 'adaptive-scaffold' && adaptiveAid && <AdaptiveAidWidget aid={adaptiveAid} />}
      {drillRecommendation && <DrillRecommendations recommendation={drillRecommendation} context={drillContext} onOpenDrill={onOpenDrill} />}
      {selectedMode === 'retry-improve' && retryAnswer && <div className="practice-mode-original-answer"><span>YOUR EARLIER ANSWER · {retryAnswer.testTitle}</span><p>{retryAnswer.answer}</p><small>Listen for what you can make clearer, more developed, or more natural this time.</small></div>}
      {selectedMode === 'model-answer' && <div className="practice-mode-model-answer" aria-live="polite"><span>MODEL ANSWER · MIRROR THIS ALOUD</span><p>{modelAnswerReady ? modelAnswer : 'The live examiner is preparing the model answer…'}</p></div>}
      {selectedMode === 'live-tips' && <section className="practice-mode-live-tips" aria-live="polite" aria-label="Live answer tips and vocabulary">
        <div className="practice-mode-live-tips-heading"><Sparkles size={16} /><div><strong>Ideas to shape your own answer</strong><span>Use what helps; you do not need to include everything.</span></div></div>
        {liveTips ? <div className="practice-mode-live-tips-grid">
          <div><h3>Quick hints</h3><ul>{liveTips.hints.map((hint, index) => <li key={`${index}-${hint}`}>{hint}</li>)}</ul></div>
          <div><h3>Useful vocabulary</h3><div className="practice-mode-live-tips-vocabulary">{liveTips.vocabulary.map((item) => <article key={item.phrase}><strong>{item.phrase}</strong><span>{item.meaning}</span><small>{item.example}</small></article>)}</div></div>
        </div> : <p className="practice-mode-live-tips-empty">Your live hints and vocabulary will appear here with the next question.</p>}
      </section>}
      {selectedMode === 'live-template' && <section className="practice-mode-live-tips practice-mode-live-template" aria-live="polite" aria-label="Live answer-building template">
        <div className="practice-mode-live-tips-heading"><BookOpen size={16} /><div><strong>Build your own answer</strong><span>Use this flexible framework as a guide, not a script.</span></div></div>
        {liveTemplate ? <div className="practice-mode-template-content">
          <ol>{liveTemplate.framework.map((step, index) => <li key={`${index}-${step}`}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
          <div className="practice-mode-template-frames"><h3>Sentence frames</h3>{liveTemplate.sentenceFrames.map((frame, index) => <p key={`${index}-${frame}`}>{frame}</p>)}</div>
        </div> : <p className="practice-mode-live-tips-empty">A question-specific framework and sentence frames will appear here with the next question.</p>}
      </section>}
      {live.candidateDraft && <p className="practice-mode-draft" aria-live="polite">{live.candidateDraft}</p>}
      <div className="practice-mode-transcript" aria-live="polite"><TranscriptAudioList turns={live.transcript.slice(-8)} variant="live" activeTurnId={live.activeExaminerTurnId} activeWordIndex={wordIndexAtElapsed(live.transcript.find((turn) => turn.id === live.activeExaminerTurnId)?.text ?? '', live.examinerSpeechElapsedSeconds, live.examinerSpeechDurationSeconds)} />{live.candidateDraft && <div className="live-transcript-line candidate-line live-draft-line"><span>YOU · LIVE</span><p><SpeechHighlight text={live.candidateDraft} wordIndex={lastWordIndex(live.candidateDraft)} /></p></div>}</div>
      {live.error && <p className="form-error" role="alert">{live.error}</p>}
      <div className="practice-mode-live-actions">
        {(selectedMode === 'guided-practice' || selectedMode === 'adaptive-scaffold') && <Button variant="outline" onClick={() => void requestHint()}><Lightbulb size={15} />{selectedMode === 'adaptive-scaffold' ? 'I need a scaffold' : 'I need a hint'}</Button>}
        <Button variant="outline" onClick={live.toggleMicMuted}>{live.micMuted ? <MicOff size={15} /> : <Mic size={15} />}{live.micMuted ? 'Unmute microphone' : 'Mute microphone'}</Button>
        <Button className="practice-mode-finish" onClick={() => void finishSession()} disabled={working}>{working ? <><LoaderCircle size={15} className="spin" /> Saving session…</> : <>Finish &amp; save session <ArrowRight size={15} /></>}</Button>
      </div>
      {(working || live.connecting) && <p className="practice-mode-status" role="status">{working ? 'Saving your transcript and session audio…' : 'Connecting to Speakia Coach…'}</p>}
    </Card> : <>
      <section className="practice-modes-intro" aria-label="Guided Practice overview">
        <div className="practice-modes-intro-copy">
          <span className="practice-modes-focus-mark"><Target size={18} /></span>
          <div><strong>Practise with purpose. Be ready for every IELTS Speaking criterion.</strong><p>Each mode combines focused practice with coaching across fluency and coherence, lexical resource, grammatical range and accuracy, and pronunciation. Build confidence, then carry those skills into test day.</p></div>
        </div>
        <div className="practice-modes-criteria" aria-label="Four IELTS Speaking assessment criteria">
          {skillOptions.map((criterion) => {
            const CriterionIcon = criterion.icon
            return <article key={criterion.id}><span><CriterionIcon size={16} /></span><div><strong>{criterion.label}</strong><p>{criterion.description}</p></div></article>
          })}
        </div>
      </section>

      <section className="practice-mode-master" aria-labelledby="practice-mode-master-title">
        <div className="practice-mode-master-copy"><span className="practice-mode-master-mark"><Sparkles size={22} /></span><div><span className="section-kicker">ONE COACH · MANY WAYS TO LEARN</span><h2 id="practice-mode-master-title">Adaptive Coach</h2><p>Get the right kind of help at the right moment. Your coach can offer a small idea cue, useful vocabulary, a flexible structure, sentence starters, or a worked example when you need support—and switch to thoughtful Socratic questions when you’re ready to develop your ideas further.</p></div></div>
        <div className="practice-mode-master-points" aria-label="Adaptive Coach approach"><span><Check size={14} /> Support fades as you improve</span><span><Check size={14} /> Your own ideas stay central</span><span><Check size={14} /> Covers all four IELTS criteria</span></div>
        <Button type="button" className={`practice-mode-master-button ${selectedMode === adaptiveMode.id ? 'is-selected' : ''}`} onClick={() => selectMode(adaptiveMode.id)} aria-pressed={selectedMode === adaptiveMode.id}><Lightbulb size={17} />{selectedMode === adaptiveMode.id ? 'Adaptive Coach selected' : 'Start with Adaptive Coach'}<ArrowRight size={16} /></Button>
      </section>
      {selectedMode === adaptiveMode.id && renderModeConfiguration()}

      <div className="practice-mode-divider" role="separator" aria-label="Individual Guided Practice modes"><span>OR EXPLORE INDIVIDUAL PRACTICE MODES</span></div>

      <section className="practice-modes-catalogue" aria-labelledby="practice-modes-catalogue-title">
        <div className="practice-modes-section-title"><div><span className="section-kicker">CHOOSE ONE FOCUSED APPROACH</span><h2 id="practice-modes-catalogue-title">Individual practice modes</h2></div><span>Explore each learning aid on its own</span></div>
        <div className="practice-modes-grid">{modes.map((mode) => {
          const ModeIcon = mode.icon
          const selected = mode.id === selectedMode
          return <Fragment key={mode.id}>
            <motion.button type="button" className={`practice-mode-card practice-mode-${mode.tone} ${selected ? 'practice-mode-card-selected' : ''}`} onClick={() => selectMode(mode.id)} aria-pressed={selected}>
              <span className="practice-mode-icon"><ModeIcon size={20} /></span><span className="practice-mode-card-tag">{mode.tagline}</span><strong>{mode.title}</strong><span className="practice-mode-description">{mode.description}</span><span className="practice-mode-outcome"><ArrowRight size={14} />{mode.outcome}</span>
            </motion.button>
            {selected && <div className="practice-mode-config-slot" ref={modeConfigurationRef}>{renderModeConfiguration()}</div>}
          </Fragment>
        })}</div>
      </section>

      {error && !selectedMode && <p className="form-error" role="alert">{error}</p>}
    </>}

    <section className="practice-mode-archive" aria-labelledby="practice-mode-archive-title">
      <div className="practice-modes-section-title"><div><span className="section-kicker">YOUR PRACTICE MODES</span><h2 id="practice-mode-archive-title">Session archive</h2></div><span>{filteredArchive.length} of {archive.length} {archive.length === 1 ? 'session' : 'sessions'} · transcripts and audio stay here.</span></div>
      {lastArchivedId && <p className="practice-mode-archive-saved" role="status"><Check size={15} /> Session saved to your Guided Practice archive.</p>}
      {archive.length > 0 && <div className="practice-mode-archive-controls"><label className="practice-mode-archive-search"><Search size={16} /><input aria-label="Search Guided Practice archive" placeholder="Search mode, topic, or transcript" value={archiveSearch} onChange={(event) => setArchiveSearch(event.target.value)} />{archiveSearch && <button type="button" aria-label="Clear search" onClick={() => setArchiveSearch('')}><X size={15} /></button>}</label><label className="practice-mode-archive-filter"><ListFilter size={15} /><span>Mode</span><select aria-label="Filter Guided Practice archive by mode" value={archiveModeFilter} onChange={(event) => setArchiveModeFilter(event.target.value)}><option value="all">All modes</option>{archiveModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label><label className="practice-mode-archive-filter"><span>Part</span><select aria-label="Filter Guided Practice archive by part" value={archivePartFilter} onChange={(event) => setArchivePartFilter(event.target.value as PracticeArchivePartFilter)}><option value="all">All parts</option>{partOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label className="practice-mode-archive-filter"><span>Audio</span><select aria-label="Filter Guided Practice archive by audio availability" value={archiveAudioFilter} onChange={(event) => setArchiveAudioFilter(event.target.value as PracticeArchiveAudioFilter)}><option value="all">All sessions</option><option value="with-audio">Recording available</option><option value="transcript-only">Transcript only</option></select></label></div>}
      {archive.length === 0
        ? <Card className="practice-mode-archive-empty"><BookOpen size={20} /><strong>Your practice sessions will appear here</strong><p>Finish a session to keep its transcript and audio recording for later.</p></Card>
        : filteredArchive.length > 0
          ? <div className="practice-mode-archive-list">{filteredArchive.map((record) => {
            const searchTerms = archiveSearch.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
            const transcriptMatches = searchTerms.some((term) => record.turns.some((turn) => turn.text.toLocaleLowerCase().includes(term)))
            return <PracticeModeArchiveItem key={record.id} username={username} record={record} open={record.id === lastArchivedId || transcriptMatches} search={archiveSearch} />
          })}</div>
          : <Card className="practice-mode-archive-empty"><BookOpen size={20} /><strong>No practice sessions match these filters</strong><p>Try another mode, part, audio option, or search term.</p>{hasArchiveFilters && <Button variant="outline" onClick={clearArchiveFilters}>Clear filters</Button>}</Card>}
    </section>
  </div>
}
