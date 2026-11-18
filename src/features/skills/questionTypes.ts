export type SkillQuestion = (
  { type: 'multiple-choice'; prompt: string; options: string[]; answer: string; explanation: string }
  | { type: 'multiple-select'; prompt: string; options: string[]; answer: string[]; instruction: string; explanation: string }
  | { type: 'classification'; prompt: string; options: string[]; answer: string; explanation: string }
  | { type: 'matching'; prompt: string; instruction: string; options: string[]; items: { id: string; text: string; answer: string }[]; explanation: string }
  | { type: 'matching-headings' | 'matching-information' | 'matching-features' | 'matching-sentence-endings'; prompt: string; instruction: string; options: string[]; items: { id: string; text: string; answer: string }[]; explanation: string }
  | { type: 'completion' | 'note-completion' | 'sentence-completion'; prompt: string; instruction: string; gaps: { id: string; label: string; acceptedAnswers: string[] }[]; explanation: string }
  | { type: 'short-answer'; prompt: string; acceptedAnswers: string[]; wordLimit: number; explanation: string }
  | { type: 'labeling' | 'flow-chart'; prompt: string; diagramDescription: string; options: string[]; items: { id: string; label: string; answer: string }[]; explanation: string }
) & { evidence?: string }
export type PracticeSet = {
  id: string
  title: string
  level: 'Foundation' | 'Intermediate'
  minutes: number
  instructions: string
  passage?: string
  passages?: { title: string; text: string }[]
  audioScript?: string
  audioAssetId?: string
  audioTurns?: { speakerId: string; text: string; style?: string }[]
  audioSections?: { title: string; script: string }[]
  examSections?: { title: string; questionStartIndex: number; questionEndIndex: number }[]
  fullLength?: boolean
  isFocusedDrill?: boolean
  questions: SkillQuestion[]
}
