export type WritiaLearnerCriterion = {
  label: string
  band: number
  evidence: string
  nextStep: string
}

export type WritiaLearnerAssessment = {
  id: string
  taskLabel: string
  overallBand: number
  createdAt: number
  summary: string
  priority: string
  mode?: 'guided' | 'exam'
  wordCount: number
  criteria: WritiaLearnerCriterion[]
}

export type WritiaLearnerAssignment = {
  id: string
  title: string
  status: 'assigned' | 'completed'
  taskType: 'task1' | 'task2'
  focus: string
  assignedFor: string
}

export type WritiaLearnerContext = {
  assessments: WritiaLearnerAssessment[]
  assignments: WritiaLearnerAssignment[]
  activeDraft?: {
    taskLabel: string
    mode: 'guided' | 'exam'
    content: string
    wordCount: number
  }
}

export const EMPTY_WRITIA_LEARNER_CONTEXT: WritiaLearnerContext = { assessments: [], assignments: [] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseAssessment(value: unknown): WritiaLearnerAssessment | null {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.taskLabel !== 'string'
    || typeof value.overallBand !== 'number'
    || typeof value.createdAt !== 'number'
    || !Number.isFinite(value.createdAt)
    || typeof value.summary !== 'string'
    || typeof value.priority !== 'string'
    || typeof value.wordCount !== 'number'
    || !Array.isArray(value.criteria)) return null
  const criteria = value.criteria.filter((criterion): criterion is Record<string, unknown> => isRecord(criterion)
    && typeof criterion.label === 'string'
    && typeof criterion.band === 'number'
    && typeof criterion.evidence === 'string'
    && typeof criterion.nextStep === 'string')
  return {
    id: value.id,
    taskLabel: value.taskLabel,
    overallBand: value.overallBand,
    createdAt: value.createdAt,
    summary: value.summary,
    priority: value.priority,
    mode: value.mode === 'exam' || value.mode === 'guided' ? value.mode : undefined,
    wordCount: value.wordCount,
    criteria: criteria.map(({ label, band, evidence, nextStep }) => ({ label, band, evidence, nextStep })),
  }
}

function parseAssignment(value: unknown): WritiaLearnerAssignment | null {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.title !== 'string'
    || (value.status !== 'assigned' && value.status !== 'completed')
    || (value.taskType !== 'task1' && value.taskType !== 'task2')
    || typeof value.focus !== 'string'
    || typeof value.assignedFor !== 'string') return null
  return {
    id: value.id,
    title: value.title,
    status: value.status,
    taskType: value.taskType,
    focus: value.focus,
    assignedFor: value.assignedFor,
  }
}

export function loadWritiaLearnerContext(username: string): WritiaLearnerContext {
  try {
    const raw = localStorage.getItem(`writa-writing-v1:${username}`)
    if (!raw) return EMPTY_WRITIA_LEARNER_CONTEXT
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) throw new Error('Saved Writia learner context is invalid.')
    return {
      assessments: Array.isArray(parsed.assessments)
        ? parsed.assessments.map(parseAssessment).filter((item): item is WritiaLearnerAssessment => item !== null).slice(0, 12)
        : [],
      assignments: Array.isArray(parsed.assignments)
        ? parsed.assignments.map(parseAssignment).filter((item): item is WritiaLearnerAssignment => item !== null).slice(0, 12)
        : [],
    }
  } catch (error) {
    console.error('Unable to load Writia learner context.', error)
    return EMPTY_WRITIA_LEARNER_CONTEXT
  }
}
