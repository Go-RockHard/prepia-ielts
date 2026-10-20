import type { TestPart } from '@/features/simulator/types'

export type AssignmentPart = Exclude<TestPart, 'full'>
export type AssignmentStatus = 'assigned' | 'completed'
export type AssignmentEvaluationModel = 'gemini-3.8-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.5-flash-lite' | 'gemini-3.1-flash-lite'

export interface AssignmentPerformanceMetric {
  name: string
  score: number
  evidence: string
}

export interface AssignmentPerformanceReport {
  model: AssignmentEvaluationModel
  evaluatedAt: string
  submissionName: string
  submissionType: 'audio' | 'document' | 'text'
  summary: string
  strengths: string[]
  weaknesses: string[]
  metrics: AssignmentPerformanceMetric[]
  improvementPlan: string[]
  transcript?: string
}

export interface CoachAssignment {
  id: string
  assignedFor: string
  createdAt: string
  status: AssignmentStatus
  title: string
  activity: string
  topic: string
  focus: string
  rationale: string
  instructions: string[]
  durationMinutes: number
  part: AssignmentPart
  mode?: 'speaking' | 'handwritten'
  detailedStatement?: string
  report?: AssignmentPerformanceReport
}
