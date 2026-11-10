export type AdaptiveSupportType = 'idea-cue' | 'vocabulary' | 'answer-structure' | 'sentence-frames' | 'worked-example'

export interface AdaptiveAid {
  supportType: AdaptiveSupportType
  question: string
  reason: string
  hints?: string[]
  vocabulary?: { phrase: string; meaning: string; example: string }[]
  framework?: string[]
  sentenceFrames?: string[]
  workedExample?: string
}

export function isAdaptiveSupportType(value: unknown): value is AdaptiveSupportType {
  return value === 'idea-cue' || value === 'vocabulary' || value === 'answer-structure'
    || value === 'sentence-frames' || value === 'worked-example'
}
