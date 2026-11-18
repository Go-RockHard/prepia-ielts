import { GoogleGenAI } from '@/lib/geminiClient'
import { completeGeneratedQuestionShape, parseJsonObject } from '@/features/skills/literacyJson'
import type { PracticeSet } from '@/features/skills/questionTypes'
import {
  reserveLocalTopic,
  deleteLocalAudioAsset,
  saveLocalAudioAsset,
  saveLocalContentWorkflowJob,
  saveLocalContentPackage,
  updateLocalTopicExposure,
  type LocalAudioAsset,
  type LocalContentWorkflowJob,
  type LocalContentPackage,
  type SkillProduct,
  type TopicExposure,
} from '@/features/skills/literacyStorage'
import type { SkillQuestion } from '@/features/skills/questionTypes'

export const CONTENT_GENERATION_MODELS = [
  { id: 'gemini-4-hydrogen', label: 'Prepia Advanced' },
  { id: 'gemini-3.8-flash', label: 'Prepia Core' },
  { id: 'gemini-3.5-flash-lite', label: 'Prepia Swift' },
] as const
export const CONTENT_REVIEW_MODELS = CONTENT_GENERATION_MODELS
export const LISTENING_TTS_MODELS = [
  { id: 'gemini-3.8-flash-tts', label: 'Prepia Voice' },
  { id: 'gemini-3.8-flash-lite-tts', label: 'Prepia Voice Lite' },
] as const
export type ContentGenerationModel = typeof CONTENT_GENERATION_MODELS[number]['id']
export type ContentReviewModel = typeof CONTENT_REVIEW_MODELS[number]['id']
export type ListeningTtsModel = typeof LISTENING_TTS_MODELS[number]['id']

export type PracticeGenerationRequest = {
  product: SkillProduct
  username: string
  topic: string
  topicAngle: string
  level: 'Foundation' | 'Intermediate'
  questionCount: number
  minutes: number
  testType: 'Academic' | 'General Training'
  contentMode?: 'practice' | 'drill' | 'full-mock'
  questionTypes?: SkillQuestion['type'][]
  generationModel?: ContentGenerationModel
  reviewModel?: ContentReviewModel
  ttsModel?: ListeningTtsModel
}

type ContentReview = { approved: boolean; findings: string[]; contentFingerprint: string }

async function contentFingerprint(set: PracticeSet): Promise<string> {
  const { id: _setId, audioAssetId: _audioAssetId, ...reviewedContent } = set
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(reviewedContent)))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export type GeneratedPracticePackage = {
  content: LocalContentPackage
  audioAssets: LocalAudioAsset[]
  warnings: string[]
}

export type ImportedContentBundle = {
  format: 'prepia-receptive-content'
  schemaVersion: 1
  content: {
    product: SkillProduct
    title: string
    topicId: string
    topicFingerprint: string
    version: number
    source: LocalContentPackage['source']
    createdAt: string
    updatedAt: string
    set: unknown
  }
  audio?: { mimeType: string; data: string }
}

const CONTENT_MODEL: ContentGenerationModel = 'gemini-4-hydrogen'
const REVIEW_MODEL: ContentReviewModel = 'gemini-4-hydrogen'
const TTS_MODEL: ListeningTtsModel = 'gemini-3.8-flash-tts'
const TTS_FALLBACK_MODEL: ListeningTtsModel = 'gemini-3.8-flash-lite-tts'
const EMBEDDING_MODEL = 'gemini-embedding-2'
const PRACTICE_QUESTION_TYPES: SkillQuestion['type'][] = [
  'multiple-choice', 'multiple-select', 'classification', 'matching', 'matching-headings',
  'matching-information', 'matching-features', 'matching-sentence-endings', 'completion',
  'note-completion', 'sentence-completion', 'short-answer', 'labeling', 'flow-chart',
]

function normalizeText(value: string): string {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`)
  return value as Record<string, unknown>
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string.`)
  return value.trim()
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.length || !value.every((item) => typeof item === 'string' && item.trim())) {
    throw new Error(`${label} must contain one or more non-empty strings.`)
  }
  return value.map((item) => (item as string).trim())
}

function isQuestionType(value: unknown): value is PracticeSet['questions'][number]['type'] {
  return value === 'multiple-choice' || value === 'multiple-select' || value === 'classification'
    || value === 'matching' || value === 'matching-headings' || value === 'matching-information'
    || value === 'matching-features' || value === 'matching-sentence-endings'
    || value === 'completion' || value === 'note-completion' || value === 'sentence-completion'
    || value === 'short-answer' || value === 'labeling' || value === 'flow-chart'
}

