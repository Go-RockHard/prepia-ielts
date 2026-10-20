import { GoogleGenAI } from '@google/genai'
import type { CoachAssignment } from '@/features/assignments/types'
import type { LexicalEntry } from '@/features/vault/lexicalEntries'
import type { UserProfile } from '@/features/profile/localAccount'
import type { TestResult } from '@/features/simulator/types'
import type { PodcastLanguage, PodcastScriptModel, PodcastTtsModel, PodcastTurn, SpeakiaPodcast } from './types'

interface PodcastGenerationContext {
  profile: UserProfile
  results: TestResult[]
  lexicalEntries: LexicalEntry[]
  assignments: CoachAssignment[]
  coachActivity: {
    recentLearnerRequests: string[]
    modules: { kind: string; title: string; topic: string; summary: string; interactions: string[] }[]
    learnerMessageCount: number
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function estimateDuration(turns: PodcastTurn[]): number {
  const wordCount = turns.reduce((total, turn) => total + turn.text.split(/\s+/).filter(Boolean).length, 0)
  return Math.max(60, Math.round(wordCount / 2.35 * 60))
}

function base64ToAudioBlob(data: string, mimeType: string | undefined): Blob {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mimeType || 'audio/wav' })
}

function pcmChunksToWav(chunks: Uint8Array[], sampleRate = 24000, channels = 1): Blob {
  const dataLength = chunks.reduce((total, chunk) => total + chunk.length, 0)
  if (!dataLength) throw new Error('Gemini returned no audio chunks for this podcast.')
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
  }
  const bitsPerSample = 16
  const bytesPerSecond = sampleRate * channels * bitsPerSample / 8
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, bytesPerSecond, true)
  view.setUint16(32, channels * bitsPerSample / 8, true)
  view.setUint16(34, bitsPerSample, true)
  writeText(36, 'data')
  view.setUint32(40, dataLength, true)
  const parts: BlobPart[] = [header]
  for (const chunk of chunks) {
    const buffer = new ArrayBuffer(chunk.byteLength)
    new Uint8Array(buffer).set(chunk)
    parts.push(buffer)
  }
  return new Blob(parts, { type: 'audio/wav' })
}

function getWavDuration(audio: Blob): Promise<number | null> {
  return audio.slice(0, 1024).arrayBuffer().then((buffer) => {
    const view = new DataView(buffer)
    if (view.byteLength < 44 || view.getUint32(0, false) !== 0x52494646 || view.getUint32(8, false) !== 0x57415645) {
      return null
    }
    let offset = 12
    while (offset + 8 <= view.byteLength) {
      const chunkId = view.getUint32(offset, false)
      const chunkSize = view.getUint32(offset + 4, true)
      if (chunkId === 0x64617461) {
        const byteRate = view.getUint32(28, true)
        return byteRate > 0 ? Math.round(chunkSize / byteRate) : null
      }
      offset += 8 + chunkSize + (chunkSize % 2)
    }
    return null
  })
}

