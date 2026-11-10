import { GoogleGenAI } from '@/lib/geminiClient'
import type { CriterionId, SentenceFeedback } from '@/features/simulator/types'
import { IELTS_SPEAKING_CALIBRATION } from '@/features/simulator/speakingRubric'

export type MediaAssessmentModel =
  | 'gemini-3.8-flash'
  | 'gemini-3.5-flash-lite'
  | 'gemini-3.1-pro-preview'
  | 'gemini-pro-latest'
export type MediaAssessmentSource = 'audio' | 'youtube'

export interface MediaAssessmentCriterion {
  id: CriterionId
  name: string
  band: number
  evidence: string
  improvement: string
}

export interface MediaTranscriptTurn {
  speaker: 'examiner' | 'candidate'
  text: string
}

export interface MediaAssessment {
  id: string
  source: MediaAssessmentSource
  sourceName: string
  sourceUrl?: string
  audioAvailable?: boolean
  model: MediaAssessmentModel
  completedAt: string
  durationMs?: number
  overallBand: number
  criteria: MediaAssessmentCriterion[]
  strengths: string[]
  nextSteps: string[]
  transcript: MediaTranscriptTurn[] | string
  sentenceFeedback?: SentenceFeedback[]
  cleanupWarning?: string
}

interface AssessmentInput {
  apiKey: string
  model: MediaAssessmentModel
  source: MediaAssessmentSource
  file?: File
  youtubeUrl?: string
}

const criterionNames: Record<CriterionId, string> = {
  fluency: 'Fluency & Coherence',
  lexical: 'Lexical Resource',
  grammar: 'Grammatical Range & Accuracy',
  pronunciation: 'Pronunciation',
}

const criterionIds = new Set<CriterionId>(['fluency', 'lexical', 'grammar', 'pronunciation'])

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

function isMediaTranscriptTurn(value: unknown): value is MediaTranscriptTurn {
  return isRecord(value)
    && (value.speaker === 'examiner' || value.speaker === 'candidate')
    && typeof value.text === 'string'
    && value.text.trim().length > 0
}

function roundBand(value: number): number {
  return Math.max(0, Math.min(9, Math.round(value * 2) / 2))
}

function parseAssessment(text: string): Omit<MediaAssessment, 'id' | 'source' | 'sourceName' | 'sourceUrl' | 'model' | 'completedAt'> {
  const json = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (error) {
    console.error('Speakia AI returned invalid JSON for the media IELTS assessment.', error)
    throw new Error('Speakia AI returned an unreadable assessment. Try assessing the media again.')
  }
  if (!isRecord(parsed)
    || typeof parsed.overallBand !== 'number'
    || !Number.isFinite(parsed.overallBand)
    || parsed.overallBand < 0 || parsed.overallBand > 9
    || !Array.isArray(parsed.criteria) || !Array.isArray(parsed.strengths)
    || !Array.isArray(parsed.nextSteps) || !Array.isArray(parsed.transcriptTurns)
    || !Array.isArray(parsed.sentenceFeedback)) {
    throw new Error('Speakia AI returned an incomplete assessment. Try assessing the media again.')
  }
  if (!parsed.transcriptTurns.every(isMediaTranscriptTurn)) {
    throw new Error('Speakia AI returned an invalid conversation transcript. Try the assessment again.')
  }
  const transcriptTurns: MediaTranscriptTurn[] = parsed.transcriptTurns.map((turn) => ({
    speaker: turn.speaker,
    text: turn.text,
  }))

  const criteria: MediaAssessmentCriterion[] = []
  for (const item of parsed.criteria) {
    if (!isRecord(item)
      || typeof item.id !== 'string' || !criterionIds.has(item.id as CriterionId)
      || typeof item.band !== 'number' || !Number.isFinite(item.band) || item.band < 0 || item.band > 9
      || typeof item.evidence !== 'string' || typeof item.improvement !== 'string') {
      throw new Error('Speakia AI returned an invalid criterion. Try the assessment again.')
    }
    const id = item.id as CriterionId
    criteria.push({
      id,
      name: criterionNames[id],
      band: roundBand(item.band),
      evidence: item.evidence,
      improvement: item.improvement,
    })
  }
  if (criteria.length !== 4 || new Set(criteria.map((item) => item.id)).size !== 4) {
    throw new Error('Speakia AI did not return all four IELTS speaking criteria. Try again.')
  }
  if (!parsed.strengths.every((item) => typeof item === 'string')
    || !parsed.nextSteps.every((item) => typeof item === 'string')) {
    throw new Error('Speakia AI returned invalid feedback. Try again.')
  }
  if (parsed.sentenceFeedback.length > 80 || !parsed.sentenceFeedback.every(isSentenceFeedback)) {
    throw new Error('Speakia AI returned invalid sentence-by-sentence feedback. Try again.')
  }

  return {
    overallBand: roundBand(criteria.reduce((total, criterion) => total + criterion.band, 0) / criteria.length),
    criteria,
    strengths: parsed.strengths.slice(0, 6),
    nextSteps: parsed.nextSteps.slice(0, 6),
    transcript: transcriptTurns,
    sentenceFeedback: parsed.sentenceFeedback,
  }
}

