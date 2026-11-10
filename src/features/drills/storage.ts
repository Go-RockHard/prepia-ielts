export interface DrillCriterionEvaluation {
  id: 'fluency' | 'vocabulary' | 'grammar' | 'pronunciation'
  score: number
  evidence: string
  nextStep: string
}

export interface DrillEvaluation {
  masteryScore: number
  summary: string
  strengths: string[]
  improvements: string[]
  criteria: DrillCriterionEvaluation[]
  nextDrill: string
  evidenceQuality: 'strong' | 'moderate' | 'limited'
}

export interface SpeakingDrillAttempt {
  id: string
  drillId: string
  drillTitle: string
  category: string
  skill: string
  task: string
  startedAt: string
  completedAt: string
  durationSeconds: number
  audioAvailable?: boolean
  transcript: { id?: string; role: 'examiner' | 'candidate'; text: string; audioOrder?: number }[]
  evaluation?: DrillEvaluation
  evaluationError?: string
}

const storageKey = (username: string) => `speakia-speaking-drill-attempts-v1:${username.trim().toLocaleLowerCase()}`
const MAX_ATTEMPTS = 250

function isEvaluation(value: unknown): value is DrillEvaluation {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<DrillEvaluation>
  return typeof item.masteryScore === 'number'
    && typeof item.summary === 'string'
    && Array.isArray(item.strengths) && item.strengths.every((entry) => typeof entry === 'string')
    && Array.isArray(item.improvements) && item.improvements.every((entry) => typeof entry === 'string')
    && Array.isArray(item.criteria)
    && item.criteria.every((criterion) => typeof criterion === 'object' && criterion !== null
      && typeof criterion.id === 'string' && ['fluency', 'vocabulary', 'grammar', 'pronunciation'].includes(String(criterion.id))
      && typeof criterion.score === 'number' && typeof criterion.evidence === 'string' && typeof criterion.nextStep === 'string')
    && typeof item.nextDrill === 'string'
    && typeof item.evidenceQuality === 'string' && ['strong', 'moderate', 'limited'].includes(item.evidenceQuality)
}

function isAttempt(value: unknown): value is SpeakingDrillAttempt {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<SpeakingDrillAttempt>
  return typeof item.id === 'string' && typeof item.drillId === 'string'
    && typeof item.drillTitle === 'string' && typeof item.category === 'string'
    && typeof item.skill === 'string' && typeof item.task === 'string'
    && typeof item.startedAt === 'string' && typeof item.completedAt === 'string'
    && typeof item.durationSeconds === 'number'
    && (item.audioAvailable === undefined || typeof item.audioAvailable === 'boolean')
    && Array.isArray(item.transcript)
    && item.transcript.every((turn) => typeof turn === 'object' && turn !== null
      && (turn.id === undefined || typeof turn.id === 'string')
      && (turn.role === 'examiner' || turn.role === 'candidate') && typeof turn.text === 'string'
      && (turn.audioOrder === undefined || (typeof turn.audioOrder === 'number' && Number.isFinite(turn.audioOrder))))
    && (item.evaluation === undefined || isEvaluation(item.evaluation))
    && (item.evaluationError === undefined || typeof item.evaluationError === 'string')
}

export function loadSpeakingDrillAttempts(username: string): SpeakingDrillAttempt[] {
  try {
    const raw = localStorage.getItem(storageKey(username))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('Saved Speaking Drills history is not a list.')
    return parsed.filter(isAttempt).sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
  } catch (error) {
    console.error('Unable to load Speaking Drills history.', error)
    return []
  }
}

export function saveSpeakingDrillAttempts(username: string, attempts: SpeakingDrillAttempt[]): boolean {
  try {
    localStorage.setItem(storageKey(username), JSON.stringify(attempts.slice(0, MAX_ATTEMPTS)))
    return true
  } catch (error) {
    console.error('Unable to save Speaking Drills history.', error)
    return false
  }
}

export function updateSpeakingDrillAttempt(
  username: string,
  attemptId: string,
  update: (attempt: SpeakingDrillAttempt) => SpeakingDrillAttempt,
): SpeakingDrillAttempt[] {
  const attempts = loadSpeakingDrillAttempts(username)
  const updated = attempts.map((attempt) => attempt.id === attemptId ? update(attempt) : attempt)
  if (!attempts.some((attempt) => attempt.id === attemptId)) throw new Error('This Speaking Drill attempt is no longer in the saved history.')
  if (!saveSpeakingDrillAttempts(username, updated)) throw new Error('The Speaking Drill history could not be saved in this browser.')
  return updated
}
