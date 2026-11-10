import { GoogleGenAI } from '@/lib/geminiClient'
import { getProdiaTextModel } from '@/lib/geminiModels'
import { prepareAudioForAssessment, MAX_INLINE_AUDIO_BYTES } from '@/features/simulator/gemini'
import type { DrillEvaluation } from './storage'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseEvaluation(value: string): DrillEvaluation {
  let decoded: unknown
  try {
    decoded = JSON.parse(value)
  } catch (error) {
    console.error('Speakia AI returned invalid JSON for a Speaking Drill evaluation.', error)
    throw new Error('Speakia AI returned an unreadable drill evaluation. Try evaluating this attempt again.')
  }
  if (!isRecord(decoded)
    || typeof decoded.masteryScore !== 'number' || decoded.masteryScore < 0 || decoded.masteryScore > 100
    || typeof decoded.summary !== 'string' || !decoded.summary.trim()
    || !Array.isArray(decoded.strengths) || !decoded.strengths.every((entry) => typeof entry === 'string')
    || !Array.isArray(decoded.improvements) || !decoded.improvements.every((entry) => typeof entry === 'string')
    || !Array.isArray(decoded.criteria) || decoded.criteria.length !== 4
    || new Set(decoded.criteria.map((criterion) => isRecord(criterion) ? criterion.id : undefined)).size !== 4
    || !decoded.criteria.every((criterion) => isRecord(criterion)
      && ['fluency', 'vocabulary', 'grammar', 'pronunciation'].includes(String(criterion.id))
      && typeof criterion.score === 'number' && criterion.score >= 0 && criterion.score <= 100
      && typeof criterion.evidence === 'string' && typeof criterion.nextStep === 'string')
    || typeof decoded.nextDrill !== 'string'
    || !['strong', 'moderate', 'limited'].includes(String(decoded.evidenceQuality))) {
    throw new Error('Speakia AI returned an incomplete Speaking Drill evaluation. Try evaluating this attempt again.')
  }
  return {
    masteryScore: Math.round(decoded.masteryScore),
    summary: decoded.summary.trim(),
    strengths: (decoded.strengths as string[]).map((item) => item.trim()).filter(Boolean).slice(0, 4),
    improvements: (decoded.improvements as string[]).map((item) => item.trim()).filter(Boolean).slice(0, 4),
    criteria: decoded.criteria.map((criterion) => ({
      id: criterion.id as DrillEvaluation['criteria'][number]['id'],
      score: Math.round(criterion.score as number),
      evidence: (criterion.evidence as string).trim(),
      nextStep: (criterion.nextStep as string).trim(),
    })),
    nextDrill: decoded.nextDrill.trim(),
    evidenceQuality: decoded.evidenceQuality as DrillEvaluation['evidenceQuality'],
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

export async function evaluateSpeakingDrill(
  apiKey: string,
  input: {
    title: string
    skill: string
    task: string
    prompt: string
    transcript: { role: 'examiner' | 'candidate'; text: string }[]
    recording: Blob
  },
): Promise<DrillEvaluation> {
  if (!apiKey.trim()) throw new Error('Add your Speakia AI API key in Settings before evaluating a drill.')
  const candidateTurns = input.transcript.filter((turn) => turn.role === 'candidate' && turn.text.trim())
  if (!candidateTurns.length) throw new Error('There is no candidate transcript to evaluate. Allow captions during the drill and try again.')
  if (!input.recording.size) throw new Error('No drill audio was recorded, so Speakia AI cannot evaluate this attempt.')
  if (input.recording.size > MAX_INLINE_AUDIO_BYTES) throw new Error('This drill recording is too large for Speakia AI evaluation. Try a shorter drill.')

  const audio = await prepareAudioForAssessment(input.recording)
  const transcript = input.transcript.map((turn) => `${turn.role === 'candidate' ? 'Candidate' : 'Coach'}: ${turn.text}`).join('\n')
  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  const response = await client.models.generateContent({
    model: getProdiaTextModel(),
    contents: [{
      role: 'user',
      parts: [
        { text: [
          `Evaluate the learner's short IELTS Speaking drill: ${input.title}.`,
          `Target skill: ${input.skill}. Exercise: ${input.task}. Prompt: ${input.prompt}.`,
          'Assess only what is supported by the candidate audio and transcript. Use the audio for fluency and pronunciation evidence; use the transcript for vocabulary, grammar, and coherence. Do not infer ability from examiner/coach speech.',
          'Return a 0–100 practice mastery score for this specific drill, not an IELTS band. Explain the score using concrete evidence and acknowledge when the short sample limits confidence.',
          'Return criterion scores for fluency, vocabulary, grammar, and pronunciation, each with short evidence and one actionable next step. Focus the summary, strengths, and improvements primarily on the target skill.',
          'Do not invent errors, words, or progress compared with earlier sessions. This is one attempt and not an official IELTS result.',
          'Return valid JSON only: {"masteryScore":number,"summary":string,"strengths":string[],"improvements":string[],"criteria":[{"id":"fluency"|"vocabulary"|"grammar"|"pronunciation","score":number,"evidence":string,"nextStep":string}],"nextDrill":string,"evidenceQuality":"strong"|"moderate"|"limited"}.',
          'Conversation transcript:',
          transcript,
        ].join('\n') },
        { inlineData: { mimeType: 'audio/wav', data: toBase64(new Uint8Array(await audio.arrayBuffer())) } },
      ],
    }],
    config: { temperature: 0.2, responseMimeType: 'application/json' },
  })
  if (!response.text?.trim()) throw new Error('Speakia AI returned an empty Speaking Drill evaluation. Try again.')
  return parseEvaluation(response.text)
}