export async function synthesizePodcastAudio(
  apiKey: string,
  turns: PodcastTurn[],
  model: PodcastTtsModel,
  streaming = false,
): Promise<Blob> {
  if (!apiKey.trim()) throw new Error('Add your Gemini API key in Settings to generate podcast audio.')
  if (turns.length < 2) throw new Error('This podcast does not have enough dialogue to generate audio.')
  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  let response
  try {
    const input = [{
      type: 'user_input' as const,
      content: turns.map((turn) => ({
        type: 'text' as const,
        text: turn.text,
        annotations: [{
          type: 'speech_metadata' as const,
          speaker: turn.speaker,
          style: turn.speaker === 'Aisha'
            ? 'warm, encouraging, conversational podcast host; natural pace with clear articulation'
            : 'curious, energetic, thoughtful podcast host; natural pace with clear articulation',
        }],
      })),
    }]
    const generation_config = {
      speech_config: {
        speakers: [
          { speaker: 'Aisha', voice: 'Kore' },
          { speaker: 'Noah', voice: 'Puck' },
        ],
      },
    }
    if (streaming) {
      const stream = await client.interactions.create({
        model,
        input,
        generation_config,
        response_format: { type: 'audio', mime_type: 'audio/l16', sample_rate: 24000, channels: 1 },
        stream: true,
      })
      const chunks: Uint8Array[] = []
      for await (const event of stream) {
        if (event.event_type === 'step.delta' && event.delta.type === 'audio' && event.delta.data) {
          const binary = atob(event.delta.data)
          const chunk = new Uint8Array(binary.length)
          for (let index = 0; index < binary.length; index += 1) chunk[index] = binary.charCodeAt(index)
          chunks.push(chunk)
        }
      }
      response = { output_audio: { data: '', mime_type: 'audio/wav' }, streamedAudio: pcmChunksToWav(chunks) }
    } else {
      response = await client.interactions.create({
        model,
        input,
        generation_config,
        response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
      })
    }
  } catch (error) {
    console.error('Gemini multi-speaker podcast TTS generation failed.', error)
    throw new Error(error instanceof Error
      ? `Gemini could not generate the podcast audio: ${error.message}`
      : 'Gemini could not generate the podcast audio. Please try again.')
  }
  if ('streamedAudio' in response && response.streamedAudio instanceof Blob) return response.streamedAudio
  const audioData = response.output_audio?.data
  if (!audioData) throw new Error('Gemini returned no audio for this podcast. Please try again.')
  const audio = base64ToAudioBlob(audioData, response.output_audio?.mime_type)
  if (!audio.size) throw new Error('Gemini returned an empty audio file for this podcast. Please try again.')
  return audio
}