function normalizeGeneratedSet(value: unknown, request: PracticeGenerationRequest): PracticeSet {
  const record = requireRecord(value, 'Generated content')
  const isFullMock = request.contentMode === 'full-mock'
  const questions = record.questions
  if (!Array.isArray(questions) || questions.length !== request.questionCount) {
    throw new Error(`The generated set must contain exactly ${request.questionCount} questions.`)
  }
  const normalizedQuestions = questions.map((rawQuestion, index) => {
    const question = requireRecord(rawQuestion, `Question ${index + 1}`)
    if (!isQuestionType(question.type)) throw new Error(`Question ${index + 1} has an unsupported question type.`)
    const base = {
      type: question.type,
      prompt: requireString(question.prompt, `Question ${index + 1} prompt`),
      explanation: requireString(question.explanation, `Question ${index + 1} explanation`),
      evidence: requireString(question.evidence, `Question ${index + 1} source evidence`),
    }
    if (question.type === 'multiple-choice' || question.type === 'classification') {
      const options = requireStringArray(question.options, `Question ${index + 1} options`)
      const answer = requireString(question.answer, `Question ${index + 1} answer`)
      if (options.length < 2 || !options.includes(answer)) throw new Error(`Question ${index + 1} has an answer that is not one of its options.`)
      return { ...base, options, answer }
    }
    if (question.type === 'multiple-select') {
      const options = requireStringArray(question.options, `Question ${index + 1} options`)
      const answer = requireStringArray(question.answer, `Question ${index + 1} answers`)
      if (answer.length < 2 || answer.some((item) => !options.includes(item))) throw new Error(`Question ${index + 1} has invalid selected answers.`)
      return { ...base, options, answer, instruction: typeof question.instruction === 'string' ? question.instruction : `Choose ${answer.length} answers.` }
    }
    if (question.type === 'short-answer') {
      const acceptedAnswers = requireStringArray(question.acceptedAnswers, `Question ${index + 1} accepted answers`)
      const wordLimit = typeof question.wordLimit === 'number' && Number.isInteger(question.wordLimit) && question.wordLimit > 0 ? question.wordLimit : 3
      return { ...base, acceptedAnswers, wordLimit }
    }
    if (question.type === 'completion' || question.type === 'note-completion' || question.type === 'sentence-completion') {
      const instruction = requireString(question.instruction, `Question ${index + 1} instruction`)
      if (!Array.isArray(question.gaps) || !question.gaps.length) throw new Error(`Question ${index + 1} must include answer gaps.`)
      const gaps = question.gaps.map((rawGap, gapIndex) => {
        const gap = requireRecord(rawGap, `Question ${index + 1}, gap ${gapIndex + 1}`)
        return {
          id: requireString(gap.id, `Question ${index + 1}, gap ${gapIndex + 1} ID`),
          label: requireString(gap.label, `Question ${index + 1}, gap ${gapIndex + 1} label`),
          acceptedAnswers: requireStringArray(gap.acceptedAnswers, `Question ${index + 1}, gap ${gapIndex + 1} accepted answers`),
        }
      })
      return { ...base, instruction, gaps }
    }
    if (question.type === 'matching' || question.type === 'matching-headings' || question.type === 'matching-information'
      || question.type === 'matching-features' || question.type === 'matching-sentence-endings') {
      const options = requireStringArray(question.options, `Question ${index + 1} options`)
      const instruction = requireString(question.instruction, `Question ${index + 1} instruction`)
      if (!Array.isArray(question.items) || !question.items.length) throw new Error(`Question ${index + 1} must include matching items.`)
      const items = question.items.map((rawItem, itemIndex) => {
        const item = requireRecord(rawItem, `Question ${index + 1}, item ${itemIndex + 1}`)
        const answer = requireString(item.answer, `Question ${index + 1}, item ${itemIndex + 1} answer`)
        if (!options.includes(answer)) throw new Error(`Question ${index + 1}, item ${itemIndex + 1} has an answer outside its options.`)
        return {
          id: requireString(item.id, `Question ${index + 1}, item ${itemIndex + 1} ID`),
          text: requireString(item.text, `Question ${index + 1}, item ${itemIndex + 1} text`),
          answer,
        }
      })
      return { ...base, instruction, options, items }
    }
    if (question.type === 'labeling' || question.type === 'flow-chart') {
      const options = requireStringArray(question.options, `Question ${index + 1} options`)
      const diagramDescription = requireString(question.diagramDescription, `Question ${index + 1} diagram description`)
      if (!Array.isArray(question.items) || !question.items.length) throw new Error(`Question ${index + 1} must include labels.`)
      const items = question.items.map((rawItem, itemIndex) => {
        const item = requireRecord(rawItem, `Question ${index + 1}, label ${itemIndex + 1}`)
        const answer = requireString(item.answer, `Question ${index + 1}, label ${itemIndex + 1} answer`)
        if (!options.includes(answer)) throw new Error(`Question ${index + 1}, label ${itemIndex + 1} has an answer outside its options.`)
        return {
          id: requireString(item.id, `Question ${index + 1}, label ${itemIndex + 1} ID`),
          label: requireString(item.label, `Question ${index + 1}, label ${itemIndex + 1} prompt`),
          answer,
        }
      })
      return { ...base, diagramDescription, options, items }
    }
    throw new Error(`Question ${index + 1} could not be validated.`)
  }) as PracticeSet['questions']

  const id = crypto.randomUUID()
  const title = requireString(record.title, 'Generated title')
  const instructions = requireString(record.instructions, 'Generated instructions')
  const audioScript = request.product === 'listenia' ? requireString(record.audioScript, 'Generated listening script') : undefined
  const passages = request.product === 'readia' && isFullMock
    ? (() => {
        if (!Array.isArray(record.passages) || record.passages.length !== 3) throw new Error('A full Reading mock must contain exactly three original passages.')
        return record.passages.map((rawPassage, index) => {
          const passage = requireRecord(rawPassage, `Reading passage ${index + 1}`)
          return {
            title: requireString(passage.title, `Reading passage ${index + 1} title`),
            text: requireString(passage.text, `Reading passage ${index + 1} text`),
          }
        })
      })()
    : undefined
  const audioSections = request.product === 'listenia' && isFullMock
    ? (() => {
        if (!Array.isArray(record.audioSections) || record.audioSections.length !== 4) throw new Error('A full Listening mock must contain exactly four original audio sections.')
        return record.audioSections.map((rawSection, index) => {
          const section = requireRecord(rawSection, `Listening section ${index + 1}`)
          return {
            title: requireString(section.title, `Listening section ${index + 1} title`),
            script: requireString(section.script, `Listening section ${index + 1} script`),
          }
        })
      })()
    : undefined
  let audioTurns = request.product === 'listenia' && Array.isArray(record.audioTurns)
    ? record.audioTurns.map((rawTurn, index) => {
      const turn = requireRecord(rawTurn, `Audio turn ${index + 1}`)
      return {
        speakerId: requireString(turn.speakerId, `Audio turn ${index + 1} speaker`),
        text: requireString(turn.text, `Audio turn ${index + 1} text`),
        ...(typeof turn.style === 'string' && turn.style.trim() ? { style: turn.style.trim() } : {}),
      }
    })
    : undefined
  if (audioScript && audioTurns) {
    if (new Set(audioTurns.map((turn) => turn.speakerId)).size > 4) throw new Error('Generated listening audio can use at most four speakers.')
    if (normalizeText(audioTurns.map((turn) => turn.text).join(' ')) !== normalizeText(audioScript)) {
      if (isFullMock) throw new Error('The Listening mock audio turns do not match the canonical transcript. Retry generation before reviewing or publishing.')
      console.warn('Generated listening turns did not align with the canonical script; using the script as a single narrator for audio production.')
      audioTurns = undefined
    }
  }
  const set: PracticeSet = {
    id,
    title,
    level: request.level,
    minutes: request.minutes,
    instructions,
    questions: normalizedQuestions,
    ...(request.contentMode === 'drill' ? { isFocusedDrill: true } : {}),
    ...(request.product === 'readia'
      ? isFullMock
        ? { passages, examSections: [
            { title: 'Passage 1', questionStartIndex: 0, questionEndIndex: 13 },
            { title: 'Passage 2', questionStartIndex: 13, questionEndIndex: 26 },
            { title: 'Passage 3', questionStartIndex: 26, questionEndIndex: 40 },
          ] }
        : { passage: requireString(record.passage, 'Generated reading passage') }
      : isFullMock
        ? { audioScript: audioScript!, audioTurns: audioTurns ?? [], audioSections, examSections: [
            { title: 'Section 1', questionStartIndex: 0, questionEndIndex: 10 },
            { title: 'Section 2', questionStartIndex: 10, questionEndIndex: 20 },
            { title: 'Section 3', questionStartIndex: 20, questionEndIndex: 30 },
            { title: 'Section 4', questionStartIndex: 30, questionEndIndex: 40 },
          ] }
        : { audioScript: audioScript!, ...(audioTurns ? { audioTurns } : {}) }),
    ...(isFullMock ? { fullLength: true } : {}),
  }
  const sourceMaterials = request.product === 'readia'
    ? isFullMock ? (set.passages ?? []).map((passage) => passage.text) : [set.passage ?? '']
    : isFullMock ? (set.audioSections ?? []).map((section) => section.script) : [set.audioScript ?? '']
  if (request.product === 'listenia' && isFullMock && normalizeText((set.audioTurns ?? []).map((turn) => turn.text).join(' ')) !== normalizeText(set.audioScript ?? '')) {
    throw new Error('The Listening mock audio turns do not match the canonical full recording.')
  }
  if (request.product === 'listenia' && isFullMock && normalizeText((set.audioSections ?? []).map((section) => section.script).join(' ')) !== normalizeText(set.audioScript ?? '')) {
    throw new Error('The four Listening section scripts do not match the canonical full recording.')
  }
  for (const [index, sourceMaterial] of sourceMaterials.entries()) {
    const sourceWordCount = sourceMaterial.trim().split(/\s+/).filter(Boolean).length
    const label = request.product === 'readia' ? `Reading passage ${index + 1}` : `Listening section ${index + 1}`
    const minimumReadingWords = request.contentMode === 'drill' ? 400 : 700
    const maximumReadingWords = request.contentMode === 'drill' ? 850 : 1000
    if (request.product === 'readia' && (sourceWordCount < minimumReadingWords || sourceWordCount > maximumReadingWords)) {
      throw new Error(request.contentMode === 'drill'
        ? `${label} for a focused drill must contain 400–850 words; the generated text contains ${sourceWordCount}.`
        : `${label} must contain 700–1,000 words; the generated text contains ${sourceWordCount}.`)
    }
    if (request.product === 'listenia' && (sourceWordCount < 450 || sourceWordCount > 1100)) {
      throw new Error(`${label} must contain 450–1,100 words; the generated script contains ${sourceWordCount}.`)
    }
  }
  const normalizedSources = sourceMaterials.map(normalizeText)
  for (const [index, question] of set.questions.entries()) {
    if (!question.evidence || !normalizedSources.some((source) => source.includes(normalizeText(question.evidence ?? '')))) {
      throw new Error(`Question ${index + 1} cites evidence that does not appear in the generated source material.`)
    }
  }
  if (request.questionTypes?.length && normalizedQuestions.some((question) => !request.questionTypes?.includes(question.type))) {
    throw new Error('The generated questions do not match the selected question-type practice.')
  }
  if (isFullMock && normalizedQuestions.length !== 40) {
    throw new Error('A full mock test must contain exactly 40 questions.')
  }
  if (isFullMock && request.product === 'listenia' && set.audioSections?.length !== 4) {
    throw new Error('A full Listening mock must contain exactly four sections.')
  }
  if (isFullMock && request.product === 'readia' && set.passages?.length !== 3) {
    throw new Error('A full Reading mock must contain exactly three passages.')
  }
  if (request.product === 'listenia' && isFullMock && audioTurns?.length === 0) {
    throw new Error('A full Listening mock must include aligned speaker turns for audio generation.')
  }
  if (isFullMock) {
    const expectedMinutes = request.product === 'readia' ? 60 : 30
    if (request.minutes !== expectedMinutes) {
      throw new Error(`A full ${request.product === 'readia' ? 'Reading' : 'Listening'} mock must use ${expectedMinutes} minutes.`)
    }
  }
  return set
}

