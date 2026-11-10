import { GoogleGenAI } from '@/lib/geminiClient'
import type { CriterionId, CriterionResult, SentenceFeedback, TestPart, TestResult, TranscriptEntry } from './types'
import { partLabel } from './questions'
import { groupTranscriptTurns } from './transcript'

import { GEMINI_TEXT_MODELS } from '@/lib/geminiModels'

export const ASSESSMENT_MODELS = GEMINI_TEXT_MODELS

export type AssessmentModel = typeof ASSESSMENT_MODELS[number]['id']

const AUDIO_SAMPLE_RATE = 16000
export const MAX_INLINE_AUDIO_BYTES = 15 * 1024 * 1024

const criterionDefinitions: Record<CriterionId, string> = {
  fluency: 'Fluency and Coherence',
  lexical: 'Lexical Resource',
  grammar: 'Grammatical Range and Accuracy',
  pronunciation: 'Pronunciation',
}

interface RawCriterion {
  id: CriterionId
  band: number
  evidence: string
  improvement: string
}

interface RawEvaluation {
  overallBand: number
  criteria: RawCriterion[]
  executiveSummary: string
  strengths: string[]
  nextSteps: string[]
  transcript: string
  sentenceFeedback: SentenceFeedback[]
}

function clampBand(value: number): number {
  return Math.max(0, Math.min(9, Math.round(value * 2) / 2))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSentenceFeedback(value: unknown): value is SentenceFeedback {
  return isRecord(value)
    && typeof value.originalSentence === 'string'
    && typeof value.issue === 'string'
    && typeof value.correction === 'string'
    && typeof value.bandEightVersion === 'string'
    && typeof value.explanation === 'string'
}

function parseEvaluation(text: string): RawEvaluation {
  let decoded: unknown
  try {
    decoded = JSON.parse(text)
  } catch (error) {
    console.error('Speakia AI returned invalid JSON for the IELTS speaking assessment.', error)
    throw new Error('Speakia AI returned an unreadable assessment. Try evaluating this recording again.')
  }

  if (!isRecord(decoded) || typeof decoded.overallBand !== 'number'
    || !Number.isFinite(decoded.overallBand)
    || decoded.overallBand < 0
    || decoded.overallBand > 9
    || !Array.isArray(decoded.criteria) || typeof decoded.executiveSummary !== 'string'
    || !decoded.executiveSummary.trim() || decoded.executiveSummary.length > 900
    || !Array.isArray(decoded.strengths)
    || !Array.isArray(decoded.nextSteps) || typeof decoded.transcript !== 'string'
    || !Array.isArray(decoded.sentenceFeedback)) {
    throw new Error('Speakia AI returned an incomplete assessment. Try evaluating this recording again.')
  }

  const validIds = new Set<CriterionId>(['fluency', 'lexical', 'grammar', 'pronunciation'])
  const criteria: RawCriterion[] = []
  for (const value of decoded.criteria) {
    if (!isRecord(value)
      || typeof value.id !== 'string'
      || !validIds.has(value.id as CriterionId)
      || typeof value.band !== 'number'
      || !Number.isFinite(value.band)
      || value.band < 0
      || value.band > 9
      || typeof value.evidence !== 'string'
      || typeof value.improvement !== 'string') {
      throw new Error('Speakia AI returned an invalid criterion in its assessment. Try again.')
    }
    criteria.push({
      id: value.id as CriterionId,
      band: clampBand(value.band),
      evidence: value.evidence,
      improvement: value.improvement,
    })
  }
  if (new Set(criteria.map((criterion) => criterion.id)).size !== 4 || criteria.length !== 4) {
    throw new Error('Speakia AI did not return all four IELTS speaking criteria. Try again.')
  }
  if (!decoded.strengths.every((item) => typeof item === 'string')
    || !decoded.nextSteps.every((item) => typeof item === 'string')) {
    throw new Error('Speakia AI returned invalid feedback. Try again.')
  }
  if (decoded.sentenceFeedback.length > 80 || !decoded.sentenceFeedback.every(isSentenceFeedback)) {
    throw new Error('Speakia AI returned invalid sentence-by-sentence feedback. Try again.')
  }

  return {
    overallBand: clampBand(criteria.reduce((total, criterion) => total + criterion.band, 0) / criteria.length),
    criteria,
    executiveSummary: decoded.executiveSummary.trim(),
    strengths: decoded.strengths.slice(0, 4) as string[],
    nextSteps: decoded.nextSteps.slice(0, 4) as string[],
    transcript: decoded.transcript,
    sentenceFeedback: decoded.sentenceFeedback,
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function float32ToPcmBytes(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  return bytes
}

function pcmToWavBlob(chunks: Uint8Array[]): Blob {
  const dataLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  const pcm = new Uint8Array(dataLength)
  let offset = 0
  for (const chunk of chunks) {
    pcm.set(chunk, offset)
    offset += chunk.byteLength
  }

  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const writeString = (position: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(position + index, value.charCodeAt(index))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, AUDIO_SAMPLE_RATE, true)
  view.setUint32(28, AUDIO_SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)
  return new Blob([header, pcm], { type: 'audio/wav' })
}

export async function prepareAudioForAssessment(audio: Blob): Promise<Blob> {
  if (!audio.size) throw new Error('The saved test recording is empty.')
  if (audio.size > MAX_INLINE_AUDIO_BYTES) {
    throw new Error('The saved test recording is too large to prepare for inline Speakia AI assessment.')
  }
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await audio.arrayBuffer())
    const outputLength = Math.max(1, Math.round(decoded.length * AUDIO_SAMPLE_RATE / decoded.sampleRate))
    const samples = new Float32Array(outputLength)
    for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
      const sourcePosition = outputIndex * decoded.sampleRate / AUDIO_SAMPLE_RATE
      const firstFrame = Math.min(Math.floor(sourcePosition), decoded.length - 1)
      const secondFrame = Math.min(firstFrame + 1, decoded.length - 1)
      const fraction = sourcePosition - firstFrame
      let sample = 0
      for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
        const input = decoded.getChannelData(channel)
        sample += input[firstFrame] + (input[secondFrame] - input[firstFrame]) * fraction
      }
      samples[outputIndex] = sample / decoded.numberOfChannels
    }
    const bytes = float32ToPcmBytes(samples)
    const wav = pcmToWavBlob([bytes])
    if (wav.size > MAX_INLINE_AUDIO_BYTES) {
      throw new Error('The saved test recording is too large for inline Speakia AI evaluation.')
    }
    return wav
  } catch (error) {
    console.error('Unable to prepare the saved test audio for Speakia AI assessment.', error)
    throw new Error(error instanceof Error
      ? `This recording could not be prepared for reassessment: ${error.message}`
      : 'This recording could not be prepared for reassessment.')
  } finally {
    await context.close()
  }
}

