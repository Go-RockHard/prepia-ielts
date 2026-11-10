import { GoogleGenAI } from '@/lib/geminiClient'
import type { CoachAssignment } from '@/features/assignments/types'
import type { LexicalEntry } from '@/features/vault/lexicalEntries'
import type { UserProfile } from '@/features/profile/localAccount'
import type { TestResult } from '@/features/simulator/types'
import { DEFAULT_PODCAST_TURN_COUNT, PODCAST_TURN_COUNTS, type PodcastHost, type PodcastLanguage, type PodcastScriptModel, type PodcastTtsModel, type PodcastTurn, type PodcastWritingAssessment, type SpeakiaPodcast } from './types'

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
  if (!dataLength) throw new Error('Speakia AI returned no audio chunks for this podcast.')
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
  hosts: [PodcastHost, PodcastHost] = [{ name: 'Aisha', gender: 'female' }, { name: 'Hamza', gender: 'male' }],
  language: PodcastLanguage = 'English',
  productName = 'Speakia',
): Promise<Blob> {
  if (!apiKey.trim()) throw new Error(`Add your shared AI key in Settings to generate ${productName} podcast audio.`)
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
          style: `${turn.speaker === hosts[0].name
            ? 'warm, encouraging, conversational podcast host; natural pace with clear articulation'
            : 'curious, energetic, thoughtful podcast host; natural pace with clear articulation'}${language === 'Urdu' ? '; natural Pakistani Urdu pronunciation and rhythm, not Hindi' : language === 'Punjabi' ? '; natural Pakistani Punjabi pronunciation and rhythm, not Indian Punjabi' : language === 'Code Switching' ? '; natural Pakistani Urdu and Pakistani Punjabi pronunciation when using those languages, not Hindi or Indian Punjabi' : ''}`,
        }],
      })),
    }]
    const generation_config = {
      speech_config: {
        speakers: [
          { speaker: hosts[0].name, voice: hosts[0].gender === 'female' ? 'Kore' : 'Puck' },
          { speaker: hosts[1].name, voice: hosts[1].gender === 'female' ? 'Aoede' : 'Charon' },
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
    console.error(`${productName} multi-speaker podcast TTS generation failed.`, error)
    throw new Error(error instanceof Error
      ? `${productName} could not generate the podcast audio: ${error.message}`
      : `${productName} could not generate the podcast audio. Please try again.`)
  }
  if ('streamedAudio' in response && response.streamedAudio instanceof Blob) return response.streamedAudio
  const audioData = response.output_audio?.data
  if (!audioData) throw new Error(`${productName} returned no audio for this podcast. Please try again.`)
  const audio = base64ToAudioBlob(audioData, response.output_audio?.mime_type)
  if (!audio.size) throw new Error(`${productName} returned an empty audio file for this podcast. Please try again.`)
  return audio
}

export async function generateWritiaPodcast(
  apiKey: string,
  topic: string,
  context: { profile: UserProfile; assessments: PodcastWritingAssessment[]; assignments: Array<{ title: string; focus: string; status: string }> },
  scriptModel: PodcastScriptModel,
  speechModel: PodcastTtsModel,
  language: PodcastLanguage,
  streaming: boolean,
  hosts: [PodcastHost, PodcastHost],
  turnCount = DEFAULT_PODCAST_TURN_COUNT,
): Promise<SpeakiaPodcast & { audio: Blob }> {
  if (!PODCAST_TURN_COUNTS.some((count) => count === turnCount)) throw new Error('Choose a supported number of podcast turns.')
  if (!apiKey.trim()) throw new Error('Add your shared AI key in Settings to create a Writia podcast.')
  const normalizedTopic = topic.trim().slice(0, 180)
  if (normalizedTopic.length < 3) throw new Error(`Choose what you would like ${hosts[0].name} and ${hosts[1].name} to discuss.`)
  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  const response = await client.models.generateContent({
    model: scriptModel,
    contents: [{
      role: 'user',
      parts: [{
        text: JSON.stringify({
          requestedFocus: normalizedTopic,
          requestedTurnCount: turnCount,
          podcastLanguage: language,
          learner: {
            name: context.profile.displayName || context.profile.username,
            writingTargetBand: context.profile.writingTargetBand || null,
            testType: context.profile.testType,
            writingTestDate: context.profile.writingTestDate || null,
            writingStudyGoal: context.profile.writingStudyGoal || null,
          },
          recentWritingAssessments: context.assessments.slice(0, 8).map((assessment) => ({
            date: new Date(assessment.createdAt).toISOString(),
            task: assessment.taskLabel,
            mode: assessment.mode,
            practiceEstimate: assessment.overallBand,
            wordCount: assessment.wordCount,
            summary: assessment.summary,
            priority: assessment.priority,
            criteria: assessment.criteria.map(({ label, band, evidence, nextStep }) => ({ label, band, evidence, nextStep })),
          })),
          currentWritingAssignments: context.assignments.slice(0, 6),
          availableWritiaResources: [
            'Writing Studio: select Task 1 or Task 2 prompts, draft independently, and request a criterion-based diagnostic.',
            'Guided Practice: scaffold task analysis, idea development, organisation, drafting, and revision.',
            'Writing Drills: short targeted attempts, diagnosis, focused practice, and transfer.',
            'Topics & Vocabulary: task bank and writing vocabulary with contextual upgrades.',
            'Writia Flashcards: retrieve and revisit writing vocabulary using spaced repetition.',
            'Assignments: complete personalized writing tasks and review feedback.',
            'Performance History: review criterion evidence, track progress, and use adaptive interactive lessons.',
            'Learner Profile: set writing goals, target band, and test date to personalize coaching.',
            'Writia Podcasts: listen to personalized two-host writing lessons and strategy conversations.',
          ],
        }),
      }],
    }],
    config: {
      responseMimeType: 'application/json',
      systemInstruction: `Create a warm, engaging, comprehensive two-host audio lesson for an IELTS Writing learner inside Writia. Focus this episode on "${normalizedTopic}". Follow the selected podcast language, using natural Pakistani Urdu/Punjabi and the appropriate script when requested; do not use Hindi or Indian Punjabi. Hosts ${hosts[0].name} and ${hosts[1].name} are supportive writing educators, not examiners. Generate exactly ${turnCount} alternating, concise turns (about ${Math.round(turnCount * 42)}–${Math.round(turnCount * 67)} words total) that sound like a real podcast, not a checklist. Personalize the advice to the supplied Writing assessment evidence: identify demonstrated strengths and the 1–3 clearest improvement priorities, explain why they matter, model practical ways to improve them, and give the learner a short weekly improvement agenda. Never invent results, weaknesses, tasks, app activity, or learner evidence. If assessment history is empty, state that the episode is based on the learner's goals and general writing pedagogy, not an assessment of their ability. Explain how to make effective use of Writia's relevant resources: independent drafting, gradual scaffolding, targeted drills with transfer, contextual vocabulary, spaced retrieval, assignments, assessment history, and learner profile. Emphasize task fulfilment, coherent progression, precise and natural vocabulary, and controlled grammatical range. Teach a deliberate cycle: retrieve a skill, practise it, apply it in a new response, and reflect on evidence. Do not equate difficult vocabulary with quality, write a complete essay for the learner, or present AI practice estimates as official IELTS scores. Address the learner by preferred name when available. End with a concrete next action. Keep each spoken turn to 1–3 sentences and return valid JSON only: {"title":string,"summary":string,"turns":[{"speaker":"${hosts[0].name}"|"${hosts[1].name}","text":string},...]. The turns must alternate, starting with ${hosts[0].name}.`,
    },
  })
  const generatedText = response.text?.trim()
  if (!generatedText) throw new Error('Writia returned an empty podcast script. Please try again.')
  let generated: unknown
  try {
    generated = JSON.parse(generatedText)
  } catch (error) {
    console.error('Writia returned invalid podcast JSON.', error)
    throw new Error('Writia could not read the generated podcast script. Please try again.')
  }
  if (!isRecord(generated) || typeof generated.title !== 'string' || !generated.title.trim()
    || typeof generated.summary !== 'string' || !generated.summary.trim()
    || !Array.isArray(generated.turns) || generated.turns.length !== turnCount) {
    throw new Error('Writia received an incomplete podcast script. Please try again.')
  }
  const turns: PodcastTurn[] = generated.turns.map((turn, index) => {
    const expectedSpeaker = index % 2 === 0 ? hosts[0].name : hosts[1].name
    if (!isRecord(turn) || turn.speaker !== expectedSpeaker || typeof turn.text !== 'string' || !turn.text.trim()) {
      throw new Error('Writia received invalid podcast dialogue. Please generate the episode again.')
    }
    const text = turn.text.trim()
    if (text.length > 1200) throw new Error('A Writia podcast segment was too long to play. Please try again.')
    return { speaker: expectedSpeaker, text }
  })
  const audio = await synthesizePodcastAudio(apiKey, turns, speechModel, streaming, hosts, language, 'Writia')
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
    hosts,
    scriptModel,
    speechModel,
    language,
    streaming,
    playbackMode: 'recorded',
  }
}

