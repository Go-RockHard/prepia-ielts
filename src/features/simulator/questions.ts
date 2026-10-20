import type { TestPart } from './types'

export interface SpeakingPrompt {
  id: string
  part: Exclude<TestPart, 'full'>
  topic: string
  question: string
  preparationSeconds: number
  responseSeconds: number
}

export const speakingPrompts: SpeakingPrompt[] = [
  {
    id: 'p1-work-study',
    part: 'part1',
    topic: 'Work or study',
    question: 'Do you work or are you a student?',
    preparationSeconds: 0,
    responseSeconds: 45,
  },
  {
    id: 'p1-hometown',
    part: 'part1',
    topic: 'Your hometown',
    question: 'What do you like most about the place where you grew up?',
    preparationSeconds: 0,
    responseSeconds: 45,
  },
  {
    id: 'p1-free-time',
    part: 'part1',
    topic: 'Free time',
    question: 'What do you usually enjoy doing when you have some free time?',
    preparationSeconds: 0,
    responseSeconds: 45,
  },
  {
    id: 'p1-reading',
    part: 'part1',
    topic: 'Reading',
    question: 'Did you enjoy reading when you were a child?',
    preparationSeconds: 0,
    responseSeconds: 45,
  },
  {
    id: 'p1-transport',
    part: 'part1',
    topic: 'Transport',
    question: 'How do you normally travel around your city?',
    preparationSeconds: 0,
    responseSeconds: 45,
  },
  {
    id: 'p1-weekends',
    part: 'part1',
    topic: 'Weekends',
    question: 'How do you prefer to spend your weekends?',
    preparationSeconds: 0,
    responseSeconds: 45,
  },
  {
    id: 'p2-person',
    part: 'part2',
    topic: 'A person who inspires you',
    question:
      'Describe a person who has inspired you. You should say who this person is, how you know them, what they have achieved, and explain why they inspire you.',
    preparationSeconds: 60,
    responseSeconds: 120,
  },
  {
    id: 'p3-influence',
    part: 'part3',
    topic: 'Role models',
    question: 'Why do some people have a greater influence on young people than others?',
    preparationSeconds: 0,
    responseSeconds: 60,
  },
  {
    id: 'p3-success',
    part: 'part3',
    topic: 'Success',
    question: 'Do you think people are influenced more by success or by personal character?',
    preparationSeconds: 0,
    responseSeconds: 60,
  },
  {
    id: 'p3-media',
    part: 'part3',
    topic: 'Public figures',
    question: 'How has social media changed the way people choose role models?',
    preparationSeconds: 0,
    responseSeconds: 60,
  },
  {
    id: 'p3-community',
    part: 'part3',
    topic: 'Community',
    question: 'What can communities do to encourage young people to contribute to society?',
    preparationSeconds: 0,
    responseSeconds: 60,
  },
]

export function promptsForPart(part: TestPart): SpeakingPrompt[] {
  if (part === 'full') return speakingPrompts
  return speakingPrompts.filter((prompt) => prompt.part === part)
}

export function partLabel(part: TestPart): string {
  const labels: Record<TestPart, string> = {
    full: 'Full speaking test',
    part1: 'Part 1 · Introduction & interview',
    part2: 'Part 2 · Long turn',
    part3: 'Part 3 · Discussion',
  }
  return labels[part]
}