export async function createTranscriptAudioCopy(
  transcript: TranscriptEntry[],
  onProgress?: (progress: { completed: number; total: number }) => void,
): Promise<Blob> {
  const voiceTurns = transcript.filter(
    (turn): turn is TranscriptEntry & { audio: Blob } => turn.role !== 'assessment' && turn.audio instanceof Blob,
  )
  if (!voiceTurns.some((turn) => turn.role === 'candidate')) {
    throw new Error('No original microphone turn audio is available to evaluate. Complete another live practice session.')
  }
  if (!voiceTurns.some((turn) => turn.role === 'examiner')) {
    throw new Error('No original examiner turn audio is available to compile. Complete another live practice session.')
  }
  const transcriptVoiceTurns = transcript.filter((turn) => turn.role !== 'assessment' && turn.text.trim())
  if (transcriptVoiceTurns.some((turn) => !turn.audio)) {
    throw new Error('Some transcript turns are missing their original audio. Complete another live practice session so the full conversation can be evaluated.')
  }
  const orderedVoiceTurns = voiceTurns.every((turn) => typeof turn.audioOrder === 'number' && Number.isFinite(turn.audioOrder))
    ? [...voiceTurns].sort((left, right) => left.audioOrder! - right.audioOrder!)
    : voiceTurns

  const decodingContext = new AudioContext()
  const chunks: Uint8Array[] = []
  const pauseBetweenTurns = new Uint8Array(Math.round(0.25 * AUDIO_SAMPLE_RATE) * 2)
  let totalBytes = 44
  onProgress?.({ completed: 0, total: orderedVoiceTurns.length })
  try {
    for (const [index, turn] of orderedVoiceTurns.entries()) {
      const decoded = await decodingContext.decodeAudioData(await turn.audio.arrayBuffer())
      const outputLength = Math.max(1, Math.round(decoded.length * AUDIO_SAMPLE_RATE / decoded.sampleRate))
      const pcmLength = outputLength * 2
      const pauseLength = index < orderedVoiceTurns.length - 1 ? pauseBetweenTurns.byteLength : 0
      if (totalBytes + pcmLength + pauseLength > MAX_INLINE_AUDIO_BYTES) {
        throw new Error('The compiled transcript audio is too large for inline Speakia AI evaluation. Shorten the practice and try again.')
      }

      const samples = new Float32Array(outputLength)
      for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
        const sourcePosition = outputIndex * decoded.sampleRate / AUDIO_SAMPLE_RATE
        const firstFrame = Math.min(Math.floor(sourcePosition), decoded.length - 1)
        const secondFrame = Math.min(firstFrame + 1, decoded.length - 1)
        const frameFraction = sourcePosition - firstFrame
        let sample = 0
        for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
          const channelData = decoded.getChannelData(channel)
          const firstSample = channelData[firstFrame]
          const secondSample = channelData[secondFrame]
          sample += firstSample + (secondSample - firstSample) * frameFraction
        }
        samples[outputIndex] = sample / decoded.numberOfChannels
      }

      chunks.push(float32ToPcmBytes(samples))
      if (pauseLength) chunks.push(pauseBetweenTurns)
      totalBytes += pcmLength + pauseLength
      onProgress?.({ completed: index + 1, total: orderedVoiceTurns.length })
    }
  } finally {
    if (decodingContext.state !== 'closed') {
      try {
        await decodingContext.close()
      } catch (error) {
        console.error('Unable to close transcript audio decoder.', error)
      }
    }
  }

  return pcmToWavBlob(chunks)
}