async function reviewGeneratedSet(apiKey: string, request: PracticeGenerationRequest, set: PracticeSet, model = request.reviewModel ?? REVIEW_MODEL): Promise<ContentReview> {
  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model,
    contents: `Independently audit this original IELTS-style ${request.product} practice package. Check factual consistency with its source, answer-key correctness, whether every evidence span supports its answer, question clarity, question type correctness, and whether listening turns match the script. Do not rewrite the package. Return JSON only: {"approved": boolean, "findings": string[]} where findings contain actionable issues and an empty array means no issues. Package: ${JSON.stringify(set)}`,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 2000,
      systemInstruction: 'Act as an independent IELTS receptive-skills assessment reviewer. Be conservative: reject incorrect or ambiguous keys, unsupported evidence, materially unclear questions, and transcript/audio-turn inconsistencies. Do not approve content based only on plausible-sounding explanations.',
    },
  })
  if (!response.text) throw new Error('The independent content reviewer returned no result. The package remains unpublished.')
  let parsed: unknown
  try {
    parsed = JSON.parse(response.text)
  } catch (error) {
    console.error('Unable to parse the independent receptive-content review.', error)
    throw new Error('The independent content reviewer returned malformed JSON. The package remains unpublished.')
  }
  const review = requireRecord(parsed, 'Independent content review')
  if (typeof review.approved !== 'boolean') throw new Error('The independent content review did not include an approval decision.')
  let findings: string[] = []
  if (review.findings !== undefined) {
    if (!Array.isArray(review.findings)) throw new Error('Content review findings must be an array.')
    findings = review.findings.map((finding, index) => requireString(finding, `Content review finding ${index + 1}`))
  }
  if (!review.approved) throw new Error(`The independent content review rejected this draft: ${findings.join(' ') || 'review it and retry generation'}`)
  return { approved: true, findings, contentFingerprint: await contentFingerprint(set) }
}

