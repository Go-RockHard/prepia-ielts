import { createInteractiveLesson } from '@/features/assistant/interactiveLesson'
import type { InteractiveLesson } from '@/features/assistant/interactiveLesson'
import type { TestResult } from './types'

export async function createAssessmentLesson(
  apiKey: string,
  result: TestResult,
  model: string,
): Promise<InteractiveLesson> {
  const weakestCriteria = [...result.criteria]
    .sort((left, right) => left.band - right.band)
    .slice(0, 2)
  const focus = weakestCriteria
    .map((criterion) => `${criterion.name} (${criterion.band.toFixed(1)}/9): ${criterion.note}`)
    .join('\n')
  const target = weakestCriteria.map((criterion) => criterion.name).join(' and ')
  const part = result.part === 'full' ? undefined : result.part
  const candidateEvidence = result.transcript
    .filter((entry) => entry.role === 'candidate')
    .map((entry) => entry.text)
    .join('\n')

  return createInteractiveLesson(
    apiKey,
    {
      request: `Create a visually polished, adaptive HTML5 lesson specifically from this completed IELTS Speaking assessment. Prioritize the learner's two weakest rubric criteria (${target}), use their actual feedback and candidate-response evidence, then build short interactive exercises with hints, corrective feedback, and a final check. Sequence the lesson from a clear explanation to guided practice to a slightly harder transfer task. Do not invent assessment evidence or present this as an official IELTS score.`,
      topic: `${result.title}: targeted IELTS Speaking practice`,
      focus,
      ...(part ? { part } : {}),
      level: `Practice estimate ${result.overallBand.toFixed(1)}/9`,
    },
    {
      assessment: {
        part: result.part,
        overallBand: result.overallBand,
        criteria: result.criteria.map(({ name, band, note }) => ({ name, band, feedback: note })),
        weakestCriteria: weakestCriteria.map(({ name, band, note }) => ({ name, band, feedback: note })),
        strengths: result.strengths,
        nextSteps: result.nextSteps,
        sentenceFeedback: result.sentenceFeedback ?? [],
        candidateResponseEvidence: candidateEvidence.slice(0, 6000),
      },
    },
    model,
  )
}
