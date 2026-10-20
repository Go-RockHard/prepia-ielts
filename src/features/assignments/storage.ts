import type { AssignmentPerformanceMetric, AssignmentPerformanceReport, CoachAssignment } from './types'

function storageKey(username: string): string {
  return `speakia-assignments-v1:${username}`
}

function isStringList(value: unknown, maximum: number): value is string[] {
  return Array.isArray(value) && value.length <= maximum
    && value.every((entry) => typeof entry === 'string' && !!entry.trim())
}

function isPerformanceMetric(value: unknown): value is AssignmentPerformanceMetric {
  if (typeof value !== 'object' || value === null) return false
  const metric = value as Record<string, unknown>
  return typeof metric.name === 'string' && !!metric.name.trim() && metric.name.length <= 80
    && typeof metric.evidence === 'string' && !!metric.evidence.trim() && metric.evidence.length <= 600
    && typeof metric.score === 'number' && Number.isFinite(metric.score) && metric.score >= 0 && metric.score <= 100
}

function isPerformanceReport(value: unknown): value is AssignmentPerformanceReport {
  if (typeof value !== 'object' || value === null) return false
  const report = value as Record<string, unknown>
  return ['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'].includes(report.model as string)
    && typeof report.evaluatedAt === 'string'
    && Number.isFinite(Date.parse(report.evaluatedAt))
    && typeof report.submissionName === 'string' && report.submissionName.length <= 255
    && (report.submissionType === 'audio' || report.submissionType === 'document' || report.submissionType === 'text')
    && typeof report.summary === 'string' && !!report.summary.trim() && report.summary.length <= 2400
    && isStringList(report.strengths, 8)
    && isStringList(report.weaknesses, 8)
    && Array.isArray(report.metrics) && report.metrics.length >= 3 && report.metrics.length <= 6
    && report.metrics.every(isPerformanceMetric)
    && isStringList(report.improvementPlan, 8)
    && (report.transcript === undefined || (typeof report.transcript === 'string' && report.transcript.length <= 12000))
}

function isAssignment(value: unknown): value is CoachAssignment {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string'
    && typeof item.assignedFor === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(item.assignedFor)
    && typeof item.createdAt === 'string'
    && Number.isFinite(Date.parse(item.createdAt))
    && (item.status === 'assigned' || item.status === 'completed')
    && typeof item.title === 'string' && !!item.title.trim()
    && typeof item.activity === 'string' && !!item.activity.trim()
    && typeof item.topic === 'string' && !!item.topic.trim()
    && typeof item.focus === 'string' && !!item.focus.trim()
    && typeof item.rationale === 'string' && !!item.rationale.trim()
    && Array.isArray(item.instructions)
    && item.instructions.length >= 2
    && item.instructions.length <= 5
    && item.instructions.every((instruction) => typeof instruction === 'string' && !!instruction.trim())
    && typeof item.durationMinutes === 'number'
    && Number.isInteger(item.durationMinutes)
    && item.durationMinutes >= 5
    && item.durationMinutes <= 45
    && (item.mode === undefined || item.mode === 'speaking' || item.mode === 'handwritten')
    && (item.detailedStatement === undefined || (typeof item.detailedStatement === 'string' && item.detailedStatement.length <= 1400))
    && (item.report === undefined || isPerformanceReport(item.report))
    && (item.part === 'part1' || item.part === 'part2' || item.part === 'part3')
}

export function loadAssignments(username: string): CoachAssignment[] {
  try {
    const stored = localStorage.getItem(storageKey(username))
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every(isAssignment)) {
      throw new Error('Saved coach assignments are invalid.')
    }
    return parsed
  } catch (error) {
    console.error('Unable to load saved coach assignments.', error)
    return []
  }
}

export function saveAssignments(username: string, assignments: CoachAssignment[]): void {
  try {
    localStorage.setItem(storageKey(username), JSON.stringify(assignments))
  } catch (error) {
    console.error('Unable to save coach assignments.', error)
    throw new Error('The assignment could not be saved on this device.')
  }
}