export async function reviewLocalContentPackage(apiKey: string, content: LocalContentPackage, model: ContentReviewModel = REVIEW_MODEL): Promise<LocalContentPackage> {
  if (!apiKey.trim()) throw new Error('Add your Prepia AI access key in shared Settings before reviewing local content.')
  const validatedSet = normalizeGeneratedSet(content.set, {
    product: content.product,
    username: 'local-review',
    topic: content.topicFingerprint,
    topicAngle: 'Locally authored revision',
    level: content.set.level,
    questionCount: content.set.questions.length,
    minutes: content.set.minutes,
    testType: 'Academic',
    contentMode: content.set.fullLength ? 'full-mock' : content.set.isFocusedDrill ? 'drill' : 'practice',
  })
  const qualityReview = await reviewGeneratedSet(apiKey, {
    product: content.product,
    username: 'local-review',
    topic: content.topicFingerprint,
    topicAngle: 'Locally authored revision',
    level: content.set.level,
    questionCount: content.set.questions.length,
    minutes: content.set.minutes,
    testType: 'Academic',
    contentMode: content.set.fullLength ? 'full-mock' : content.set.isFocusedDrill ? 'drill' : 'practice',
  }, validatedSet, model)
  return {
    ...content,
    set: { ...validatedSet, id: content.set.id, ...(content.audioAssetId ? { audioAssetId: content.audioAssetId } : {}) },
    qualityReview: { ...qualityReview, model, reviewedAt: new Date().toISOString() },
  }
}

