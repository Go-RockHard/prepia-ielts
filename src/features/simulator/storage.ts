import type { TestResult } from './types'

const STORAGE_KEY = 'speakia-test-results-v1'

function isTestResult(value: unknown): value is TestResult {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<TestResult>
  const validParts = ['full', 'part1', 'part2', 'part3']
  const validCriteria = ['fluency', 'lexical', 'grammar', 'pronunciation']
  return typeof candidate.id === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.completedAt === 'string'
    && Number.isFinite(Date.parse(candidate.completedAt))
    && typeof candidate.part === 'string'
    && validParts.includes(candidate.part)
    && typeof candidate.overallBand === 'number'
    && Number.isFinite(candidate.overallBand)
    && candidate.overallBand >= 0
    && candidate.overallBand <= 9
    && typeof candidate.durationSeconds === 'number'
    && Number.isFinite(candidate.durationSeconds)
    && candidate.durationSeconds >= 0
    && Array.isArray(candidate.criteria)
    && candidate.criteria.every((criterion) =>
      typeof criterion === 'object'
      && criterion !== null
      && typeof criterion.id === 'string'
      && validCriteria.includes(criterion.id)
      && typeof criterion.name === 'string'
      && typeof criterion.band === 'number'
      && Number.isFinite(criterion.band)
      && criterion.band >= 0
      && criterion.band <= 9
      && criterion.assessmentType === 'Gemini audio assessment'
      && typeof criterion.note === 'string',
    )
    && Array.isArray(candidate.answers)
    && candidate.answers.every((answer) =>
      typeof answer === 'object'
      && answer !== null
      && typeof answer.questionId === 'string'
      && typeof answer.prompt === 'string'
      && typeof answer.answer === 'string'
      && typeof answer.durationSeconds === 'number'
      && (answer.part === 'part1' || answer.part === 'part2' || answer.part === 'part3'),
    )
    && Array.isArray(candidate.transcript)
    && candidate.transcript.every((entry) =>
      typeof entry === 'object'
      && entry !== null
      && (entry.role === 'examiner' || entry.role === 'candidate' || entry.role === 'assessment')
      && typeof entry.text === 'string'
      && (entry.id === undefined || typeof entry.id === 'string')
      && entry.audio === undefined,
    )
    && Array.isArray(candidate.strengths)
    && candidate.strengths.every((item) => typeof item === 'string')
    && (candidate.executiveSummary === undefined || typeof candidate.executiveSummary === 'string')
    && Array.isArray(candidate.nextSteps)
    && candidate.nextSteps.every((item) => typeof item === 'string')
    && (candidate.sentenceFeedback === undefined
      || (Array.isArray(candidate.sentenceFeedback) && candidate.sentenceFeedback.every((item) =>
        typeof item === 'object' && item !== null
        && typeof item.originalSentence === 'string'
        && typeof item.issue === 'string'
        && typeof item.correction === 'string'
        && typeof item.bandEightVersion === 'string'
        && typeof item.explanation === 'string',
      )))
    && (candidate.audioAvailable === undefined || typeof candidate.audioAvailable === 'boolean')
    && (candidate.audioCopyAvailable === undefined || typeof candidate.audioCopyAvailable === 'boolean')
    && (candidate.assessmentModel === undefined || typeof candidate.assessmentModel === 'string')
    && (candidate.assessmentLessonAvailable === undefined || typeof candidate.assessmentLessonAvailable === 'boolean')
    && (candidate.assessmentLessonVersion === undefined || typeof candidate.assessmentLessonVersion === 'string')
}

export function loadTestResults(): TestResult[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      console.error('Saved Speakia test history is invalid and was ignored.')
      return []
    }
    const validResults = parsed.filter(isTestResult)
    if (validResults.length !== parsed.length) {
      console.warn(`${parsed.length - validResults.length} saved test result(s) were invalid or from an older format and were ignored.`)
    }
    return validResults
  } catch (error) {
    console.error('Unable to load Speakia test history from local storage.', error)
    return []
  }
}

export function saveTestResults(results: TestResult[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results))
    return true
  } catch (error) {
    console.error('Unable to save Speakia test history to local storage.', error)
    return false
  }
}
