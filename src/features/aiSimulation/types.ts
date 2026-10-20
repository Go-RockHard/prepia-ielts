export type AiSimulationPart = 'part1' | 'part2' | 'part3' | 'full'
export type AiSimulationStatus = 'completed' | 'stopped'

export interface AiSimulationTurn {
  id: string
  role: 'examiner' | 'candidate'
  text: string
  completedAt: string
  audioStartSeconds?: number
  audioDurationSeconds?: number
}

export interface AiSimulationRecord {
  id: string
  part: AiSimulationPart
  topic: string
  startedAt: string
  completedAt: string
  durationSeconds: number
  status: AiSimulationStatus
  turns: AiSimulationTurn[]
  audioAvailable: boolean
  model: string
}
