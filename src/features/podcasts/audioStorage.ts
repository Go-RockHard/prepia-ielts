const DATABASE_NAME = 'speakia-podcast-audio'
const DATABASE_VERSION = 1
const STORE_NAME = 'episodes'

function openPodcastAudioDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support saved podcast audio.'))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open podcast audio storage.'))
    request.onblocked = () => reject(new Error('Podcast audio storage is blocked by another open Speakia tab.'))
  })
}

function audioKey(podcastId: string, mode: 'recorded' | 'live'): string {
  return mode === 'recorded' ? podcastId : `${podcastId}:live`
}

export async function savePodcastAudio(podcastId: string, audio: Blob, mode: 'recorded' | 'live' = 'recorded'): Promise<void> {
  const database = await openPodcastAudioDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(audio, audioKey(podcastId, mode))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save this podcast audio.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving this podcast audio was aborted.'))
    })
  } finally {
    database.close()
  }
}

export async function loadPodcastAudio(podcastId: string, mode: 'recorded' | 'live' = 'recorded'): Promise<Blob | null> {
  const database = await openPodcastAudioDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(audioKey(podcastId, mode))
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => reject(request.error ?? new Error('Unable to read saved podcast audio.'))
    })
  } finally {
    database.close()
  }
}

export async function deletePodcastAudio(podcastId: string): Promise<void> {
  const database = await openPodcastAudioDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      store.delete(audioKey(podcastId, 'recorded'))
      store.delete(audioKey(podcastId, 'live'))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to delete this podcast audio.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Deleting this podcast audio was aborted.'))
    })
  } finally {
    database.close()
  }
}