function generationPrompt(request: PracticeGenerationRequest): string {
  const isFullMock = request.contentMode === 'full-mock'
  const isDrill = request.contentMode === 'drill'
  const wordTarget = isFullMock
    ? request.product === 'readia' ? 'three distinct original reading passages of 700–1,000 words each' : 'four distinct natural listening scripts of 450–1,100 words each'
    : isDrill && request.product === 'readia'
      ? 'one focused original passage of approximately 500–700 words'
      : request.product === 'readia' ? '700–900 words of original prose' : 'a natural, approximately 5–7 minute spoken script'
  const skill = request.product === 'readia' ? 'IELTS Reading' : 'IELTS Listening'
  const material = request.product === 'readia'
    ? isFullMock
      ? request.testType === 'Academic'
        ? 'Return three distinct titled academic passages as passages:[{title,text}]. Write passage-specific questions grouped in order: Questions 1–13 use Passage 1, 14–26 use Passage 2, and 27–40 use Passage 3. Include examSections:[{title,questionStartIndex,questionEndIndex}] with zero-based half-open ranges.'
        : 'Return three distinct titled General Training passages as passages:[{title,text}]. Passages 1 and 2 use practical everyday/workplace materials; Passage 3 is a longer general-interest article. Write questions 1–13 for Passage 1, 14–26 for Passage 2, and 27–40 for Passage 3. Include examSections with zero-based half-open ranges.'
      : 'Return a passage, not a listening script. Every answer must be supported by an exact sentence or short evidence span in that passage. Avoid outside knowledge.'
    : isFullMock
      ? 'Return four distinct titled listening scripts as audioSections:[{title,script}], exactly ten questions per section, and audioTurns for the complete recording in order. Include examSections with zero-based half-open question ranges 0–10, 10–20, 20–30, and 30–40. The audioScript and concatenated audioTurns must exactly represent all four sections in order. Make section 1 a social conversation, section 2 a social monologue, section 3 an academic conversation, and section 4 an academic monologue.'
      : 'Return a canonical spoken script and 2–3 natural speaker turns. Every answer must be stated or clearly paraphrased in the script. Avoid outside knowledge.'
  const questionMix = request.questionTypes?.length
    ? `Use only this question type for every question: ${request.questionTypes.join(', ')}.`
    : 'Use a balanced, appropriate mix of supported IELTS task types.'
  const focusedTypeFormat = request.questionTypes?.length === 1
    ? `For every question, use type "${request.questionTypes[0]}" exactly and include its type-specific fields:
      multiple-choice or classification: options (at least 3 strings), answer (one exact option);
      multiple-select: options (at least 4 strings), answer (an array of at least 2 exact options), instruction;
      matching, matching-headings, matching-information, matching-features, or matching-sentence-endings: instruction, options (at least 3 strings), items (at least 3 objects, each with a unique id, non-empty text, and answer exactly equal to an option);
      completion, note-completion, or sentence-completion: instruction, gaps (at least 3 objects, each with a unique id, non-empty visible label, and acceptedAnswers array of non-empty strings);
      short-answer: acceptedAnswers array of non-empty strings and a positive integer wordLimit;
      labeling or flow-chart: diagramDescription, options (at least 3 strings), items (at least 3 objects, each with unique id, non-empty label, and answer exactly equal to an option).
      Each question also requires a non-empty prompt, explanation, and evidence copied verbatim from the source.`
    : ''
  return `Create one original IELTS-style ${skill} practice set as JSON. Do not copy any published test material.\n` +
    `Topic: ${request.topic}. Topic angle: ${request.topicAngle}. Test type: ${request.testType}. Level: ${request.level}.\n` +
    `Content mode: ${isFullMock ? 'full-length mock' : 'focused practice'}. Create exactly ${request.questionCount} numbered questions. ${questionMix} Target ${wordTarget}; time limit ${request.minutes} minutes.\n` +
    `${focusedTypeFormat}\n` +
    `${material}\n` +
    'Return exactly one JSON object with fields appropriate to the requested skill and content mode: title, instructions, passage or passages (reading), audioScript and audioTurns (listening), audioSections (full listening mock), and questions. ' +
    'Every question must include an evidence string copied verbatim from the passage or canonical audioScript; evidence must support the correct answer. The audioTurns text concatenated in order must match audioScript. ' +
    'Each question must have type, prompt, explanation; use only supported types: multiple-choice, multiple-select, classification, matching, matching-headings, matching-information, matching-features, matching-sentence-endings, completion, note-completion, sentence-completion, short-answer, labeling, flow-chart. ' +
    'Also include the required answer/options/instruction/items/gaps/wordLimit/diagramDescription fields for the selected type. ' +
    'For every matching item, accepted answer must exactly match an option. For multiple-choice, answer must exactly match an option. For every gap, provide both a stable unique id and a visible non-empty label. For every matching or labeling item, provide both a stable unique id and a visible non-empty label or text. ' +
    'For listening audioTurns use {speakerId,text,style}; speaker IDs must be stable labels such as Speaker 1 or Speaker 2. ' +
    'Keep content accurate, self-contained, age-appropriate, and suitable for IELTS preparation. Return syntactically valid JSON only, with every required field complete. Do not wrap JSON in markdown.'
}

export { extractJsonObject } from '@/features/skills/literacyJson'

async function generateValidatedSet(ai: GoogleGenAI, request: PracticeGenerationRequest, onAttempt: (attempt: number) => Promise<void>): Promise<PracticeSet> {
  const model = request.generationModel ?? CONTENT_MODEL
  let lastError = 'The model returned no content.'
  let previousResponse = ''
  const maximumAttempts = 4
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    await onAttempt(attempt)
    const contents = attempt === 1
      ? `${generationPrompt(request)}\nFor every completion question, each gaps[] item must include a visible non-empty label, a unique id, and acceptedAnswers.`
      : `Repair the previous attempt. Return a complete corrected JSON object only. Preserve all valid content and fix this validation error: ${lastError}\nFor completion questions, every gaps[] item requires a visible non-empty label, a unique id, and acceptedAnswers. Use "Answer 1", "Answer 2", etc. for any otherwise missing gap label. Do not remove required fields.\nRequest: ${generationPrompt(request)}\nPrevious response to repair:\n${previousResponse.slice(0, 60_000)}`
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseMimeType: 'application/json',
        temperature: attempt === 1 ? 0.35 : 0.15,
        maxOutputTokens: request.contentMode === 'full-mock' ? 32000 : 16000,
        systemInstruction: 'You are a careful IELTS receptive-skills assessment author. Follow the exact JSON contract. Do not invent answer evidence. Return valid JSON without markdown.',
      },
    })
    previousResponse = response.text ?? ''
    if (!previousResponse.trim()) {
      lastError = 'The model returned an empty response.'
      continue
    }
    try {
      const generated = parseJsonObject(previousResponse) as Record<string, unknown>
      const normalizedResponse = Array.isArray(generated.questions)
        ? { ...generated, questions: generated.questions.map(completeGeneratedQuestionShape) }
        : generated
      return normalizeGeneratedSet(normalizedResponse, request)
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'The model returned invalid JSON or content.'
      console.warn(`Generated content attempt ${attempt} failed validation; ${attempt < maximumAttempts ? 'requesting a repair' : 'all repair attempts are exhausted'}.`, error)
    }
  }
  throw new Error(`Prepia could not produce a valid package after ${maximumAttempts} attempts. Last issue: ${lastError}`)
}