export async function generateSpeakiaPodcast(
  apiKey: string,
  topic: string,
  context: PodcastGenerationContext,
  scriptModel: PodcastScriptModel,
  speechModel: PodcastTtsModel,
  language: PodcastLanguage,
  streaming: boolean,
): Promise<SpeakiaPodcast & { audio: Blob }> {
  if (!apiKey.trim()) throw new Error('Add your Gemini API key in Settings to create a Speakia podcast.')
  const normalizedTopic = topic.trim().slice(0, 180)
  if (normalizedTopic.length < 3) throw new Error('Choose what you would like Aisha and Noah to discuss.')

  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  const response = await client.models.generateContent({
    model: scriptModel,
    contents: [{
      role: 'user',
      parts: [{
        text: JSON.stringify({
          requestedFocus: normalizedTopic,
          podcastLanguage: language,
          languageInstructions: language === 'Code Switching'
            ? 'Write the full podcast as natural code-switching conversation blending English, Urdu, and Punjabi throughout. Use each language organically within turns; do not make separate monolingual sections.'
            : `Write the complete podcast in ${language}. Keep all spoken host turns in that language. For Urdu or Punjabi, use the appropriate native writing system.`,
          learner: {
            name: context.profile.displayName || context.profile.username,
            targetBand: context.profile.targetBand || null,
            testType: context.profile.testType,
            testDate: context.profile.testDate || null,
            studyGoal: context.profile.studyGoal || null,
          },
          recentSpeakingPractice: context.results.slice(0, 8).map((result) => ({
            date: result.completedAt,
            part: result.part,
            topic: result.title,
            estimatedBand: result.overallBand,
            criteria: result.criteria.map(({ name, band, note }) => ({ name, band, feedback: note })),
            strengths: result.strengths,
            nextSteps: result.nextSteps,
            candidateAnswers: result.answers.slice(0, 4).map(({ prompt, answer }) => ({
              prompt,
              answer: answer.slice(0, 450),
            })),
          })),
          currentAssignments: context.assignments.slice(0, 5).map(({ status, title, topic, focus, part }) => ({
            status, title, topic, focus, part,
          })),
          savedVocabulary: context.lexicalEntries.slice(0, 16).map(({ term, meaning, topic }) => ({ term, meaning, topic })),
          recentSpeakiaActivity: context.coachActivity,
          availableAppResources: [
            'Smart lesson: guided IELTS Speaking lessons and interactive practice',
            'Practice: simulated examiner conversations with saved evaluations',
            'Assignments: personalized activities selected by Speakia Coach',
            'Media assessments: feedback on speaking audio and video',
            'Lexical Vault: topic vocabulary, meanings, examples, and prompts',
            'Speakia Coach: text and live-voice IELTS preparation',
          ],
        }),
      }],
    }],
    config: {
      responseMimeType: 'application/json',
      systemInstruction: `Create a warm, engaging, useful two-host audio podcast for an IELTS Speaking learner inside Speakia.
Follow the requested languageInstructions exactly. For Urdu use natural Urdu in Perso-Arabic script. For Punjabi use natural Punjabi in Gurmukhi or Shahmukhi as most appropriate to the language context. For Code Switching blend English, Urdu, and Punjabi naturally in the same conversation.
Hosts: Aisha is an encouraging IELTS learning coach who connects advice to learner context; Noah is a curious speaking-test strategist who adds practical examples, gentle humor, and follow-up questions. They are two AI co-hosts speaking to one listener, not examiners grading the learner.
Make it sound like an enjoyable, natural podcast—not a report or a list. Open with a welcoming hook, then alternate between Aisha and Noah for 12–16 concise conversational turns, and finish with a clear, encouraging takeaway and one small action for the learner. Address the learner by their supplied preferred name when available. Include relevant discussion of Speakia features and specific ways to use them. Discuss recent progress, evidence-based strengths, and 1–3 priority areas only when saved evidence exists; be tactful, explain that practice bands are estimates, and never invent scores, history, app activity, or completed tasks. If history is empty, be transparent and give a useful general IELTS Speaking episode instead. Include specific IELTS Speaking examples and practical tips. Keep each turn to 1–3 sentences, with no markdown.
Return valid JSON only: {"title":string,"summary":string,"turns":[{"speaker":"Aisha"|"Noah","text":string},...]}.
The turns must alternate Aisha, Noah, starting with Aisha. Keep the complete spoken script around 500–800 words.`,
    },
  })

  const generatedText = response.text?.trim()
  if (!generatedText) throw new Error('Gemini returned an empty podcast script. Please try again.')
  let generated: unknown
  try {
    generated = JSON.parse(generatedText)
  } catch (error) {
    console.error('Gemini returned invalid JSON for a Speakia podcast.', error)
    throw new Error('Speakia could not read the generated podcast script. Please try again.')
  }
  if (!isRecord(generated)
    || typeof generated.title !== 'string'
    || !generated.title.trim()
    || typeof generated.summary !== 'string'
    || !generated.summary.trim()
    || !Array.isArray(generated.turns)
    || generated.turns.length < 10
    || generated.turns.length > 18) {
    throw new Error('Speakia received an incomplete podcast script. Please try again.')
  }

  const turns: PodcastTurn[] = generated.turns.map((turn, index) => {
    const expectedSpeaker = index % 2 === 0 ? 'Aisha' : 'Noah'
    if (!isRecord(turn) || turn.speaker !== expectedSpeaker || typeof turn.text !== 'string' || !turn.text.trim()) {
      throw new Error('Speakia received an invalid podcast dialogue. Please generate the episode again.')
    }
    const text = turn.text.trim()
    if (text.length > 1200) throw new Error('A podcast segment was too long to play. Please try again.')
    return { speaker: expectedSpeaker, text }
  })

  const audio = await synthesizePodcastAudio(apiKey, turns, speechModel, streaming)
  const actualDuration = await getWavDuration(audio)
  return {
    audio,
    id: crypto.randomUUID(),
    title: generated.title.trim().slice(0, 120),
    topic: normalizedTopic,
    createdAt: new Date().toISOString(),
    durationSeconds: actualDuration ?? estimateDuration(turns),
    summary: generated.summary.trim().slice(0, 500),
    turns,
    scriptModel,
    speechModel,
    language,
    streaming,
    playbackMode: 'recorded',
  }
}
