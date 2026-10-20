import { GoogleGenAI } from '@google/genai'
import { PODCAST_TTS_MODELS } from '@/features/podcasts/types'

const DATABASE_NAME = 'speakia-topic-model-answer-audio'
const DATABASE_VERSION = 1
const STORE_NAME = 'answers'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support locally saved model-answer audio.'))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open model-answer audio storage.'))
    request.onblocked = () => reject(new Error('Model-answer audio storage is blocked by another open Speakia tab.'))
  })
}

function cacheKey(promptId: string, answer: string): string {
  return `${promptId}:${answer.trim()}`
}

export async function loadModelAnswerAudio(promptId: string, answer: string): Promise<Blob | null> {
  const database = await openDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(cacheKey(promptId, answer))
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => reject(request.error ?? new Error('Unable to load cached model-answer audio.'))
    })
  } finally {
    database.close()
  }
}

export async function saveModelAnswerAudio(promptId: string, answer: string, audio: Blob): Promise<void> {
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(audio, cacheKey(promptId, answer))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save model-answer audio.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving model-answer audio was aborted.'))
    })
  } finally {
    database.close()
  }
}

function base64ToBytes(data: string): Uint8Array {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function pcmToWav(data: Uint8Array, mimeType: string): Blob {
  const sampleRate = Number(mimeType.match(/rate=(\d+)/i)?.[1] ?? 24000)
  const channels = Number(mimeType.match(/channels=(\d+)/i)?.[1] ?? 1)
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isFinite(channels) || channels <= 0) {
    throw new Error(`Gemini returned unsupported model-answer audio format: ${mimeType || 'unknown format'}.`)
  }
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
  }
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + data.byteLength, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, data.byteLength, true)
  const pcm = new ArrayBuffer(data.byteLength)
  new Uint8Array(pcm).set(data)
  return new Blob([header, pcm], { type: 'audio/wav' })
}

export async function generateModelAnswerAudio(apiKey: string, answer: string): Promise<Blob> {
  if (!apiKey.trim()) throw new Error('Add your Gemini API key in Settings to generate model-answer audio.')
  if (!answer.trim()) throw new Error('There is no model answer to read aloud.')
  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  try {
    const response = await client.models.generateContent({
      model: PODCAST_TTS_MODELS[1].id,
      contents: `Read this IELTS Speaking model answer naturally and clearly. Do not add commentary or change any wording:\n${answer.trim()}`,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fola' } } },
      },
    })
    const inlineData = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
      .find((part) => part.inlineData?.data)?.inlineData
    if (!inlineData?.data) throw new Error('Gemini returned no model-answer audio.')
    const bytes = base64ToBytes(inlineData.data)
    if (inlineData.mimeType?.toLocaleLowerCase().startsWith('audio/wav')) {
      const wavData = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(wavData).set(bytes)
      return new Blob([wavData], { type: inlineData.mimeType })
    }
    return pcmToWav(bytes, inlineData.mimeType ?? 'audio/L16;rate=24000')
  } catch (error) {
    console.error('Gemini model-answer TTS generation failed.', error)
    throw new Error(error instanceof Error
      ? `Gemini could not generate model-answer audio: ${error.message}`
      : 'Gemini could not generate model-answer audio. Please try again.')
  }
}