export function validateEditedPracticeSet(value: unknown, content: LocalContentPackage, testType: PracticeGenerationRequest['testType']): PracticeSet {
  const validated = normalizeGeneratedSet(value, {
    product: content.product,
    username: 'local-editor',
    topic: content.topicFingerprint,
    topicAngle: 'Edited locally',
    level: content.set.level,
    questionCount: content.set.questions.length,
    minutes: content.set.minutes,
    testType,
    contentMode: content.set.fullLength ? 'full-mock' : content.set.isFocusedDrill ? 'drill' : 'practice',
  })
  if (content.product === 'listenia' && content.audioAssetId && validated.audioScript !== content.set.audioScript) {
    throw new Error('Changing the listening script invalidates its saved recording. Generate a new listening package to create matching audio.')
  }
  return { ...validated, id: content.set.id, ...(content.audioAssetId ? { audioAssetId: content.audioAssetId } : {}) }
}

export function validateImportedContentBundle(value: unknown, product: SkillProduct, testType: PracticeGenerationRequest['testType']): {
  content: Omit<LocalContentPackage, 'id' | 'exposureId' | 'qualityReview'>
  audio?: Blob
} {
  const bundle = requireRecord(value, 'Import file')
  if (bundle.format !== 'prepia-receptive-content' || bundle.schemaVersion !== 1) {
    throw new Error('This file is not a supported Prepia receptive-content export.')
  }
  const rawContent = requireRecord(bundle.content, 'Imported content')
  if (rawContent.product !== product) throw new Error(`This package is for ${String(rawContent.product)}, not ${product}.`)
  if (typeof rawContent.version !== 'number' || !Number.isInteger(rawContent.version) || rawContent.version < 1) {
    throw new Error('The imported content version is invalid.')
  }
  const rawSet = requireRecord(rawContent.set, 'Imported practice set')
  if (!Array.isArray(rawSet.questions) || !rawSet.questions.length) throw new Error('Imported content must contain questions.')
  if (rawSet.audioAssetId !== undefined && product !== 'listenia') throw new Error('Only Listenia packages can reference generated audio.')
  if (rawSet.audioAssetId !== undefined && (typeof rawSet.audioAssetId !== 'string' || !rawSet.audioAssetId.trim())) {
    throw new Error('The imported audio asset reference is invalid.')
  }
  if (product === 'listenia' && rawSet.audioAssetId !== undefined && bundle.audio === undefined) {
    throw new Error('The imported package references a generated recording but does not contain its audio data.')
  }
  const importedMetadata: PracticeGenerationRequest = {
    product,
    username: 'local-import',
    topic: requireString(rawContent.topicFingerprint, 'Imported topic fingerprint'),
    topicAngle: 'Imported topic',
    level: rawSet.level === 'Foundation' ? 'Foundation' as const : 'Intermediate' as const,
    questionCount: rawSet.questions.length,
    minutes: typeof rawSet.minutes === 'number' ? rawSet.minutes : 10,
    testType,
    contentMode: rawSet.fullLength === true ? 'full-mock' : rawSet.isFocusedDrill === true ? 'drill' : 'practice',
  }
  const set = normalizeGeneratedSet(rawSet, importedMetadata)
  const content: Omit<LocalContentPackage, 'id' | 'exposureId' | 'qualityReview'> = {
    product,
    title: requireString(rawContent.title, 'Imported package title'),
    topicId: requireString(rawContent.topicId, 'Imported topic ID'),
    topicFingerprint: importedMetadata.topic,
    version: rawContent.version,
    status: 'draft',
    source: 'imported',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    set,
  }
  let audio: Blob | undefined
  if (bundle.audio !== undefined) {
    const rawAudio = requireRecord(bundle.audio, 'Imported listening audio')
    if (product !== 'listenia') throw new Error('Only Listenia packages can include audio.')
    const mimeType = requireString(rawAudio.mimeType, 'Audio MIME type')
    const data = requireString(rawAudio.data, 'Audio data')
    if (!/^audio\/(?:wav|x-wav|mpeg|mp3|ogg|webm|mp4|aac|flac)(?:;[^,]+)?$/i.test(mimeType)) throw new Error('The imported audio format is not supported.')
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length > 14_000_000) throw new Error('Imported audio data is invalid or exceeds the 10 MB package limit.')
    audio = decodeBase64Audio(data, mimeType)
    if (!audio.size || audio.size > 10 * 1024 * 1024) throw new Error('Imported audio is empty or exceeds the 10 MB package limit.')
  } else if (product === 'listenia' && set.audioAssetId) {
    throw new Error('The imported package references audio but does not contain its audio data.')
  }
  return { content, ...(audio ? { audio } : {}) }
}

async function generateTopicEmbedding(ai: GoogleGenAI, topic: string, angle: string): Promise<number[] | undefined> {
  try {
    const response = await ai.models.embedContent({ model: EMBEDDING_MODEL, contents: `${topic}: ${angle}` })
    const values = response.embeddings?.[0]?.values
    return values?.length ? values : undefined
  } catch (error) {
    console.warn('Semantic topic embedding is unavailable; local exact and keyword overlap checks will be used.', error)
    return undefined
  }
}

function decodeBase64Audio(data: string, mimeType: string): Blob {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  if (!/audio\/(?:pcm|l16)/i.test(mimeType)) return new Blob([bytes], { type: mimeType })

  const sampleRate = Number(mimeType.match(/rate=(\d+)/i)?.[1] ?? 24000)
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index))
  }
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + bytes.byteLength, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, bytes.byteLength, true)
  return new Blob([header, bytes], { type: 'audio/wav' })
}