export async function assessSpeakingAudio(
  apiKey: string,
  audioCopy: Blob,
  transcript: TranscriptEntry[],
  part: TestPart,
  durationSeconds: number,
  model: AssessmentModel,
): Promise<TestResult> {
  if (!apiKey.trim()) throw new Error('Add your Speakia AI API key before starting a practice test.')

  if (audioCopy.size === 0) throw new Error('The compiled conversation audio is empty.')
  if (audioCopy.size > MAX_INLINE_AUDIO_BYTES) {
    throw new Error('The compiled transcript audio is too large for inline Speakia AI evaluation. Shorten the practice and try again.')
  }
  const audioBase64 = bytesToBase64(new Uint8Array(await audioCopy.arrayBuffer()))
  const transcriptTurns = groupTranscriptTurns(transcript.filter((turn) => turn.role !== 'assessment'))
  const conversation = transcriptTurns.map((entry) => `${entry.role === 'examiner' ? 'Examiner' : 'Candidate'}: ${entry.text}`).join('\n')
  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  const response = await client.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        {
          text: [
            `Assess this ${partLabel(part)} IELTS Speaking practice using the four public speaking criteria. Treat this as a careful, evidence-led assessment of the candidate's demonstrated ability, not a prediction of their potential.`,
            'The inline WAV is a compiled copy of captured examiner and candidate turns in conversation order, with short pauses between turns. Use the role-labelled transcript to identify who is speaking, then evaluate only the candidate turns. Never score examiner speech, the length of the test, microphone quality, or the candidate’s accent/background.',
            'Listen to the audio as the primary evidence. Use the transcript to locate and understand candidate responses, but do not assume it is perfectly accurate. If wording or a pronunciation feature is unclear, do not guess; describe the limitation and avoid penalizing uncertain evidence.',
            'Calibrate each criterion independently against IELTS-style whole and half bands. Use these anchors consistently: Band 5 indicates noticeable limitations that often disrupt development or control; Band 6 indicates generally effective communication with recurring hesitation, imprecision, or errors; Band 7 indicates a sustained, well-developed performance with flexible language and mostly controlled delivery, though some lapses remain; Band 8 indicates consistently fluent, precise, flexible, and well-controlled speaking with only occasional minor slips; Band 9 indicates consistently natural, precise, effortless control with no meaningful weakness evident. Bands 0–4 should be used when the performance shows substantially more limited ability than the Band 5 anchor. Do not default to Band 6 or 7; award higher bands only when the recording demonstrates their characteristics consistently.',
            'Apply the anchors specifically: Fluency & Coherence measures pace, continuity, relevance, logical progression, and linking without penalizing a brief natural pause; Lexical Resource measures range, precision, collocation, paraphrase, and repetition; Grammatical Range & Accuracy measures variety, control, and the frequency and impact of errors; Pronunciation measures intelligibility, word stress, rhythm, chunking, and intonation. Do not infer pronunciation from text or penalize a recognizable accent.',
            'Judge the task actually completed: respect the scope and expected response type of the selected section. For a full test, consider the candidate’s performance across Parts 1, 2, and 3; for a single-part test, score only that section. Do not reward verbosity, memorized-sounding language, or topic knowledge unless it supports relevant, clear spoken communication. Do not penalize the candidate for examiner interruptions or prompts.',
            'Give a whole or half band from 0 to 9 for each criterion. Calculate overallBand as the arithmetic mean of the four criterion bands rounded to the nearest half band; do not independently estimate or inflate the overall score.',
            'For each criterion, give concise evidence tied to specific audible candidate behavior and one actionable improvement. Avoid vague praise, contradictory evidence, unsupported precision, and false certainty.',
            'Provide sentence feedback in conversation order for up to 25 representative complete candidate sentences or clear fragments, prioritizing meaningful, audible issues. Preserve original wording when intelligible; state when there is no major issue rather than inventing one. For each item, give a natural correction that preserves intended meaning, an illustrative Band 8-style alternative (not a guaranteed score), and a brief explanation. Never assess or rewrite examiner speech.',
            'Use concise, constructive feedback. This is a practice estimate, not an official IELTS score.',
            'As Speakia, write an executiveSummary of 2–3 concise sentences addressed directly to the candidate. Balance strengths and growth areas using only evidence in this recording. Keep the assessment realistic and constructive; do not promise a future score.',
            'Return one valid JSON object with keys overallBand (number), executiveSummary (string), criteria (array of exactly four objects with id, band, evidence, improvement), strengths (string array), nextSteps (string array), transcript (string), and sentenceFeedback (array of at most 25 objects with originalSentence, issue, correction, bandEightVersion, explanation). Use criterion ids fluency, lexical, grammar, and pronunciation. Ensure overallBand is the arithmetic mean of the four criterion bands rounded to the nearest half band. Do not include markdown fences or extra text.',
            'Conversation transcript:',
            conversation || 'No transcription was returned by the Live API.',
          ].join('\n'),
        },
        { inlineData: { mimeType: 'audio/wav', data: audioBase64 } },
      ],
    }],
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  })

  if (!response.text?.trim()) {
    throw new Error('Speakia AI returned an empty assessment. Try evaluating this recording again.')
  }

  const evaluation = parseEvaluation(response.text)
  const names = criterionDefinitions
  const criteria: CriterionResult[] = evaluation.criteria.map((criterion) => ({
    id: criterion.id,
    name: names[criterion.id],
    band: criterion.band,
    assessmentType: 'Speakia audio assessment',
    note: `${criterion.evidence} Improvement: ${criterion.improvement}`,
  }))
  const answers = transcriptTurns
    .filter((entry) => entry.role === 'candidate')
    .map((entry, index) => ({
      questionId: `candidate-turn-${index + 1}`,
      part: part === 'part2' ? 'part2' as const : part === 'part3' ? 'part3' as const : 'part1' as const,
      prompt: 'Spoken response in the live practice session',
      answer: entry.text,
      durationSeconds: 0,
    }))

  return {
    id: crypto.randomUUID(),
    title: part === 'full' ? 'Full IELTS speaking test' : `IELTS speaking ${part.replace('part', 'Part ')}`,
    completedAt: new Date().toISOString(),
    part,
    overallBand: evaluation.overallBand,
    executiveSummary: evaluation.executiveSummary,
    durationSeconds,
    answers,
    transcript: [
      ...transcriptTurns.map(({ id, role, text }) => ({ id, role, text })),
      ...(evaluation.transcript.trim()
        ? [{ role: 'assessment' as const, text: evaluation.transcript.trim() }]
        : []),
    ],
    criteria,
    strengths: evaluation.strengths,
    nextSteps: evaluation.nextSteps,
    sentenceFeedback: evaluation.sentenceFeedback,
    assessmentModel: model,
  }
}

