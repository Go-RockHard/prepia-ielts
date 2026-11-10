import { isPlacementAssessment, type PlacementAssessment } from '@/features/placement/types'

const DATABASE_NAME = 'speakia-user-database'
const DATABASE_VERSION = 1
const ACCOUNT_STORE = 'accounts'
const PROFILE_STORE = 'profiles'
const SESSION_KEY = 'speakia-local-session'
const REMEMBERED_USERNAME_KEY = 'prodia-remembered-username'

export interface UserProfile {
  username: string
  displayName: string
  testDate: string
  speakingTestDate: string
  writingTestDate: string
  targetBand: string
  speakingTargetBand: string
  writingTargetBand: string
  testType: 'Academic' | 'General Training'
  location: string
  firstLanguage: string
  studyGoal: string
  speakingStudyGoal: string
  writingStudyGoal: string
  speakingPlacementAssessment?: PlacementAssessment
  writingPlacementAssessment?: PlacementAssessment
}

interface LocalAccount {
  username: string
  salt: string
  passwordHash: string
  createdAt: string
}

function openUserDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support local account storage.'))
      return
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(ACCOUNT_STORE)) {
        database.createObjectStore(ACCOUNT_STORE, { keyPath: 'username' })
      }
      if (!database.objectStoreNames.contains(PROFILE_STORE)) {
        database.createObjectStore(PROFILE_STORE, { keyPath: 'username' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open local account storage.'))
    request.onblocked = () => reject(new Error('Local account storage is blocked by another open Speakia tab.'))
  })
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

async function derivePasswordHash(password: string, salt: Uint8Array): Promise<string> {
  if (!crypto.subtle) {
    throw new Error('Secure password hashing is not available. Open Speakia on localhost or HTTPS.')
  }
  const saltBuffer = new ArrayBuffer(salt.byteLength)
  new Uint8Array(saltBuffer).set(salt)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuffer, iterations: 310000, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return bytesToHex(new Uint8Array(hash))
}

async function readAccount(username: string): Promise<LocalAccount | null> {
  const database = await openUserDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(ACCOUNT_STORE, 'readonly').objectStore(ACCOUNT_STORE).get(username)
      request.onsuccess = () => resolve((request.result as LocalAccount | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('Unable to read the local account.'))
    })
  } finally {
    database.close()
  }
}

export async function createLocalAccount(usernameInput: string, password: string): Promise<UserProfile> {
  const username = usernameInput.trim().toLocaleLowerCase()
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error('Username must be 3–32 characters using letters, numbers, dots, underscores, or hyphens.')
  }
  if (!password) throw new Error('Choose a password for your local account.')
  if (await readAccount(username)) throw new Error('That username already has a local account. Sign in instead.')

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const account: LocalAccount = {
    username,
    salt: bytesToHex(salt),
    passwordHash: await derivePasswordHash(password, salt),
    createdAt: new Date().toISOString(),
  }
  const profile: UserProfile = {
    username,
    displayName: username,
    testDate: '',
    speakingTestDate: '',
    writingTestDate: '',
    targetBand: '',
    speakingTargetBand: '',
    writingTargetBand: '',
    testType: 'Academic',
    location: '',
    firstLanguage: '',
    studyGoal: '',
    speakingStudyGoal: '',
    writingStudyGoal: '',
  }
  const database = await openUserDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([ACCOUNT_STORE, PROFILE_STORE], 'readwrite')
      transaction.objectStore(ACCOUNT_STORE).add(account)
      transaction.objectStore(PROFILE_STORE).add(profile)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to create the local account.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Creating the local account was aborted.'))
    })
  } finally {
    database.close()
  }
  return profile
}

export async function authenticateLocalAccount(usernameInput: string, password: string): Promise<UserProfile> {
  const username = usernameInput.trim().toLocaleLowerCase()
  const account = await readAccount(username)
  if (!account) throw new Error('No local account was found for that username. Create an account first.')
  const actualHash = await derivePasswordHash(password, hexToBytes(account.salt))
  const expectedBytes = hexToBytes(account.passwordHash)
  const actualBytes = hexToBytes(actualHash)
  let mismatch = expectedBytes.length ^ actualBytes.length
  for (let index = 0; index < Math.min(expectedBytes.length, actualBytes.length); index += 1) {
    mismatch |= expectedBytes[index] ^ actualBytes[index]
  }
  if (mismatch !== 0) throw new Error('Incorrect username or password.')
  const profile = await loadUserProfile(username)
  if (!profile) throw new Error('The local account exists but its profile could not be loaded.')
  return profile
}

export async function loadUserProfile(username: string): Promise<UserProfile | null> {
  const database = await openUserDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(PROFILE_STORE, 'readonly').objectStore(PROFILE_STORE).get(username)
      request.onsuccess = () => {
        const stored = request.result as Partial<UserProfile> | undefined
        if (!stored) {
          resolve(null)
          return
        }
        const speakingTestDate = stored.speakingTestDate ?? stored.testDate ?? ''
        const speakingTargetBand = stored.speakingTargetBand ?? stored.targetBand ?? ''
        const speakingStudyGoal = stored.speakingStudyGoal ?? stored.studyGoal ?? ''
        resolve({
          username: stored.username ?? username,
          displayName: stored.displayName ?? username,
          testDate: speakingTestDate,
          speakingTestDate,
          writingTestDate: stored.writingTestDate ?? stored.testDate ?? '',
          targetBand: speakingTargetBand,
          speakingTargetBand,
          writingTargetBand: stored.writingTargetBand ?? '',
          testType: stored.testType === 'General Training' ? 'General Training' : 'Academic',
          location: stored.location ?? '',
          firstLanguage: stored.firstLanguage ?? '',
          studyGoal: speakingStudyGoal,
          speakingStudyGoal,
          writingStudyGoal: stored.writingStudyGoal ?? '',
          speakingPlacementAssessment: isPlacementAssessment(stored.speakingPlacementAssessment) && stored.speakingPlacementAssessment.skill === 'speaking' ? stored.speakingPlacementAssessment : undefined,
          writingPlacementAssessment: isPlacementAssessment(stored.writingPlacementAssessment) && stored.writingPlacementAssessment.skill === 'writing' ? stored.writingPlacementAssessment : undefined,
        })
      }
      request.onerror = () => reject(request.error ?? new Error('Unable to load the local profile.'))
    })
  } finally {
    database.close()
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const normalizedProfile: UserProfile = {
    ...profile,
    testDate: profile.speakingTestDate,
    targetBand: profile.speakingTargetBand,
    studyGoal: profile.speakingStudyGoal,
  }
  const database = await openUserDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PROFILE_STORE, 'readwrite')
      transaction.objectStore(PROFILE_STORE).put(normalizedProfile)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save the local profile.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving the local profile was aborted.'))
    })
  } finally {
    database.close()
  }
}

export function saveLocalSession(username: string, rememberMe = false): void {
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(SESSION_KEY)
  if (rememberMe) {
    localStorage.setItem(SESSION_KEY, username)
    localStorage.setItem(REMEMBERED_USERNAME_KEY, username)
  } else {
    sessionStorage.setItem(SESSION_KEY, username)
    localStorage.removeItem(REMEMBERED_USERNAME_KEY)
  }
}

export function readLocalSession(): string {
  return localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY) ?? ''
}

export function readRememberedUsername(): string {
  try {
    return localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? ''
  } catch (error) {
    console.error('Unable to read the remembered Prodia username.', error)
    return ''
  }
}

export function clearLocalSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(SESSION_KEY)
}
