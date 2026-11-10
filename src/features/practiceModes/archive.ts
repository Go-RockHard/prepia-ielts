import type { TestPart } from '@/features/simulator/types'

export interface PracticeModeArchiveTurn {
  id: string
  role: 'examiner' | 'candidate'
  text: string
  completedAt: string
  audioStartSeconds?: number
  audioDurationSeconds?: number
}

export interface PracticeModeArchiveRecord {
  id: string
  mode: string
  part: TestPart
  topic: string
  startedAt: string
  completedAt: string
  durationSeconds: number
  turns: PracticeModeArchiveTurn[]
  audioAvailable: boolean
  audioOrderVersion?: number
}

const STORAGE_KEY_PREFIX = 'speakia-practice-mode-archive-v1:'
const DATABASE_NAME = 'speakia-practice-mode-audio'
const STORE_NAME = 'recordings'

function userKey(username: string) {
  return `${STORAGE_KEY_PREFIX}${username.trim().toLocaleLowerCase()}`
}

function isRecord(value: unknown): value is PracticeModeArchiveRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Partial<PracticeModeArchiveRecord>
  return typeof record.id === 'string' && typeof record.mode === 'string'
    && (record.part === 'full' || record.part === 'part1' || record.part === 'part2' || record.part === 'part3')
    && typeof record.topic === 'string' && typeof record.startedAt === 'string'
    && typeof record.completedAt === 'string' && typeof record.durationSeconds === 'number'
    && typeof record.audioAvailable === 'boolean' && Array.isArray(record.turns)
    && record.turns.every((turn) => typeof turn.id === 'string'
      && (turn.role === 'examiner' || turn.role === 'candidate')
      && typeof turn.text === 'string' && typeof turn.completedAt === 'string')
}

export function loadPracticeModeArchive(username: string): PracticeModeArchiveRecord[] {
  try {
    const stored = localStorage.getItem(userKey(username))
    const parsed: unknown = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed.filter(isRecord).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)) : []
  } catch (error) {
    console.error('Unable to load Practice Modes archive.', error)
    return []
  }
}

export function savePracticeModeArchive(username: string, records: PracticeModeArchiveRecord[]): boolean {
  try {
    localStorage.setItem(userKey(username), JSON.stringify(records))
    return true
  } catch (error) {
    console.error('Unable to save Practice Modes archive.', error)
    return false
  }
}

function audioKey(username: string, id: string) {
  return `${username.trim().toLocaleLowerCase()}:${id}`
}

function openAudioDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('This browser does not support saved practice audio.'))
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open Practice Modes audio storage.'))
  })
}

export async function savePracticeModeAudio(username: string, id: string, audio: Blob): Promise<void> {
  const database = await openAudioDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(audio, audioKey(username, id))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save practice audio.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving practice audio was aborted.'))
    })
  } finally { database.close() }
}

export async function loadPracticeModeAudio(username: string, id: string): Promise<Blob | null> {
  const database = await openAudioDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(audioKey(username, id))
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => reject(request.error ?? new Error('Unable to load saved practice audio.'))
    })
  } finally { database.close() }
}
