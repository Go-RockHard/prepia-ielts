import type { PracticeSet } from '@/features/skills/questionTypes'

export type SkillProduct = 'readia' | 'listenia'
export type PracticeMode = 'exam' | 'guided'
export type ContentWorkflowStage = 'topic-analysis' | 'authoring' | 'validation' | 'review' | 'audio' | 'saving' | 'completed' | 'failed'

export type LocalContentWorkflowJob = {
  id: string
  username: string
  product: SkillProduct
  status: 'running' | 'completed' | 'failed'
  stage: ContentWorkflowStage
  topic: string
  topicAngle: string
  startedAt: string
  updatedAt: string
  stageHistory: Array<{ stage: ContentWorkflowStage; status: LocalContentWorkflowJob['status']; at: string; detail?: string }>
  error?: string
}

export type SkillAttempt = {
  id: string
  username: string
  product: SkillProduct
  setId: string
  setVersion: number
  topicId: string
  title: string
  mode: PracticeMode
  score: number
  total: number
  questionTypeScores?: Record<string, { score: number; total: number }>
  elapsedSeconds: number
  answers: Record<string, string>
  completedAt: string
}

export type LocalContentPackage = {
  id: string
  product: SkillProduct
  title: string
  topicId: string
  topicFingerprint: string
  version: number
  status: 'draft' | 'published' | 'archived'
  source: 'built-in' | 'generated' | 'imported'
  exposureId?: string
  audioAssetId?: string
  qualityReview?: { model: string; reviewedAt: string; approved: boolean; findings: string[]; contentFingerprint: string }
  createdAt: string
  updatedAt: string
  set: PracticeSet
}

export type TopicExposure = {
  id: string
  username: string
  product: SkillProduct
  topicId: string
  fingerprint: string
  embedding?: number[]
  status: 'reserved' | 'published' | 'started' | 'completed' | 'released'
  updatedAt: string
}

export type LocalAudioAsset = {
  id: string
  contentId: string
  contentVersion: number
  sectionIndex: number
  mimeType: string
  byteLength: number
  createdAt: string
  audio: Blob
}

const DATABASE_NAME = 'prepia-receptive-learning'
const DATABASE_VERSION = 3
const ATTEMPTS_STORE = 'attempts'
const CONTENT_STORE = 'contentPackages'
const TOPICS_STORE = 'topicExposures'
const AUDIO_STORE = 'audioAssets'
const ACTIVE_STORE = 'activeSessions'
const JOBS_STORE = 'contentWorkflowJobs'

let databasePromise: Promise<IDBDatabase> | undefined

function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('This browser does not support local Readia and Listenia storage.'))
  }
  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(ATTEMPTS_STORE)) {
        const store = database.createObjectStore(ATTEMPTS_STORE, { keyPath: 'id' })
        store.createIndex('by-learner-skill-date', ['username', 'product', 'completedAt'])
      }
      if (!database.objectStoreNames.contains(CONTENT_STORE)) {
        const store = database.createObjectStore(CONTENT_STORE, { keyPath: 'id' })
        store.createIndex('by-skill-status', ['product', 'status'])
      }
      if (!database.objectStoreNames.contains(TOPICS_STORE)) {
        const store = database.createObjectStore(TOPICS_STORE, { keyPath: 'id' })
        store.createIndex('by-learner-skill', ['username', 'product'])
      }
      const topicStore = request.transaction?.objectStore(TOPICS_STORE)
      if (topicStore && !topicStore.indexNames.contains('by-learner')) {
        topicStore.createIndex('by-learner', 'username')
      }
      if (!database.objectStoreNames.contains(AUDIO_STORE)) {
        const store = database.createObjectStore(AUDIO_STORE, { keyPath: 'id' })
        store.createIndex('by-content-version', ['contentId', 'contentVersion'])
      }
      if (!database.objectStoreNames.contains(ACTIVE_STORE)) {
        database.createObjectStore(ACTIVE_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(JOBS_STORE)) {
        const store = database.createObjectStore(JOBS_STORE, { keyPath: 'id' })
        store.createIndex('by-learner-skill-date', ['username', 'product', 'updatedAt'])
      }
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close()
        databasePromise = undefined
      }
      resolve(request.result)
    }
    request.onerror = () => {
      databasePromise = undefined
      reject(request.error ?? new Error('Unable to open local Readia and Listenia storage.'))
    }
    request.onblocked = () => {
      databasePromise = undefined
      reject(new Error('Readia and Listenia storage is blocked by another open Prepia tab. Close older tabs and retry.'))
    }
  })

  return databasePromise
}

