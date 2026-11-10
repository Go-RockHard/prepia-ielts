import { fsrs, State } from 'ts-fsrs'
import { toFsrsCard, type FlashcardProgress } from './storage'

const scheduler = fsrs({
  request_retention: 0.9,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
})

export type MemoryStrengthLevel = 'new' | 'weak' | 'building' | 'steady' | 'strong' | 'mastered'

export interface VocabularyMemory {
  level: MemoryStrengthLevel
  score: number
  label: string
  reviewed: boolean
}

const levelLabels: Record<MemoryStrengthLevel, string> = {
  new: 'Not studied',
  weak: 'Needs practice',
  building: 'Building recall',
  steady: 'Getting stronger',
  strong: 'Strong memory',
  mastered: 'Long-term memory',
}

export function vocabularyMemory(progress: FlashcardProgress | undefined, now = new Date()): VocabularyMemory {
  if (!progress) return { level: 'new', score: 0, label: levelLabels.new, reviewed: false }

  const retrievability = scheduler.get_retrievability(toFsrsCard(progress), now, false)
  const ratingCeiling: Record<number, number> = { 1: 0.34, 2: 0.68, 3: 0.86, 4: 1 }
  const ratingLimit = progress.lastRating === undefined ? 0.78 : ratingCeiling[progress.lastRating] ?? 0.78
  const score = Math.max(0, Math.min(retrievability, ratingLimit))
  const level: MemoryStrengthLevel = score < 0.4
    ? 'weak'
    : score < 0.62
      ? 'building'
      : score < 0.78
        ? 'steady'
        : score < 0.93 || progress.reps < 3 || progress.state !== State.Review
          ? 'strong'
          : 'mastered'

  return { level, score, label: levelLabels[level], reviewed: true }
}
