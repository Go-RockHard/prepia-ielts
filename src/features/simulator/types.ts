export type TestPart = 'full' | 'part1' | 'part2' | 'part3'

export type CriterionId =
  | 'fluency'
  | 'lexical'
  | 'grammar'
  | 'pronunciation'

export interface AnswerRecord {
  questionId: string
  part: Exclude<TestPart, 'full'>
  prompt: string
  answer: string
  durationSeconds: number
}

export interface CriterionResult {
  id: CriterionId
  name: string
  band: number
  assessmentType: 'Speakia audio assessment' | 'Gemini audio assessment'
  note: string
}

export interface TranscriptEntry {
  id?: string
  role: 'examiner' | 'candidate' | 'assessment'
  text: string
  audio?: Blob
  audioOrder?: number
  source?: 'text'
  finished?: boolean
}

export interface SentenceFeedback {
  originalSentence: string
  issue: string
  correction: string
  bandEightVersion: string
  explanation: string
}

export interface TestResult {
  id: string
  title: string
  completedAt: string
  part: TestPart
  overallBand: number
  durationSeconds: number
  answers: AnswerRecord[]
  transcript: TranscriptEntry[]
  criteria: CriterionResult[]
  executiveSummary?: string
  strengths: string[]
  nextSteps: string[]
  sentenceFeedback?: SentenceFeedback[]
  audioAvailable?: boolean
  audioCopyAvailable?: boolean
  assessmentModel?: string
  assessmentDurationMs?: number
  assessmentLessonAvailable?: boolean
  assessmentLessonVersion?: string
}