function transactionDone(transaction: IDBTransaction, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error(message))
    transaction.onabort = () => reject(transaction.error ?? new Error(message))
  })
}

export async function saveSkillAttempt(attempt: SkillAttempt): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(ATTEMPTS_STORE, 'readwrite')
  transaction.objectStore(ATTEMPTS_STORE).put(attempt)
  await transactionDone(transaction, 'Unable to save this practice result in browser storage.')
}

export async function saveLocalContentWorkflowJob(job: LocalContentWorkflowJob): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(JOBS_STORE, 'readwrite')
  transaction.objectStore(JOBS_STORE).put(job)
  await transactionDone(transaction, 'Unable to save the local content workflow status.')
}

export async function loadLocalContentWorkflowJobs(username: string, product: SkillProduct): Promise<LocalContentWorkflowJob[]> {
  const database = await openDatabase()
  const transaction = database.transaction(JOBS_STORE, 'readwrite')
  const done = transactionDone(transaction, 'Unable to load local content workflow history.')
  void done.catch(() => undefined)
  const index = transaction.objectStore(JOBS_STORE).index('by-learner-skill-date')
  const jobs = await new Promise<LocalContentWorkflowJob[]>((resolve, reject) => {
    const normalizedUsername = username.trim().toLocaleLowerCase()
    const request = index.getAll(IDBKeyRange.bound([normalizedUsername, product, ''], [normalizedUsername, product, '\uffff']))
    request.onsuccess = () => {
      const staleAt = Date.now() - 12 * 60 * 60 * 1000
      const records = (request.result as LocalContentWorkflowJob[]).map((job) => {
        if (job.status !== 'running' || Date.parse(job.updatedAt) >= staleAt) return job
        const updatedAt = new Date().toISOString()
        const staleJob: LocalContentWorkflowJob = {
          ...job,
          status: 'failed',
          stage: 'failed',
          error: 'This generation stopped before it could finish. Start a new draft to retry.',
          updatedAt,
          stageHistory: [...(job.stageHistory ?? []), { stage: 'failed', status: 'failed', at: updatedAt }],
        }
        transaction.objectStore(JOBS_STORE).put(staleJob)
        return staleJob
      })
      resolve(records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)))
    }
    request.onerror = () => reject(request.error ?? new Error('Unable to load local content workflow history.'))
  })
  await done
  return jobs
}

export async function loadSkillAttempts(username: string, product: SkillProduct): Promise<SkillAttempt[]> {
  const database = await openDatabase()
  const transaction = database.transaction(ATTEMPTS_STORE, 'readonly')
  const index = transaction.objectStore(ATTEMPTS_STORE).index('by-learner-skill-date')
  const records = await new Promise<SkillAttempt[]>((resolve, reject) => {
    const request = index.getAll(IDBKeyRange.bound([username.trim().toLocaleLowerCase(), product, ''], [username.trim().toLocaleLowerCase(), product, '\uffff']))
    request.onsuccess = () => resolve(request.result as SkillAttempt[])
    request.onerror = () => reject(request.error ?? new Error('Unable to load local practice history.'))
  })
  if (!records.length) {
    const legacyKey = `prodia-literacy-attempts-v1:${product}:${username.trim().toLocaleLowerCase()}`
    try {
      const saved = window.localStorage.getItem(legacyKey)
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (!Array.isArray(parsed)) throw new Error('Legacy practice history is not a list.')
        const migrated = parsed.filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null)
          .filter((record) => typeof record.id === 'string' && typeof record.setId === 'string' && typeof record.title === 'string'
            && typeof record.score === 'number' && typeof record.total === 'number' && typeof record.completedAt === 'string')
          .map((record): SkillAttempt => ({
            id: record.id as string,
            username: username.trim().toLocaleLowerCase(),
            product,
            setId: record.setId as string,
            setVersion: 1,
            topicId: record.setId as string,
            title: record.title as string,
            mode: 'exam',
            score: record.score as number,
            total: record.total as number,
            elapsedSeconds: 0,
            answers: {},
            completedAt: record.completedAt as string,
          }))
        for (const attempt of migrated) await saveSkillAttempt(attempt)
        window.localStorage.removeItem(legacyKey)
        return migrated.sort((left, right) => right.completedAt.localeCompare(left.completedAt))
      }
    } catch (error) {
      console.error(`Unable to migrate ${product} practice history into IndexedDB.`, error)
      throw new Error('Your saved practice history could not be migrated. It remains in this browser; retry after checking available storage.')
    }
  }
  return records.sort((left, right) => right.completedAt.localeCompare(left.completedAt))
}

