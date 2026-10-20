export const API_KEY_STORAGE_KEY = 'speakia-gemini-prototype-key'

const databaseName = 'speakia-browser-settings'
const databaseVersion = 1
const storeName = 'settings'
const apiKeyRecordKey = 'gemini-api-key'

function openSettingsDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('This browser does not support secure browser-database storage.'))
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open browser settings storage.'))
    request.onblocked = () => reject(new Error('Browser settings storage is blocked by another open Speakia tab.'))
  })
}

export async function readGeminiApiKey(): Promise<string> {
  const database = await openSettingsDatabase()
  try {
    const savedKey = await new Promise<string>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly')
      const request = transaction.objectStore(storeName).get(apiKeyRecordKey)
      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : '')
      request.onerror = () => reject(request.error ?? new Error('Unable to read the saved Gemini API key.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Reading browser settings was interrupted.'))
    })
    if (savedKey) return savedKey

    const legacyKey = window.sessionStorage.getItem(API_KEY_STORAGE_KEY)?.trim() ?? ''
    if (legacyKey) {
      await writeGeminiApiKey(legacyKey)
      window.sessionStorage.removeItem(API_KEY_STORAGE_KEY)
    }
    return legacyKey
  } finally {
    database.close()
  }
}

export async function writeGeminiApiKey(value: string): Promise<void> {
  const database = await openSettingsDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const normalizedKey = value.trim()
      if (normalizedKey) store.put(normalizedKey, apiKeyRecordKey)
      else store.delete(apiKeyRecordKey)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save the Gemini API key.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving browser settings was interrupted.'))
    })
    window.sessionStorage.removeItem(API_KEY_STORAGE_KEY)
  } finally {
    database.close()
  }
}