async function generateListeningAudio(apiKey: string, set: PracticeSet, contentId: string, selectedModel = TTS_MODEL): Promise<LocalAudioAsset> {
  const script = set.audioScript?.trim()
  if (!script) throw new Error('A listening package needs its approved script before audio production.')
  const turns = set.audioTurns?.length ? set.audioTurns : [{ speakerId: 'Narrator', text: script, style: 'Clear, natural British English at a measured IELTS practice pace.' }]
  const speakers = [...new Set(turns.map((turn) => turn.speakerId))]
  const speakerVoices = ['Kore', 'Puck', 'Charon', 'Aoede']
  const ai = new GoogleGenAI({ apiKey })
  const input = [{
    type: 'user_input' as const,
    content: turns.map((turn) => ({
      type: 'text' as const,
      text: turn.text,
      annotations: [{ type: 'speech_metadata' as const, speaker: turn.speakerId, style: turn.style ?? 'Natural, clear spoken English.' }],
    })),
  }]
  const generationConfig = {
    speech_config: {
      speakers: speakers.map((speaker, index) => ({
        speaker,
        voice: speakerVoices[index % speakerVoices.length],
      })),
    },
  }
  const ttsModels = [...new Set([selectedModel, selectedModel === TTS_MODEL ? TTS_FALLBACK_MODEL : TTS_MODEL])]
  const ttsErrors: unknown[] = []
  let interaction: Awaited<ReturnType<typeof ai.interactions.create>> | undefined
  for (const [index, model] of ttsModels.entries()) {
    try {
      interaction = await ai.interactions.create({
        model,
        input,
        response_format: { type: 'audio' },
        generation_config: generationConfig,
        store: false,
      })
      if (index > 0) console.warn(`Prepia Voice switched to its fallback model ${model}.`)
      break
    } catch (error) {
      ttsErrors.push(error)
      const message = error instanceof Error ? `${error.name} ${error.message}` : String(error)
      const retryable = /429|quota|503|UNAVAILABLE|NOT_FOUND|model.{0,40}(not found|unavailable)|overloaded|high demand/i.test(message)
      if (!retryable || index === ttsModels.length - 1) {
        if (ttsErrors.length > 1) throw new AggregateError(ttsErrors, 'Prepia Voice could not produce the listening recording with either configured model.')
        throw error
      }
    }
  }
  if (!interaction || !('output_audio' in interaction)) throw new Error('Prepia Voice did not return a complete listening recording.')
  const audioData = interaction.output_audio?.data
  if (!audioData) throw new Error('Prepia Voice returned no audio. The listening package was not published.')
  const responseMimeType = interaction.output_audio?.mime_type ?? 'audio/wav'
  const audio = decodeBase64Audio(audioData, responseMimeType)
  if (!audio.size) throw new Error('Prepia Voice returned an empty audio file. The listening package was not published.')
  return {
    id: `${contentId}:audio:0`,
    contentId,
    contentVersion: 1,
    sectionIndex: 0,
    mimeType: audio.type,
    byteLength: audio.size,
    createdAt: new Date().toISOString(),
    audio,
  }
}