export async function saveLocalContentPackage(content: LocalContentPackage): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(CONTENT_STORE, 'readwrite')
  transaction.objectStore(CONTENT_STORE).put(content)
  await transactionDone(transaction, 'Unable to save this content package in browser storage.')
}

export async function savePublishedContentPackage(content: LocalContentPackage): Promise<void> {
  if (content.status !== 'published' || !content.qualityReview?.approved || !content.qualityReview.contentFingerprint) {
    throw new Error('Only independently reviewed drafts can be published.')
  }
  const database = await openDatabase()
  const transaction = database.transaction([CONTENT_STORE, TOPICS_STORE], 'readwrite')
  const done = transactionDone(transaction, 'Unable to publish this local content package.')
  void done.catch(() => undefined)
  const exposureId = content.exposureId
  if (exposureId) {
    const store = transaction.objectStore(TOPICS_STORE)
    const exposure = await new Promise<TopicExposure | undefined>((resolve, reject) => {
      const request = store.get(exposureId)
      request.onsuccess = () => resolve(request.result as TopicExposure | undefined)
      request.onerror = () => reject(request.error ?? new Error('Unable to verify this package topic reservation.'))
    })
    if (!exposure) {
      transaction.abort()
      await done.catch(() => undefined)
      throw new Error('This package’s local topic reservation is missing; it cannot be published.')
    }
    store.put({ ...exposure, status: 'published', updatedAt: new Date().toISOString() })
  }
  transaction.objectStore(CONTENT_STORE).put(content)
  await done
}

export async function createLocalContentVersion(content: LocalContentPackage): Promise<LocalContentPackage> {
  const database = await openDatabase()
  const version = content.version + 1
  const id = `${content.product}:${crypto.randomUUID()}:v${version}`
  const sourceAudioAssetId = content.audioAssetId
  const audioAssetId = sourceAudioAssetId ? `${id}:audio:0` : undefined
  const next: LocalContentPackage = {
    ...content,
    id,
    version,
    status: 'draft',
    updatedAt: new Date().toISOString(),
    set: { ...content.set, id: crypto.randomUUID(), ...(audioAssetId ? { audioAssetId } : {}) },
    ...(audioAssetId ? { audioAssetId } : {}),
  }
  const transaction = database.transaction([CONTENT_STORE, AUDIO_STORE], 'readwrite')
  const done = transactionDone(transaction, 'Unable to create a new local content version.')
  void done.catch(() => undefined)
  if (sourceAudioAssetId && audioAssetId) {
    const source = await new Promise<LocalAudioAsset | undefined>((resolve, reject) => {
      const request = transaction.objectStore(AUDIO_STORE).get(sourceAudioAssetId)
      request.onsuccess = () => resolve(request.result as LocalAudioAsset | undefined)
      request.onerror = () => reject(request.error ?? new Error('Unable to load the previous version’s audio.'))
    })
    if (!source) {
      transaction.abort()
      await done.catch(() => undefined)
      throw new Error('The previous listening recording is missing; a new version cannot be created.')
    }
    transaction.objectStore(AUDIO_STORE).put({
      ...source,
      id: audioAssetId,
      contentId: id,
      contentVersion: version,
      createdAt: new Date().toISOString(),
    })
  }
  transaction.objectStore(CONTENT_STORE).put(next)
  await done
  return next
}