function audioMimeType(file: File): string {
  if (file.type.startsWith('audio/')) return file.type
  const extension = file.name.split('.').pop()?.toLocaleLowerCase()
  const knownTypes: Record<string, string> = {
    aac: 'audio/aac',
    aiff: 'audio/aiff',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    webm: 'audio/webm',
  }
  return extension ? knownTypes[extension] ?? '' : ''
}

function isModelUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /model.{0,100}(not found|not available|not supported|invalid)|(?:not found|not available|not supported).{0,100}model/i.test(message)
}

function modelCandidates(model: MediaAssessmentModel): MediaAssessmentModel[] {
  if (model === 'gemini-3.1-pro-preview') return [model, 'gemini-pro-latest']
  if (model === 'gemini-pro-latest') return [model, 'gemini-3.1-pro-preview']
  return [model]
}

export function normalizeYouTubeUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('Enter a valid YouTube video URL.')
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Use a secure HTTPS YouTube video URL.')
  }

  const hostname = url.hostname.toLocaleLowerCase()
  const validHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'])
  if (!validHosts.has(hostname)) throw new Error('Only youtube.com and youtu.be video links are supported.')

  const pathSegments = url.pathname.split('/').filter(Boolean)
  const videoId = hostname === 'youtu.be'
    ? pathSegments[0]
    : url.pathname === '/watch'
      ? url.searchParams.get('v')
      : ['shorts', 'live', 'embed', 'v', 'clip'].includes(pathSegments[0] ?? '')
        ? pathSegments[1]
        : undefined
  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    throw new Error('That link does not appear to contain a valid YouTube video.')
  }
  return url.toString()
}

function promptFor(source: MediaAssessmentSource): string {
  return [
    `Assess the candidate's IELTS Speaking performance in this ${source === 'audio' ? 'audio recording' : 'YouTube video'}.`,
    'Assess only spoken candidate responses using the four public IELTS Speaking criteria: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, and Pronunciation.',
    IELTS_SPEAKING_CALIBRATION,
    'If there is an interviewer, distinguish the interviewer from the candidate and score only the candidate. For video, use visuals only as context to distinguish speakers; never score appearance, identity, or visual presentation.',
    'Give a whole or half IELTS band from 0 to 9 for each criterion. The overall band must be the arithmetic mean rounded to the nearest half band.',
    'For each criterion, cite specific audible evidence and provide one actionable improvement. Do not invent speech or claim certainty when the audio is unclear.',
    'Provide concise sentence feedback for up to 25 representative candidate sentences across the recording, prioritizing clear errors. Preserve the original wording, identify the issue, give a natural correction, a concise illustrative Band 8-style alternative (not a guaranteed score), and a brief explanation. Never invent a candidate sentence or assess interviewer speech.',
    `Transcribe the ${source === 'youtube' ? 'YouTube video' : 'audio recording'} verbatim as ordered speaker turns, including candidate/respondent and interviewer/examiner wherever present. Do not summarize, paraphrase, clean up grammar, or omit filler words, repetitions, or false starts. Use speaker "candidate" for the person answering and "examiner" for the interviewer/questioner/host. Mark genuinely unintelligible words as [unintelligible] rather than guessing. Cover all audible speech, not only candidate answers.`,
    'Assess only candidate/respondent turns. Do not invent speech or claim certainty when the audio is unclear. If the media does not contain enough candidate speech to assess a criterion, say so in its evidence and avoid fabricating performance.',
    'Return constructive, detailed feedback and a concise set of strengths and next steps. This is a practice estimate, not an official IELTS score.',
    'Return one valid JSON object with keys overallBand (number), criteria (array of exactly four objects with id, band, evidence, improvement), strengths (string array), nextSteps (string array), transcriptTurns (array of ordered objects with speaker ("examiner" or "candidate") and text), and sentenceFeedback (array of at most 25 objects with originalSentence, issue, correction, bandEightVersion, explanation). Keep feedback concise. Include every audible spoken turn in transcriptTurns without combining separate speaker turns. Use criterion ids fluency, lexical, grammar, and pronunciation. Do not include markdown fences or extra text.',
  ].join('\n')
}

