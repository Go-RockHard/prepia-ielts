import { State, type Card, type CardInput } from 'ts-fsrs'

export type FlashcardProduct = 'speakia' | 'writia'

export interface FlashcardProgress {
  sourceId: string
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: State
  last_review: string | null
  introducedAt?: string
  lastRating?: number
  reviewedAt?: string
}

export interface FlashcardProgressLoad {
  items: FlashcardProgress[]
  error: string
}

function storageKey(username: string, product: FlashcardProduct): string {
  return `${product}-flashcards-fsrs-v1:${username.trim().toLocaleLowerCase()}`
}

function isProgress(value: unknown): value is FlashcardProgress {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<FlashcardProgress>
  return typeof item.sourceId === 'string'
    && typeof item.due === 'string'
    && Number.isFinite(Date.parse(item.due))
    && typeof item.stability === 'number' && Number.isFinite(item.stability) && item.stability >= 0
    && typeof item.difficulty === 'number' && Number.isFinite(item.difficulty)
    && typeof item.elapsed_days === 'number' && Number.isFinite(item.elapsed_days)
    && typeof item.scheduled_days === 'number' && Number.isFinite(item.scheduled_days)
    && typeof item.learning_steps === 'number' && Number.isFinite(item.learning_steps)
    && typeof item.reps === 'number' && Number.isInteger(item.reps) && item.reps >= 0
    && typeof item.lapses === 'number' && Number.isInteger(item.lapses) && item.lapses >= 0
    && typeof item.state === 'number' && [0, 1, 2, 3].includes(item.state)
    && (item.last_review === null || (typeof item.last_review === 'string' && Number.isFinite(Date.parse(item.last_review))))
    && (item.introducedAt === undefined || (typeof item.introducedAt === 'string' && Number.isFinite(Date.parse(item.introducedAt))))
    && (item.lastRating === undefined || (typeof item.lastRating === 'number' && [1, 2, 3, 4].includes(item.lastRating)))
    && (item.reviewedAt === undefined || (typeof item.reviewedAt === 'string' && Number.isFinite(Date.parse(item.reviewedAt))))
}

export function loadFlashcardProgress(username: string, product: FlashcardProduct = 'speakia'): FlashcardProgressLoad {
  try {
    const stored = localStorage.getItem(storageKey(username, product))
    if (!stored) return { items: [], error: '' }
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) throw new Error('Saved flashcard progress is not a list.')
    const items = parsed.filter(isProgress)
    if (items.length !== parsed.length) {
      console.warn(`${parsed.length - items.length} invalid Speakia Flashcards progress record(s) were ignored.`)
    }
    return { items, error: '' }
  } catch (error) {
    console.error(`Unable to load ${product} Flashcards progress.`, error)
    return {
      items: [],
      error: error instanceof Error ? error.message : 'Your saved flashcard progress could not be loaded.',
    }
  }
}

export function saveFlashcardProgress(username: string, items: FlashcardProgress[], product: FlashcardProduct = 'speakia'): string {
  try {
    localStorage.setItem(storageKey(username, product), JSON.stringify(items))
    return ''
  } catch (error) {
    console.error(`Unable to save ${product} Flashcards progress.`, error)
    return error instanceof Error ? error.message : 'Your flashcard progress could not be saved.'
  }
}

export function toFsrsCard(progress: FlashcardProgress): CardInput {
  return {
    due: new Date(progress.due),
    stability: progress.stability,
    difficulty: progress.difficulty,
    elapsed_days: progress.elapsed_days,
    scheduled_days: progress.scheduled_days,
    learning_steps: progress.learning_steps,
    reps: progress.reps,
    lapses: progress.lapses,
    state: progress.state,
    last_review: progress.last_review ? new Date(progress.last_review) : null,
  }
}

export function fromFsrsCard(sourceId: string, card: Card, lastRating?: number, reviewedAt?: Date): FlashcardProgress {
  return {
    sourceId,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString() ?? null,
    lastRating,
    reviewedAt: reviewedAt?.toISOString(),
  }
}
