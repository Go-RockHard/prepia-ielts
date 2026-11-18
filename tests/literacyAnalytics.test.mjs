import assert from 'node:assert/strict'
import test from 'node:test'
import { getAccuracyTrend } from '../src/features/skills/literacyAnalytics.ts'

function attempt(day, score, total) {
  return {
    id: `attempt-${day}`,
    username: 'learner',
    product: 'readia',
    setId: `set-${day}`,
    setVersion: 1,
    topicId: `topic-${day}`,
    title: `Practice ${day}`,
    mode: 'exam',
    score,
    total,
    elapsedSeconds: 300,
    answers: {},
    completedAt: `2026-11-${String(day).padStart(2, '0')}T12:00:00.000Z`,
  }
}

test('accuracy trend compares recent and prior attempts by marks', () => {
  const attempts = [
    attempt(1, 0, 2),
    attempt(2, 1, 1),
    attempt(3, 0, 1),
    attempt(4, 1, 1),
    attempt(5, 0, 1),
    attempt(6, 1, 1),
  ]

  assert.deepEqual(getAccuracyTrend(attempts), {
    recentAccuracy: 60,
    previousAccuracy: 0,
    differencePoints: 60,
    recentAttempts: 5,
    previousAttempts: 1,
  })
  assert.equal(attempts[0].completedAt, '2026-11-01T12:00:00.000Z')
})

test('accuracy trend is unavailable until both comparison windows have data', () => {
  assert.equal(getAccuracyTrend([attempt(1, 1, 1)]), null)
  assert.equal(getAccuracyTrend(Array.from({ length: 5 }, (_, index) => attempt(index + 1, 1, 1))), null)
})

test('accuracy trend rejects an invalid window size', () => {
  assert.throws(() => getAccuracyTrend([], 0), /positive integer/)
  assert.throws(() => getAccuracyTrend([], 1.5), /positive integer/)
})
