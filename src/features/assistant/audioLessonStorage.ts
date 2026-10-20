const DATABASE_NAME = 'speakia-coach-audio-lessons'
const DATABASE_VERSION = 1
const STORE_NAME = 'lessons'

function openAudioLessonDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support saved Coach audio lessons.'))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open Coach audio lesson storage.'))
    request.onblocked = () => reject(new Error('Audio lesson storage is blocked by another open Speakia tab.'))
  })
}

export async function saveAudioLessonAudio(lessonId: string, audio: Blob): Promise<void> {
  const database = await openAudioLessonDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(audio, lessonId)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save this audio lesson.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving this audio lesson was aborted.'))
    })
  } finally {
    database.close()
  }
}

export async function loadAudioLessonAudio(lessonId: string): Promise<Blob | null> {
  const database = await openAudioLessonDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(lessonId)
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => reject(request.error ?? new Error('Unable to read the saved audio lesson.'))
    })
  } finally {
    database.close()
  }
}