export async function archiveLocalContentPackage(content: LocalContentPackage): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction([CONTENT_STORE, TOPICS_STORE], 'readwrite')
  const done = transactionDone(transaction, 'Unable to archive this local content package.')
  void done.catch(() => undefined)
  const exposureId = content.exposureId
  if (content.status === 'draft' && exposureId) {
    const store = transaction.objectStore(TOPICS_STORE)
    const exposure = await new Promise<TopicExposure | undefined>((resolve, reject) => {
      const request = store.get(exposureId)
      request.onsuccess = () => resolve(request.result as TopicExposure | undefined)
      request.onerror = () => reject(request.error ?? new Error('Unable to check this package’s topic reservation.'))
    })
    if (exposure?.status === 'reserved') store.put({ ...exposure, status: 'released', updatedAt: new Date().toISOString() })
  }
  transaction.objectStore(CONTENT_STORE).put({ ...content, status: 'archived', updatedAt: new Date().toISOString() })
  await done
}

export async function deleteLocalAudioAsset(id: string): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(AUDIO_STORE, 'readwrite')
  transaction.objectStore(AUDIO_STORE).delete(id)
  await transactionDone(transaction, 'Unable to remove the local listening audio asset.')
}

export async function loadLocalContentPackages(product: SkillProduct, includeArchived = false): Promise<LocalContentPackage[]> {
  const database = await openDatabase()
  const transaction = database.transaction(CONTENT_STORE, 'readonly')
  const records = await new Promise<LocalContentPackage[]>((resolve, reject) => {
    const request = transaction.objectStore(CONTENT_STORE).index('by-skill-status').getAll(IDBKeyRange.bound([product, ''], [product, '\uffff']))
    request.onsuccess = () => resolve(request.result as LocalContentPackage[])
    request.onerror = () => reject(request.error ?? new Error('Unable to load local content packages.'))
  })
  return records.filter((record) => includeArchived || record.status !== 'archived').sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function saveLocalAudioAsset(asset: LocalAudioAsset): Promise<void> {
  const estimate = await getLocalStorageEstimate()
  if (estimate?.quota !== undefined && estimate.usage !== undefined) {
    const remaining = Math.max(0, estimate.quota - estimate.usage)
    if (asset.byteLength > remaining * 0.9) {
      throw new Error('There is not enough browser storage for this listening recording. Free local storage and retry; no incomplete package was saved.')
    }
  }
  const database = await openDatabase()
  const transaction = database.transaction(AUDIO_STORE, 'readwrite')
  transaction.objectStore(AUDIO_STORE).put(asset)
  await transactionDone(transaction, 'Unable to save generated listening audio in browser storage.')
}

export async function loadLocalAudioAsset(id: string): Promise<LocalAudioAsset | null> {
  const database = await openDatabase()
  const transaction = database.transaction(AUDIO_STORE, 'readonly')
  return new Promise((resolve, reject) => {
    const request = transaction.objectStore(AUDIO_STORE).get(id)
    request.onsuccess = () => resolve((request.result as LocalAudioAsset | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('Unable to load saved listening audio.'))
  })
}

function normalizedFingerprint(value: string): string {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function wordSet(value: string): Set<string> {
  const ignored = new Set(['about', 'after', 'among', 'around', 'because', 'from', 'into', 'over', 'their', 'there', 'these', 'those', 'through', 'under', 'using', 'with'])
  return new Set(normalizedFingerprint(value).split(' ').filter((word) => word.length > 3 && !ignored.has(word)))
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0
  let dot = 0
  let leftLength = 0
  let rightLength = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftLength += left[index] ** 2
    rightLength += right[index] ** 2
  }
  return leftLength && rightLength ? dot / (Math.sqrt(leftLength) * Math.sqrt(rightLength)) : 0
}

function overlapsTopic(candidate: TopicExposure, requested: TopicExposure): boolean {
  const candidateFingerprint = normalizedFingerprint(candidate.fingerprint)
  const requestedFingerprint = normalizedFingerprint(requested.fingerprint)
  if (candidate.topicId === requested.topicId || candidateFingerprint === requestedFingerprint) return true
  if (candidate.embedding && requested.embedding && cosineSimilarity(candidate.embedding, requested.embedding) >= 0.84) return true
  const candidateWords = wordSet(candidateFingerprint)
  const requestedWords = wordSet(requestedFingerprint)
  if (!candidateWords.size || !requestedWords.size) return false
  const intersection = [...candidateWords].filter((word) => requestedWords.has(word)).length
  return intersection / new Set([...candidateWords, ...requestedWords]).size >= 0.72
}

export async function reserveLocalTopic(input: Omit<TopicExposure, 'id' | 'status' | 'updatedAt'>): Promise<TopicExposure> {
  const database = await openDatabase()
  const transaction = database.transaction(TOPICS_STORE, 'readwrite')
  const store = transaction.objectStore(TOPICS_STORE)
  const username = input.username.trim().toLocaleLowerCase()
  const existing = await new Promise<TopicExposure[]>((resolve, reject) => {
    const request = store.index('by-learner').getAll(username)
    request.onsuccess = () => resolve(request.result as TopicExposure[])
    request.onerror = () => reject(request.error ?? new Error('Unable to check local topic history.'))
  })
  const reservationExpiry = Date.now() - 12 * 60 * 60 * 1000
  const activeHistory = existing.filter((record) => {
    if (record.status !== 'reserved' || Date.parse(record.updatedAt) >= reservationExpiry) return true
    store.put({ ...record, status: 'released', updatedAt: new Date().toISOString() })
    return false
  })
  if (activeHistory.some((record) => record.status !== 'released' && overlapsTopic(record, input as TopicExposure))) {
    transaction.abort()
    throw new Error('This topic or a closely related topic has already been used in this learner’s local reading or listening practice history. Choose a different topic.')
  }
  const reservation: TopicExposure = {
    ...input,
    username,
    id: `${username}:${input.product}:${crypto.randomUUID()}`,
    status: 'reserved',
    updatedAt: new Date().toISOString(),
  }
  store.add(reservation)
  await transactionDone(transaction, 'Unable to reserve this topic in local storage.')
  return reservation
}

export async function isLocalTopicUsed(username: string, fingerprint: string): Promise<boolean> {
  const database = await openDatabase()
  const transaction = database.transaction(TOPICS_STORE, 'readonly')
  const existing = await new Promise<TopicExposure[]>((resolve, reject) => {
    const request = transaction.objectStore(TOPICS_STORE).index('by-learner').getAll(username.trim().toLocaleLowerCase())
    request.onsuccess = () => resolve(request.result as TopicExposure[])
    request.onerror = () => reject(request.error ?? new Error('Unable to check local topic history.'))
  })
  const candidate: TopicExposure = {
    id: 'candidate',
    username: username.trim().toLocaleLowerCase(),
    product: 'readia',
    topicId: 'new-candidate',
    fingerprint: normalizedFingerprint(fingerprint),
    status: 'reserved',
    updatedAt: new Date().toISOString(),
  }
  return existing.some((record) => record.status !== 'released' && overlapsTopic(record, candidate))
}

export async function updateLocalTopicExposure(id: string, status: TopicExposure['status']): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(TOPICS_STORE, 'readwrite')
  const store = transaction.objectStore(TOPICS_STORE)
  const current = await new Promise<TopicExposure | undefined>((resolve, reject) => {
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result as TopicExposure | undefined)
    request.onerror = () => reject(request.error ?? new Error('Unable to update topic history.'))
  })
  if (!current) {
    transaction.abort()
    throw new Error('The local topic reservation could not be found.')
  }
  store.put({ ...current, status, updatedAt: new Date().toISOString() })
  await transactionDone(transaction, 'Unable to update local topic history.')
}

export async function saveActiveSkillSession(id: string, state: unknown): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(ACTIVE_STORE, 'readwrite')
  transaction.objectStore(ACTIVE_STORE).put({ id, state, updatedAt: new Date().toISOString() })
  await transactionDone(transaction, 'Unable to save this active practice session.')
}

export async function loadActiveSkillSession<T>(id: string): Promise<T | null> {
  const database = await openDatabase()
  const transaction = database.transaction(ACTIVE_STORE, 'readonly')
  return new Promise((resolve, reject) => {
    const request = transaction.objectStore(ACTIVE_STORE).get(id)
    request.onsuccess = () => resolve((request.result as { state: T } | undefined)?.state ?? null)
    request.onerror = () => reject(request.error ?? new Error('Unable to restore the active practice session.'))
  })
}

export async function deleteActiveSkillSession(id: string): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(ACTIVE_STORE, 'readwrite')
  transaction.objectStore(ACTIVE_STORE).delete(id)
  await transactionDone(transaction, 'Unable to clear the completed practice session.')
}

export async function getLocalStorageEstimate(): Promise<StorageEstimate | null> {
  if (!navigator.storage?.estimate) return null
  return navigator.storage.estimate()
}
