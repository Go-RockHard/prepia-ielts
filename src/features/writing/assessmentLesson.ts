import { createInteractiveLesson } from '@/features/assistant/interactiveLesson'
import type { InteractiveLesson } from '@/features/assistant/interactiveLesson'

export interface WritingAssessmentLessonSource {
  taskLabel: string
  overallBand: number
  summary: string
  priority: string
  wordCount: number
  criteria: Array<{ label: string; band: number; evidence: string; nextStep: string }>
}

export async function createWritingAssessmentLesson(
  apiKey: string,
  assessment: WritingAssessmentLessonSource,
  taskPrompt: string,
  response: string,
  model: string,
): Promise<InteractiveLesson> {
  const weakestCriteria = [...assessment.criteria].sort((left, right) => left.band - right.band).slice(0, 2)
  const focus = weakestCriteria.map((criterion) => `${criterion.label} (${criterion.band.toFixed(1)}/9): ${criterion.evidence} Next step: ${criterion.nextStep}`).join('\n')
  const lesson = await createInteractiveLesson(
    apiKey,
    {
      request: `Create a complete, polished adaptive IELTS Writing HTML5 improvement lesson based on this recent assessment. Prioritize the two lowest criteria, use the actual assessment and response evidence, teach one skill at a time, and build a short improvement agenda. Include a clear mini-lesson, at least two interactive exercises with immediate feedback and hints, a guided editing or planning activity, and a final transfer check. Do not write an entire essay or present an official IELTS score.`,
      topic: `${assessment.taskLabel}: personalized writing improvement`,
      focus,
      level: `Practice estimate ${assessment.overallBand.toFixed(1)}/9`,
    },
    {
      product: 'Writia',
      task: { label: assessment.taskLabel, prompt: taskPrompt },
      assessment: {
        practiceEstimate: assessment.overallBand,
        summary: assessment.summary,
        priority: assessment.priority,
        wordCount: assessment.wordCount,
        criteria: assessment.criteria,
        weakestCriteria,
        strengths: assessment.criteria.filter((criterion) => criterion.band >= assessment.overallBand).map(({ label, evidence }) => ({ label, evidence })),
      },
      candidateResponseEvidence: response.slice(0, 5000),
      pedagogy: [
        'Use evidence from this Writing assessment only.',
        'Teach task response/achievement, coherence and cohesion, lexical resource, and grammatical range and accuracy as appropriate.',
        'Help the learner notice and revise short excerpts; never generate a complete replacement essay.',
        'Prefer accurate, natural language over complexity for its own sake.',
        'Move from retrieval to guided practice to a new transfer example.',
        'Give actionable feedback, hints, and a final next-session plan.',
      ],
    },
    model,
    undefined,
    'writing',
  )
  return { ...lesson, summary: `Adaptive IELTS Writing lesson based on ${assessment.taskLabel} and its criterion-level evidence.` }
}
