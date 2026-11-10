export type AiSimulationPart = 'part1' | 'part2' | 'part3' | 'full'
export type AiSimulationStatus = 'completed' | 'stopped'

export interface AiSimulationTurn {
  id: string
  role: 'examiner' | 'candidate'
  text: string
  completedAt: string
  audioStartSeconds?: number
  audioDurationSeconds?: number
  audioAvailable?: boolean
}

export interface AnswerMasteryResponse {
  question: string
  answer: string
  relevance: number
  structure: number
  development: number
  language: number
  supportUsed?: boolean
  independence?: number
  feedback: string
  nextStep: string
}

export interface AnswerMasteryAssessment {
  assessedAt: string
  responses: AnswerMasteryResponse[]
}

export interface AiSimulationRecord {
  id: string
  templateId?: string
  templateTitle?: string
  mode?: 'ai-to-ai' | 'human-practice'
  part: AiSimulationPart
  topic: string
  startedAt: string
  completedAt: string
  durationSeconds: number
  status: AiSimulationStatus
  turns: AiSimulationTurn[]
  audioAvailable: boolean
  model: string
  answerMastery?: AnswerMasteryAssessment
  scaffoldedTurnIds?: string[]
}
