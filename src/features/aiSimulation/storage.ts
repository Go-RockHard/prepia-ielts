import type { AiSimulationPart, AiSimulationRecord, AiSimulationStatus, AiSimulationTurn } from './types'

const STORAGE_KEY_PREFIX = 'speakia-ai-simulations-v1:'
const DATABASE_NAME = 'speakia-ai-simulation-audio'
const DATABASE_VERSION = 1
const STORE_NAME = 'recordings'
const validParts: AiSimulationPart[] = ['part1', 'part2', 'part3', 'full']

function userKey(username: string): string {
  return `${STORAGE_KEY_PREFIX}${username.trim().toLocaleLowerCase()}`
}

function isTurn(value: unknown): value is AiSimulationTurn {
  return typeof value === 'object' && value !== null
    && typeof (value as AiSimulationTurn).id === 'string'
    && ((value as AiSimulationTurn).role === 'examiner' || (value as AiSimulationTurn).role === 'candidate')
    && typeof (value as AiSimulationTurn).text === 'string'
    && typeof (value as AiSimulationTurn).completedAt === 'string'
}

function isSimulation(value: unknown): value is AiSimulationRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Partial<AiSimulationRecord>
  return typeof record.id === 'string'
    && typeof record.part === 'string' && validParts.includes(record.part as AiSimulationPart)
    && typeof record.topic === 'string'
    && typeof record.startedAt === 'string' && Number.isFinite(Date.parse(record.startedAt))
    && typeof record.completedAt === 'string' && Number.isFinite(Date.parse(record.completedAt))
    && typeof record.durationSeconds === 'number' && Number.isFinite(record.durationSeconds) && record.durationSeconds >= 0
    && (record.status === 'completed' || record.status === 'stopped')
    && Array.isArray(record.turns) && record.turns.every(isTurn)
    && typeof record.audioAvailable === 'boolean'
    && typeof record.model === 'string'
}

export function loadAiSimulations(username: string): AiSimulationRecord[] {
  try {
    const stored = localStorage.getItem(userKey(username))
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) throw new Error('Saved AI simulation history is not a list.')
    return parsed.filter(isSimulation).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
  } catch (error) {
    console.error('Unable to load AI-to-AI simulation history.', error)
    return []
  }
}

export function saveAiSimulations(username: string, records: AiSimulationRecord[]): boolean {
  try {
    localStorage.setItem(userKey(username), JSON.stringify(records))
    return true
  } catch (error) {
    console.error('Unable to save AI-to-AI simulation history.', error)
    return false
  }
}

function audioKey(username: string, simulationId: string): string {
  return `${username.trim().toLocaleLowerCase()}:${simulationId}`
}

function openAudioDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support saved simulation audio.'))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open AI simulation audio storage.'))
    request.onblocked = () => reject(new Error('AI simulation audio storage is blocked by another open Speakia tab.'))
  })
}

export async function saveAiSimulationAudio(username: string, simulationId: string, audio: Blob): Promise<void> {
  const database = await openAudioDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(audio, audioKey(username, simulationId))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save simulation audio.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving simulation audio was aborted.'))
    })
  } finally {
    database.close()
  }
}

export async function loadAiSimulationAudio(username: string, simulationId: string): Promise<Blob | null> {
  const database = await openAudioDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(audioKey(username, simulationId))
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => reject(request.error ?? new Error('Unable to load saved simulation audio.'))
    })
  } finally {
    database.close()
  }
}

export function simulationStatusLabel(status: AiSimulationStatus): string {
  return status === 'completed' ? 'Completed' : 'Stopped early'
}
