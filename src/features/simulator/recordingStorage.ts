import type { TranscriptEntry } from './types'
import type { InteractiveLesson } from '@/features/assistant/interactiveLesson'

const DATABASE_NAME = 'speakia-recordings'
const DATABASE_VERSION = 2
const STORE_NAME = 'recordings'
const ASSESSMENT_LESSON_STORE = 'assessment-lessons'

function openRecordingDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support local audio recording storage.'))
      return
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
      if (!database.objectStoreNames.contains(ASSESSMENT_LESSON_STORE)) {
        database.createObjectStore(ASSESSMENT_LESSON_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open local audio storage.'))
    request.onblocked = () => reject(new Error('Local audio storage is blocked by another open Speakia tab.'))
  })
}

export async function saveAssessmentLesson(testId: string, lesson: InteractiveLesson): Promise<void> {
  const database = await openRecordingDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(ASSESSMENT_LESSON_STORE, 'readwrite')
      transaction.objectStore(ASSESSMENT_LESSON_STORE).put(lesson, testId)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save the personalized assessment lesson.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving the personalized assessment lesson was aborted.'))
    })
  } finally {
    database.close()
  }
}

export async function loadAssessmentLesson(testId: string): Promise<InteractiveLesson | null> {
  const database = await openRecordingDatabase()
  try {
    return await new Promise<InteractiveLesson | null>((resolve, reject) => {
      const transaction = database.transaction(ASSESSMENT_LESSON_STORE, 'readonly')
      const request = transaction.objectStore(ASSESSMENT_LESSON_STORE).get(testId)
      request.onsuccess = () => {
        const lesson: unknown = request.result
        if (typeof lesson !== 'object' || lesson === null || Array.isArray(lesson)) {
          resolve(null)
          return
        }
        const candidate = lesson as Partial<InteractiveLesson>
        resolve(
          typeof candidate.id === 'string'
          && typeof candidate.title === 'string'
          && typeof candidate.topic === 'string'
          && typeof candidate.summary === 'string'
          && typeof candidate.html === 'string'
          && candidate.html.length <= 100_000
          && Array.isArray(candidate.interactions)
          && candidate.interactions.every((interaction) => typeof interaction === 'string')
            ? candidate as InteractiveLesson
            : null,
        )
      }
      request.onerror = () => reject(request.error ?? new Error('Unable to read the personalized assessment lesson.'))
    })
  } finally {
    database.close()
  }
}

export async function saveTestRecording(testId: string, recording: Blob): Promise<void> {
  const database = await openRecordingDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(recording, testId)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save this test recording.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving this test recording was aborted.'))
    })
  } finally {
    database.close()
  }
}

export async function loadTestRecording(testId: string): Promise<Blob | null> {
  const database = await openRecordingDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(testId)
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => reject(request.error ?? new Error('Unable to read this test recording.'))
    })
  } finally {
    database.close()
  }
}

export async function saveConversationAudioCopy(testId: string, audioCopy: Blob): Promise<void> {
  const database = await openRecordingDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(audioCopy, `copy:${testId}`)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save the compiled conversation audio.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving the compiled conversation audio was aborted.'))
    })
  } finally {
    database.close()
  }
}

export async function loadConversationAudioCopy(testId: string): Promise<Blob | null> {
  const database = await openRecordingDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(`copy:${testId}`)
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => reject(request.error ?? new Error('Unable to read the compiled conversation audio.'))
    })
  } finally {
    database.close()
  }
}

export async function saveTranscriptAudio(
  testId: string,
  turns: TranscriptEntry[],
): Promise<void> {
  const audioTurns = turns.filter(
    (turn): turn is TranscriptEntry & { id: string; audio: Blob } => Boolean(turn.id && turn.audio),
  )
  if (audioTurns.length === 0) return

  const database = await openRecordingDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const recordings = transaction.objectStore(STORE_NAME)
      for (const turn of audioTurns) {
        recordings.put(turn.audio, `turn:${testId}:${turn.id}`)
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save transcript turn audio.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving transcript turn audio was aborted.'))
    })
  } finally {
    database.close()
  }
}

export async function loadTranscriptAudio(testId: string, turnId: string): Promise<Blob | null> {
  const database = await openRecordingDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(`turn:${testId}:${turnId}`)
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => reject(request.error ?? new Error('Unable to read transcript turn audio.'))
    })
  } finally {
    database.close()
  }
}
