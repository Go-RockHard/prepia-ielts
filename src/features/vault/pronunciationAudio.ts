import { GoogleGenAI } from '@/lib/geminiClient'
import type { PodcastTtsModel } from '@/features/podcasts/types'

const DATABASE_NAME = 'speakia-lexical-pronunciation'
const DATABASE_VERSION = 1
const STORE_NAME = 'pronunciations'

function openPronunciationDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support locally saved pronunciation audio.'))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open pronunciation audio storage.'))
    request.onblocked = () => reject(new Error('Pronunciation audio storage is blocked by another open Speakia tab.'))
  })
}

function pronunciationKey(term: string): string {
  return term.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

function base64ToBytes(data: string): Uint8Array {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function pcmToWav(data: Uint8Array, mimeType: string): Blob {
  const audioFormat = mimeType.split(';', 1)[0].split('/')[1]?.toUpperCase() ?? ''
  const bitsPerSample = Number(audioFormat.match(/L(\d+)/)?.[1] ?? 16)
  const sampleRate = Number(mimeType.match(/rate=(\d+)/i)?.[1] ?? 24000)
  const channels = Number(mimeType.match(/channels=(\d+)/i)?.[1] ?? 1)
  if (!Number.isFinite(bitsPerSample) || bitsPerSample <= 0 || bitsPerSample % 8 !== 0
    || !Number.isFinite(sampleRate) || sampleRate <= 0
    || !Number.isFinite(channels) || channels <= 0) {
    throw new Error(`Speakia AI returned unsupported pronunciation audio format: ${mimeType || 'unknown format'}.`)
  }

  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
  }
  const bytesPerSample = bitsPerSample / 8
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + data.byteLength, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels * bytesPerSample, true)
  view.setUint16(32, channels * bytesPerSample, true)
  view.setUint16(34, bitsPerSample, true)
  writeText(36, 'data')
  view.setUint32(40, data.byteLength, true)
  const pcm = new ArrayBuffer(data.byteLength)
  new Uint8Array(pcm).set(data)
  return new Blob([header, pcm], { type: 'audio/wav' })
}

export async function loadPronunciationAudio(term: string): Promise<Blob | null> {
  const database = await openPronunciationDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(pronunciationKey(term))
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => reject(request.error ?? new Error('Unable to read saved pronunciation audio.'))
    })
  } finally {
    database.close()
  }
}

export async function savePronunciationAudio(term: string, audio: Blob): Promise<void> {
  const database = await openPronunciationDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(audio, pronunciationKey(term))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save pronunciation audio.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving pronunciation audio was aborted.'))
    })
  } finally {
    database.close()
  }
}

export async function synthesizePronunciation(apiKey: string, term: string, example?: string): Promise<Blob> {
  if (!apiKey.trim()) throw new Error('Add your Speakia AI API key in Settings to play a generated pronunciation.')
  const normalizedTerm = term.trim()
  const normalizedExample = example?.trim()
  if (!normalizedTerm) throw new Error('There is no vocabulary term to pronounce.')

  const model: PodcastTtsModel = 'gemini-3.8-flash-lite-tts'
  const spokenText = [normalizedTerm.replace(/[.,;:!?]+$/, ''), normalizedExample]
    .filter((text): text is string => Boolean(text))
    .join('. ')
  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  try {
    const response = await client.models.generateContent({
      model,
      contents: spokenText,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fola' },
          },
        },
      },
    })
    const audioPart = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
      .find((part) => part.inlineData?.data)
    const inlineData = audioPart?.inlineData
    const audioData = inlineData?.data
    if (!audioData) throw new Error('Speakia AI returned no pronunciation audio.')
    const mimeType = inlineData.mimeType ?? 'audio/L16;rate=24000'
    const bytes = base64ToBytes(audioData)
    let audio: Blob
    if (mimeType.toLocaleLowerCase().startsWith('audio/wav')) {
      const data = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(data).set(bytes)
      audio = new Blob([data], { type: mimeType })
    } else {
      audio = pcmToWav(bytes, mimeType)
    }
    if (!audio.size) throw new Error('Speakia AI returned an empty pronunciation audio file.')
    return audio
  } catch (error) {
    console.error('Speakia AI pronunciation TTS generation failed.', error)
    throw new Error(error instanceof Error
      ? `Speakia AI could not generate this pronunciation: ${error.message}`
      : 'Speakia AI could not generate this pronunciation. Please try again.')
  }
}