export async function generateAndSavePracticePackage(apiKey: string, request: PracticeGenerationRequest): Promise<GeneratedPracticePackage> {
  if (!apiKey.trim()) throw new Error('Add your Prepia AI access key in shared Settings before generating content.')
  if (!request.topic.trim() || !request.topicAngle.trim()) throw new Error('Choose a topic and a specific topic angle.')
  const isFullMock = request.contentMode === 'full-mock'
  if (isFullMock && request.questionCount !== 40) throw new Error('A full mock test must contain exactly 40 questions.')
  if (!isFullMock && (!Number.isInteger(request.questionCount) || request.questionCount < 1 || request.questionCount > 10)) throw new Error('Generate between 1 and 10 questions per practice package.')
  const mockMinutes = request.product === 'readia' ? 60 : 30
  if (isFullMock && request.minutes !== mockMinutes) throw new Error(`A full ${request.product === 'readia' ? 'Reading' : 'Listening'} mock must use ${mockMinutes} minutes.`)
  if (!isFullMock && (!Number.isInteger(request.minutes) || request.minutes < 5 || request.minutes > 20)) throw new Error('Generated practice packages must be between 5 and 20 minutes. Use full mock mode for a complete timed test.')
  if (request.questionTypes?.some((type) => !PRACTICE_QUESTION_TYPES.includes(type))) throw new Error('Choose a supported IELTS question type.')
  if (isFullMock && request.questionTypes?.length) throw new Error('Full mock tests use mixed question types; select question-type practice for a focused set.')
  const fingerprint = normalizeText(`${request.topic} ${request.topicAngle}`)
  const ai = new GoogleGenAI({ apiKey })
  const now = new Date().toISOString()
  let workflowJob: LocalContentWorkflowJob = {
    id: `${request.product}:${crypto.randomUUID()}`,
    username: request.username.trim().toLocaleLowerCase(),
    product: request.product,
    status: 'running',
    stage: 'topic-analysis',
    topic: request.topic.trim(),
    topicAngle: request.topicAngle.trim(),
    startedAt: now,
    updatedAt: now,
    stageHistory: [{ stage: 'topic-analysis', status: 'running', at: now }],
  }
  await saveLocalContentWorkflowJob(workflowJob)
  const updateWorkflow = async (stage: LocalContentWorkflowJob['stage'], status: LocalContentWorkflowJob['status'] = 'running', error?: string, detail?: string) => {
    const updatedAt = new Date().toISOString()
    workflowJob = {
      ...workflowJob,
      stage,
      status,
      updatedAt,
      stageHistory: [...(workflowJob.stageHistory ?? []), { stage, status, at: updatedAt, ...(detail ? { detail } : {}) }],
      ...(error ? { error } : {}),
    }
    await saveLocalContentWorkflowJob(workflowJob)
  }
  let reservation: TopicExposure | undefined
  let audioAssetId: string | undefined
  try {
    const embedding = await generateTopicEmbedding(ai, request.topic, request.topicAngle)
    reservation = await reserveLocalTopic({
      username: request.username,
      product: request.product,
      topicId: crypto.randomUUID(),
      fingerprint,
      ...(embedding ? { embedding } : {}),
    })
    await updateWorkflow('authoring')
    await updateWorkflow('validation')
    const set = await generateValidatedSet(ai, request, (attempt) => updateWorkflow(
      'validation',
      'running',
      undefined,
      `${attempt === 1 ? 'Generation' : 'Repair'} attempt ${attempt} of 4`,
    ))
    await updateWorkflow('review')
    const qualityReview = await reviewGeneratedSet(apiKey, request, set, request.reviewModel ?? REVIEW_MODEL)
    const packageId = `${request.product}:${set.id}:v1`
    const createdAt = new Date().toISOString()
    const content: LocalContentPackage = {
      id: packageId,
      product: request.product,
      title: set.title,
      topicId: reservation.topicId,
      topicFingerprint: fingerprint,
      version: 1,
      status: 'draft',
      source: 'generated',
      createdAt,
      updatedAt: createdAt,
      qualityReview: { ...qualityReview, model: request.reviewModel ?? REVIEW_MODEL, reviewedAt: createdAt },
      set,
    }
    await updateWorkflow('audio')
    const audioAssets: LocalAudioAsset[] = []
    let audioWarning = ''
    if (request.product === 'listenia') {
      try {
        const audio = await generateListeningAudio(apiKey, set, packageId, request.ttsModel ?? TTS_MODEL)
        await saveLocalAudioAsset(audio)
        audioAssets.push(audio)
        audioAssetId = audio.id
        set.audioAssetId = audio.id
      } catch (audioError) {
        if (request.contentMode !== 'drill') throw audioError
        console.warn('The listening drill script and questions were saved without generated audio.', audioError)
        audioWarning = `The script and questions were saved, but generated audio was unavailable: ${audioError instanceof Error ? audioError.message : 'voice production failed'}. The browser’s speech playback can be used for guided practice.`
      }
    }
    await updateWorkflow('saving')
    await saveLocalContentPackage({ ...content, exposureId: reservation.id, ...(audioAssetId ? { audioAssetId } : {}) })
    const warnings = [
      ...(!embedding ? ['Semantic embeddings were unavailable; this package used local exact and keyword topic checks.'] : []),
      ...(audioWarning ? [audioWarning] : []),
      ...qualityReview.findings.map((finding) => `Reviewer note: ${finding}`),
    ]
    try {
      await updateWorkflow('completed', 'completed')
    } catch (jobError) {
      console.error('The content draft was saved, but its workflow completion status could not be recorded.', jobError)
      warnings.push('The draft was saved locally, but its workflow history could not be updated.')
    }
    return {
      content: { ...content, exposureId: reservation.id, ...(audioAssetId ? { audioAssetId } : {}) },
      audioAssets,
      warnings,
    }
  } catch (error) {
    if (reservation) {
      try {
        await updateLocalTopicExposure(reservation.id, 'released')
      } catch (cleanupError) {
        console.error('Unable to release a topic reservation after content generation failed.', cleanupError)
      }
    }
    if (audioAssetId) {
      try {
        await deleteLocalAudioAsset(audioAssetId)
      } catch (cleanupError) {
        console.error('Unable to remove audio left by a failed content-generation job.', cleanupError)
      }
    }
    try {
      await updateWorkflow('failed', 'failed', error instanceof Error ? error.message : 'Content generation failed.')
    } catch (jobError) {
      console.error('Unable to persist the failed local content workflow status.', jobError)
    }
    throw error
  }
}

export async function publishLocalContentPackage(content: LocalContentPackage): Promise<LocalContentPackage> {
  if (!content.qualityReview?.approved) throw new Error('An independently reviewed draft is required before publishing.')
  if (await contentFingerprint(content.set) !== content.qualityReview.contentFingerprint) {
    throw new Error('This draft changed after its last independent review. Review it again before publishing.')
  }
  const now = new Date().toISOString()
  return { ...content, status: 'published', updatedAt: now }
}

export function createLocalContentPackage(content: PracticeSet, product: SkillProduct, topic: string, topicAngle: string, source: LocalContentPackage['source']): LocalContentPackage {
  const now = new Date().toISOString()
  return {
    id: `${product}:${content.id}:v1`,
    product,
    title: content.title,
    topicId: crypto.randomUUID(),
    topicFingerprint: normalizeText(`${topic} ${topicAngle}`),
    version: 1,
    status: 'draft',
    source,
    createdAt: now,
    updatedAt: now,
    set: content,
  }
}

export function getTopicFingerprint(topic: string, angle: string): string {
  return normalizeText(`${topic} ${angle}`)
}

export function hasUsedLocalTopic(record: TopicExposure, topic: string, angle: string): boolean {
  return record.status !== 'released' && record.fingerprint === getTopicFingerprint(topic, angle)
}