export function createExaminerInstructions(part: TestPart, prompts: string[]): string {
  return [
    'You are a realistic, professional IELTS Speaking test examiner conducting a practice test.',
    'Speak only as the examiner. Be warm, neutral, concise, and use clear standard English.',
    'Ask one question at a time and wait for the candidate to finish before responding.',
    'Do not correct, coach, praise, score, or give feedback during the test.',
    'Do not answer questions for the candidate. If they ask what a word means, politely ask them to answer in their own words.',
    'Follow IELTS Speaking practice structure and natural pacing. At the beginning of every test, introduce yourself using this exact identity and wording: "Hello, my name is Speakia, and I’ll be your IELTS Speaking examiner today." Never invent, choose, or use another examiner name. Do not claim to be an official IELTS examiner.',
    'For Part 1, ask the supplied familiar-topic questions naturally, in order.',
    ...(part === 'part2' ? [
      'This is a standalone Part 2-only practice. The application has already shown the supplied cue card and handled the one-minute preparation period. Start directly by inviting the candidate to speak about the cue card for up to two minutes; do not read or present the card again.',
      'You are already conducting Part 2. Never announce or suggest moving on to Part 2, and never transition to Part 3 or another test section. After the candidate finishes the long turn, ask one brief related follow-up, then conclude this single-part practice and call mark_speaking_test_complete when its completion requirements are met.',
    ] : [
      'For Part 2, present the supplied cue card clearly, tell the candidate they have one minute to prepare and should speak for up to two minutes. After their long turn, ask one brief related follow-up.',
    ]),
    'For Part 3, ask the supplied abstract discussion questions one at a time, using a short relevant follow-up when appropriate.',
    'If this is a single-part practice, conduct only that part. For a full test, transition from Part 1 to Part 2 to Part 3.',
    ...(part === 'full' ? [
      'In a full test, clearly announce each section transition aloud using these exact phrases: "Now we will move on to Part 2" before presenting the Part 2 cue card, and "Now we will move on to Part 3" before beginning the discussion.',
    ] : []),
    'Do not announce the test is complete or call the mark_speaking_test_complete tool until you have completed every required section of the selected format and have asked the necessary questions. For a full test, finish Parts 1, 2 and 3 in sequence. For a single part, complete a representative set of questions for that part. If a question is skipped, continue the test and replace it with a suitable question where needed.',
    'Only after the selected test format is genuinely complete, briefly say the practice test is complete and that written assessment is being prepared, then call mark_speaking_test_complete. Never call this tool just because the candidate says they are finished early or after only a few turns.',
    `Selected format: ${partLabel(part)}.`,
    'Use this question bank as the topic guide. Keep every question relevant to these topics and do not ask all questions at once:',
    prompts.map((prompt, index) => `${index + 1}. ${prompt}`).join('\n'),
  ].join('\n')
}
