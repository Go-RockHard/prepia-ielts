import type { MediaAssessment } from './assessment'

const STORAGE_KEY = 'speakia-media-assessments-v1'
const MEDIA_DATABASE_NAME = 'speakia-media-assessment-sources'
const MEDIA_DATABASE_VERSION = 1
const MEDIA_STORE_NAME = 'sources'
const criterionIds = ['fluency', 'lexical', 'grammar', 'pronunciation']

function isMediaAssessment(value: unknown): value is MediaAssessment {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<MediaAssessment>
  return typeof item.id === 'string'
    && (item.source === 'audio' || item.source === 'youtube')
    && typeof item.sourceName === 'string'
    && (item.sourceUrl === undefined || typeof item.sourceUrl === 'string')
    && (item.audioAvailable === undefined || typeof item.audioAvailable === 'boolean')
    && (item.model === 'gemini-3.8-flash' || item.model === 'gemini-3.1-pro-preview')
    && typeof item.completedAt === 'string' && Number.isFinite(Date.parse(item.completedAt))
    && typeof item.overallBand === 'number' && Number.isFinite(item.overallBand) && item.overallBand >= 0 && item.overallBand <= 9
    && Array.isArray(item.criteria) && item.criteria.length === 4
    && item.criteria.every((criterion) =>
      typeof criterion === 'object' && criterion !== null
      && typeof criterion.id === 'string' && criterionIds.includes(criterion.id)
      && typeof criterion.name === 'string'
      && typeof criterion.band === 'number' && Number.isFinite(criterion.band) && criterion.band >= 0 && criterion.band <= 9
      && typeof criterion.evidence === 'string' && typeof criterion.improvement === 'string',
    )
    && Array.isArray(item.strengths) && item.strengths.every((entry) => typeof entry === 'string')
    && Array.isArray(item.nextSteps) && item.nextSteps.every((entry) => typeof entry === 'string')
    && typeof item.transcript === 'string'
    && (item.sentenceFeedback === undefined
      || (Array.isArray(item.sentenceFeedback) && item.sentenceFeedback.every((entry) =>
        typeof entry === 'object' && entry !== null
        && typeof entry.originalSentence === 'string'
        && typeof entry.issue === 'string'
        && typeof entry.correction === 'string'
        && typeof entry.bandEightVersion === 'string'
        && typeof entry.explanation === 'string',
      )))
    && (item.cleanupWarning === undefined || typeof item.cleanupWarning === 'string')
}

function openMediaSourceDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support saving source audio for replay.'))
      return
    }
    const request = indexedDB.open(MEDIA_DATABASE_NAME, MEDIA_DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(MEDIA_STORE_NAME)) {
        request.result.createObjectStore(MEDIA_STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open media replay storage.'))
    request.onblocked = () => reject(new Error('Media replay storage is blocked by another open Speakia tab.'))
  })
}

export async function saveMediaSource(assessmentId: string, source: Blob): Promise<void> {
  const database = await openMediaSourceDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(MEDIA_STORE_NAME, 'readwrite')
      transaction.objectStore(MEDIA_STORE_NAME).put(source, assessmentId)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save the source audio for replay.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving source audio for replay was aborted.'))
    })
  } finally {
    database.close()
  }
}

export async function loadMediaSource(assessmentId: string): Promise<Blob | null> {
  const database = await openMediaSourceDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = database.transaction(MEDIA_STORE_NAME, 'readonly').objectStore(MEDIA_STORE_NAME).get(assessmentId)
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => reject(request.error ?? new Error('Unable to load the source audio for replay.'))
    })
  } finally {
    database.close()
  }
}

export function loadMediaAssessments(): MediaAssessment[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) throw new Error('Saved media assessments are not a list.')
    const valid = parsed.filter(isMediaAssessment)
    if (valid.length !== parsed.length) console.warn('Some saved media assessments were invalid and have been ignored.')
    return valid
  } catch (error) {
    console.error('Unable to load media assessments from browser storage.', error)
    return []
  }
}

export function saveMediaAssessments(assessments: MediaAssessment[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assessments))
  } catch (error) {
    console.error('Unable to save media assessments to browser storage.', error)
    throw new Error('The assessment completed, but could not be saved in this browser. Free up browser storage and try again.')
  }
}