export async function generateSpeakiaPodcast(
  apiKey: string,
  topic: string,
  context: PodcastGenerationContext,
  scriptModel: PodcastScriptModel,
  speechModel: PodcastTtsModel,
  language: PodcastLanguage,
  streaming: boolean,
  hosts: [PodcastHost, PodcastHost],
  turnCount = DEFAULT_PODCAST_TURN_COUNT,
): Promise<SpeakiaPodcast & { audio: Blob }> {
  if (!PODCAST_TURN_COUNTS.some((count) => count === turnCount)) throw new Error('Choose a supported number of podcast turns.')
  if (!apiKey.trim()) throw new Error('Add your Speakia AI API key in Settings to create a Speakia podcast.')
  const normalizedTopic = topic.trim().slice(0, 180)
  if (normalizedTopic.length < 3) throw new Error(`Choose what you would like ${hosts[0].name} and ${hosts[1].name} to discuss.`)

  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  const response = await client.models.generateContent({
    model: scriptModel,
    contents: [{
      role: 'user',
      parts: [{
        text: JSON.stringify({
          requestedFocus: normalizedTopic,
          requestedTurnCount: turnCount,
          podcastLanguage: language,
          languageInstructions: language === 'Code Switching'
            ? 'Write the full podcast as natural code-switching conversation blending English, Pakistani Urdu, and Pakistani Punjabi throughout. Use Pakistani Urdu vocabulary and pronunciation (not Hindi) and Pakistani Punjabi vocabulary and pronunciation (not Indian Punjabi). Use Urdu Perso-Arabic script for Urdu and Shahmukhi for Punjabi; do not use Devanagari or Gurmukhi. Use each language organically within turns; do not make separate monolingual sections.'
            : language === 'Urdu'
              ? 'Write every spoken host turn in natural Pakistani Urdu, using vocabulary, idiom, and usage familiar in Pakistan, in Urdu Perso-Arabic script. Do not use Hindi vocabulary or Devanagari.'
              : language === 'Punjabi'
                ? 'Write every spoken host turn in natural Pakistani Punjabi, using vocabulary and usage familiar in Pakistan, in Shahmukhi script. Do not use Indian Punjabi vocabulary or Gurmukhi.'
                : 'Write the complete podcast in English. Keep all spoken host turns in English.',
          learner: {
            name: context.profile.displayName || context.profile.username,
            targetBand: context.profile.speakingTargetBand || context.profile.targetBand || null,
            writingTargetBand: context.profile.writingTargetBand || null,
            testType: context.profile.testType,
            testDate: context.profile.speakingTestDate || context.profile.testDate || null,
            writingTestDate: context.profile.writingTestDate || null,
            studyGoal: context.profile.speakingStudyGoal || context.profile.studyGoal || null,
            writingStudyGoal: context.profile.writingStudyGoal || null,
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
Follow the requested languageInstructions exactly. For Urdu use natural Pakistani Urdu, with vocabulary and idiom familiar in Pakistan, in Urdu Perso-Arabic script; do not use Hindi vocabulary or Devanagari. For Punjabi use natural Pakistani Punjabi, with vocabulary familiar in Pakistan, in Shahmukhi script; do not use Indian Punjabi vocabulary or Gurmukhi. For Code Switching blend English, Pakistani Urdu, and Pakistani Punjabi naturally in the same conversation, following those language-specific vocabulary and script requirements.
The two Pakistani co-hosts are ${hosts[0].name} and ${hosts[1].name}. ${hosts[0].name} is an encouraging IELTS learning coach who connects advice to learner context; ${hosts[1].name} is a curious speaking-test strategist who adds practical examples, gentle humor, and follow-up questions. They are two AI co-hosts speaking to one listener, not examiners grading the learner.
Make it sound like an enjoyable, natural podcast—not a report or a list. Open with a welcoming hook, then alternate between ${hosts[0].name} and ${hosts[1].name} for exactly ${turnCount} concise conversational turns, and finish with a clear, encouraging takeaway and one small action for the learner. Address the learner by their supplied preferred name when available. Include relevant discussion of Speakia features and specific ways to use them. Discuss recent progress, evidence-based strengths, and 1–3 priority areas only when saved evidence exists; be tactful, explain that practice bands are estimates, and never invent scores, history, app activity, or completed tasks. If history is empty, be transparent and give a useful general IELTS Speaking episode instead. Include specific IELTS Speaking examples and practical tips. Keep each turn to 1–3 sentences, with no markdown.
Return valid JSON only: {"title":string,"summary":string,"turns":[{"speaker":"${hosts[0].name}"|"${hosts[1].name}","text":string},...].
The turns must alternate ${hosts[0].name}, ${hosts[1].name}, starting with ${hosts[0].name}. Keep the complete spoken script around ${Math.round(turnCount * 42)}–${Math.round(turnCount * 67)} words.`,
    },
  })

  const generatedText = response.text?.trim()
  if (!generatedText) throw new Error('Speakia AI returned an empty podcast script. Please try again.')
  let generated: unknown
  try {
    generated = JSON.parse(generatedText)
  } catch (error) {
    console.error('Speakia AI returned invalid JSON for a Speakia podcast.', error)
    throw new Error('Speakia could not read the generated podcast script. Please try again.')
  }
  if (!isRecord(generated)
    || typeof generated.title !== 'string'
    || !generated.title.trim()
    || typeof generated.summary !== 'string'
    || !generated.summary.trim()
    || !Array.isArray(generated.turns)
    || generated.turns.length !== turnCount) {
    throw new Error('Speakia received an incomplete podcast script. Please try again.')
  }

  const turns: PodcastTurn[] = generated.turns.map((turn, index) => {
    const expectedSpeaker = index % 2 === 0 ? hosts[0].name : hosts[1].name
    if (!isRecord(turn) || turn.speaker !== expectedSpeaker || typeof turn.text !== 'string' || !turn.text.trim()) {
      throw new Error('Speakia received an invalid podcast dialogue. Please generate the episode again.')
    }
    const text = turn.text.trim()
    if (text.length > 1200) throw new Error('A podcast segment was too long to play. Please try again.')
    return { speaker: expectedSpeaker, text }
  })

  const audio = await synthesizePodcastAudio(apiKey, turns, speechModel, streaming, hosts, language)
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
    hosts,
    scriptModel,
    speechModel,
    language,
    streaming,
    playbackMode: 'recorded',
  }
}
