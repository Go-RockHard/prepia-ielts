import type { SpeakingPrompt } from '@/features/simulator/questions'

export const topicCategories = [
  'People & relationships', 'Home & places', 'Work & education', 'Technology', 'Travel & transport',
  'Culture & leisure', 'Nature & environment', 'Society & community', 'Daily life',
] as const

export type TopicCategory = typeof topicCategories[number]
export type TopicBankPrompt = Omit<SpeakingPrompt, 'preparationSeconds' | 'responseSeconds'>
  & Partial<Pick<SpeakingPrompt, 'preparationSeconds' | 'responseSeconds'>>
  & { category: TopicCategory; cuePoints?: string[]; vocabulary: string[]; sampleAnswer?: string }