export async function assessMedia(input: AssessmentInput): Promise<MediaAssessment> {
  if (!input.apiKey.trim()) throw new Error('Add your Speakia AI API key before starting an assessment.')

  const client = new GoogleGenAI({ apiKey: input.apiKey.trim() })
  const sourceName = input.source === 'audio' ? input.file?.name : input.youtubeUrl
  if (!sourceName) throw new Error('Select an audio recording or enter a YouTube URL.')

  let uploadedFileName: string | undefined
  let assessment: MediaAssessment | null = null
  let cleanupWarning: string | undefined
  let requestFailed = false
  let requestError: unknown
  try {
    let mediaInput: { type: 'audio'; uri: string; mime_type: string } | { type: 'video'; uri: string }
    if (input.source === 'audio') {
      const file = input.file
      if (!file || file.size === 0) throw new Error('Choose a non-empty audio recording.')
      const mimeType = audioMimeType(file)
      if (!mimeType) throw new Error('Choose a supported audio file, such as MP3, WAV, M4A, OGG, FLAC, AIFF, AAC, or WebM.')
      const uploaded = await client.files.upload({
        file,
        config: { displayName: file.name, mimeType },
      })
      if (!uploaded.uri) throw new Error('Speakia AI uploaded the audio but did not return a usable file URI.')
      uploadedFileName = uploaded.name
      if (!uploadedFileName) cleanupWarning = 'Speakia AI did not return a file name, so the uploaded audio could not be explicitly removed.'
      mediaInput = { type: 'audio', uri: uploaded.uri, mime_type: uploaded.mimeType ?? mimeType }
    } else {
      const youtubeUrl = normalizeYouTubeUrl(input.youtubeUrl ?? '')
      mediaInput = { type: 'video', uri: youtubeUrl }
    }

    let response: Awaited<ReturnType<typeof client.interactions.create>> | undefined
    let usedModel = input.model
    const candidates = modelCandidates(input.model)
    for (const [index, candidate] of candidates.entries()) {
      try {
        response = await client.interactions.create({
          model: candidate,
          stream: false,
          input: [
            { type: 'text', text: promptFor(input.source) },
            mediaInput,
          ],
          generation_config: { temperature: 0.2 },
          response_format: { type: 'text', mime_type: 'application/json' },
        })
        usedModel = candidate
        break
      } catch (error) {
        if (index === candidates.length - 1 || !isModelUnavailableError(error)) throw error
        console.warn(`Media assessment model ${candidate} is unavailable; trying ${candidates[index + 1]}.`, error)
      }
    }
    const outputText = response && isRecord(response) && typeof response.output_text === 'string'
      ? response.output_text
      : ''
    if (!outputText.trim()) throw new Error('Speakia AI returned an empty assessment. Try again.')

    const details = parseAssessment(outputText)
    assessment = {
      ...details,
      id: crypto.randomUUID(),
      source: input.source,
      sourceName,
      ...(input.source === 'youtube' ? { sourceUrl: input.youtubeUrl } : {}),
      model: usedModel,
      completedAt: new Date().toISOString(),
    }
  } catch (error) {
    requestFailed = true
    requestError = error
  } finally {
    if (uploadedFileName) {
      try {
        await client.files.delete({ name: uploadedFileName })
      } catch (error) {
        console.warn('Unable to remove the uploaded audio from Speakia AI file storage.', error)
        cleanupWarning = 'Speakia AI could not confirm removal of the uploaded audio file. Check your your AI provider AI file storage.'
      }
    }
  }
  if (requestFailed) {
    if (cleanupWarning) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to assess this media.'
      throw new Error(`${message} ${cleanupWarning}`)
    }
    throw requestError
  }
  if (!assessment) throw new Error('The media assessment did not produce a result.')
  return cleanupWarning ? { ...assessment, cleanupWarning } : assessment
}
