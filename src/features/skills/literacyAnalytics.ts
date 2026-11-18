import type { SkillAttempt } from '@/features/skills/literacyStorage'

export type AccuracyTrend = {
  recentAccuracy: number
  previousAccuracy: number
  differencePoints: number
  recentAttempts: number
  previousAttempts: number
}

function accuracy(attempts: SkillAttempt[]): number {
  const score = attempts.reduce((total, attempt) => total + attempt.score, 0)
  const possible = attempts.reduce((total, attempt) => total + attempt.total, 0)
  return possible ? Math.round(score / possible * 100) : 0
}

export function getAccuracyTrend(attempts: SkillAttempt[], windowSize = 5): AccuracyTrend | null {
  if (!Number.isInteger(windowSize) || windowSize < 1) throw new Error('Accuracy trend window size must be a positive integer.')
  const ordered = [...attempts].sort((left, right) => right.completedAt.localeCompare(left.completedAt))
  const recentAttempts = ordered.slice(0, windowSize)
  const previousAttempts = ordered.slice(windowSize, windowSize * 2)
  if (!recentAttempts.length || !previousAttempts.length) return null
  const recentAccuracy = accuracy(recentAttempts)
  const previousAccuracy = accuracy(previousAttempts)
  return {
    recentAccuracy,
    previousAccuracy,
    differencePoints: recentAccuracy - previousAccuracy,
    recentAttempts: recentAttempts.length,
    previousAttempts: previousAttempts.length,
  }
}
