import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai'

export const AUDIO_LESSON_TTS_MODEL = 'gemini-3.8-flash-lite-tts'
export const AUDIO_LESSON_VOICE = 'Fola'

export interface AudioLesson {
  id: string
  title: string
  topic: string
  summary: string
  transcript: string
  createdAt: string
  voice: string
  model: string
}

export const audioLessonTool: FunctionDeclaration = {
  name: 'build_speaking_audio_lesson',
  description: 'Create and play a personalized spoken IELTS Speaking lesson in the chat. Use when the learner asks for an audio lesson, listening lesson, spoken tutorial, or wants to learn a speaking skill by listening.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      request: { type: Type.STRING, description: 'What the learner wants to learn in the audio lesson.' },
      topic: { type: Type.STRING, description: 'IELTS Speaking topic or skill.' },
      focus: { type: Type.STRING, description: 'Specific learning focus, such as fluency, vocabulary, grammar, or pronunciation.' },
      part: { type: Type.STRING, enum: ['part1', 'part2', 'part3'], description: 'Relevant IELTS Speaking part, if specified.' },
      level: { type: Type.STRING, description: 'Learner level or target band, if known.' },
    },
    required: ['request'],
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function toWav(chunks: Uint8Array[], mimeType: string): Blob {
  const dataLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  if (!dataLength) throw new Error('Gemini returned no audio for this lesson. Please try again.')
  if (/audio\/(?:x-)?wav/i.test(mimeType)) {
    const data = new Uint8Array(dataLength)
    let offset = 0
    for (const chunk of chunks) {
      data.set(chunk, offset)
      offset += chunk.byteLength
    }
    return new Blob([data], { type: 'audio/wav' })
  }

  const sampleRate = Number(mimeType.match(/rate=(\d+)/i)?.[1]) || 24000
  const bitsPerSample = Number(mimeType.match(/audio\/L(\d+)/i)?.[1]) || 16
  const channels = Number(mimeType.match(/channels=(\d+)/i)?.[1]) || 1
  if (![8, 16, 24, 32].includes(bitsPerSample) || channels < 1 || channels > 2) {
    throw new Error('Gemini returned audio in an unsupported format. Please try again.')
  }
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const writeText = (position: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(position + index, text.charCodeAt(index))
  }
  const blockAlign = channels * bitsPerSample / 8
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeText(36, 'data')
  view.setUint32(40, dataLength, true)
  const data = new Uint8Array(dataLength)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new Blob([header, data], { type: 'audio/wav' })
}

export async function createAudioLesson(
  apiKey: string,
  rawArgs: Record<string, unknown>,
  learnerContext: unknown,
  model: string,
  language: string,
): Promise<{ lesson: AudioLesson; audio: Blob }> {
  if (!apiKey.trim()) throw new Error('Add your Gemini API key in Settings to create an audio lesson.')
  if (!isRecord(rawArgs)) throw new Error('The audio lesson request was incomplete. Please try again.')
  const request = typeof rawArgs.request === 'string' ? rawArgs.request.trim().slice(0, 800) : ''
  if (request.length < 3) throw new Error('Tell Speakia what you want to learn in the audio lesson.')
  const topic = typeof rawArgs.topic === 'string' && rawArgs.topic.trim() ? rawArgs.topic.trim().slice(0, 120) : 'IELTS Speaking'
  const focus = typeof rawArgs.focus === 'string' && rawArgs.focus.trim() ? rawArgs.focus.trim().slice(0, 160) : 'speaking test preparation'
  const part = rawArgs.part === 'part1' || rawArgs.part === 'part2' || rawArgs.part === 'part3' ? rawArgs.part : 'choose the most relevant part'
  const level = typeof rawArgs.level === 'string' && rawArgs.level.trim() ? rawArgs.level.trim().slice(0, 100) : 'adapt to the learner context'
  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  const scriptResponse = await client.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [{ text: JSON.stringify({ learnerContext, request, topic, focus, part, level, language }) }],
    }],
    config: {
      responseMimeType: 'application/json',
      systemInstruction: `Write a concise, natural spoken IELTS Speaking audio lesson in ${language}. Teach one clear skill with an opening, accurate explanation, realistic spoken examples, a short listen-and-repeat or speaking prompt, and a brief takeaway. Keep it friendly, useful, and self-contained; avoid stage directions, markdown, scoring guarantees, and references to audio production. Target 250–450 spoken words. Return only JSON: {"title": string, "summary": string, "transcript": string}.`,
    },
  })
  const scriptText = scriptResponse.text?.trim()
  if (!scriptText) throw new Error('Gemini returned an empty audio lesson script. Please try again.')

  let decoded: unknown
  try {
    decoded = JSON.parse(scriptText)
  } catch (error) {
    console.error('Gemini returned invalid JSON for a Speakia audio lesson.', error)
    throw new Error('Speakia could not read the audio lesson script. Please try again.')
  }
  if (!isRecord(decoded)
    || typeof decoded.title !== 'string' || !decoded.title.trim()
    || typeof decoded.summary !== 'string' || !decoded.summary.trim()
    || typeof decoded.transcript !== 'string' || decoded.transcript.trim().length < 80
    || decoded.transcript.length > 12000) {
    throw new Error('Speakia received an incomplete audio lesson script. Please try again.')
  }

  const stream = await client.models.generateContentStream({
    model: AUDIO_LESSON_TTS_MODEL,
    contents: [{ role: 'user', parts: [{ text: `## Transcript:\n${decoded.transcript.trim()}` }] }],
    config: {
      temperature: 1,
      responseModalities: ['audio'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: AUDIO_LESSON_VOICE } },
      },
    },
  })
  const audioChunks: Uint8Array[] = []
  let audioMimeType = ''
  for await (const chunk of stream) {
    const parts = chunk.candidates?.[0]?.content?.parts ?? []
    for (const part of parts) {
      if (!part.inlineData?.data) continue
      audioMimeType ||= part.inlineData.mimeType ?? ''
      audioChunks.push(decodeBase64(part.inlineData.data))
    }
  }
  const audio = toWav(audioChunks, audioMimeType)
  if (!audio.size) throw new Error('Gemini returned an empty audio lesson. Please try again.')

  return {
    audio,
    lesson: {
      id: crypto.randomUUID(),
      title: decoded.title.trim().slice(0, 120),
      topic,
      summary: decoded.summary.trim().slice(0, 500),
      transcript: decoded.transcript.trim(),
      createdAt: new Date().toISOString(),
      voice: AUDIO_LESSON_VOICE,
      model: AUDIO_LESSON_TTS_MODEL,
    },
  }
}
