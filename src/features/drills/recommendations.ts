import { Behavior, FunctionResponseScheduling, type FunctionCall, type FunctionResponse, type Tool } from '@google/genai'

export const drillRecommendationToolName = 'recommend_targeted_speaking_drills'

export const drillCatalog = [
  { id: 'fluency', title: 'One-minute fluency', skill: 'Fluency & coherence' },
  { id: 'pronunciation', title: 'Speech shadowing', skill: 'Pronunciation' },
  { id: 'vocabulary', title: 'Topic vocabulary in speech', skill: 'Lexical resource' },
  { id: 'grammar', title: 'Simple-to-complex expansion', skill: 'Grammar range & accuracy' },
  { id: 'part1', title: 'Part 1 quick responses', skill: 'IELTS Speaking Part 1' },
  { id: 'part2', title: 'Part 2 story structure', skill: 'IELTS Speaking Part 2' },
  { id: 'part3', title: 'Part 3 develop an opinion', skill: 'IELTS Speaking Part 3' },
  { id: 'answer-expansion', title: 'Expand your answer', skill: 'Answer development' },
  { id: 'idea-linking', title: 'Link ideas naturally', skill: 'Fluency & coherence' },
  { id: 'paraphrase', title: 'Paraphrasing drill', skill: 'Lexical resource' },
  { id: 'intonation', title: 'Intonation & emphasis', skill: 'Pronunciation' },
  { id: 'compare-speculate', title: 'Compare & speculate', skill: 'IELTS Speaking Part 3' },
  { id: 'sentence-rebuilding', title: 'Sentence rebuilding', skill: 'Grammar range & accuracy' },
  { id: 'spoken-completion', title: 'Spoken sentence completion', skill: 'Grammar range & accuracy' },
  { id: 'tense-correction', title: 'Tense control & repair', skill: 'Grammar range & accuracy' },
  { id: 'grammar-pattern-repetition', title: 'Grammar pattern repetition', skill: 'Grammar range & accuracy' },
  { id: 'guided-answer-building', title: 'Guided answer-building', skill: 'Answer development' },
  { id: 'repeat-after-feedback', title: 'Repeat after feedback', skill: 'Fluency & coherence' },
  { id: 'discourse-markers', title: 'Natural discourse markers', skill: 'Fluency & coherence' },
  { id: 'model-repeat-pronunciation', title: 'Model-and-repeat pronunciation', skill: 'Pronunciation' },
  { id: 'live-coaching', title: 'Live coaching', skill: 'Fluency, coherence & language control' },
  { id: 'error-triggered-micro-drill', title: 'Error-triggered micro-drill', skill: 'Targeted grammar & language repair' },
  { id: 'reduced-assistance', title: 'Gradually reduced assistance', skill: 'Independent speaking & answer development' },
  { id: 'transfer', title: 'Transfer to a new topic', skill: 'Flexible speaking & skill transfer' },
] as const

export type RecommendedDrillId = typeof drillCatalog[number]['id']
export interface DrillRecommendation {
  weakness: string
  evidence: string
  drillIds: RecommendedDrillId[]
}

export const drillRecommendationTools: Tool[] = [{ functionDeclarations: [{
  name: drillRecommendationToolName,
  behavior: Behavior.NON_BLOCKING,
  description: 'When the candidate has made enough attempts to reveal a specific speaking skill gap, recommend one to three relevant drills from the catalogue. Base each recommendation on observed candidate evidence, not guesses. Do not call for a single minor slip or when there is not enough evidence.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      weakness: { type: 'string', description: 'A concise name for the candidate skill gap, such as tense consistency or answer development.' },
      evidence: { type: 'string', description: 'A brief, respectful description of specific evidence from the candidate’s attempts in this session.' },
      drillIds: {
        type: 'array',
        items: { type: 'string', enum: drillCatalog.map((drill) => drill.id) },
        minItems: 1,
        maxItems: 3,
        description: 'One to three best matching drill IDs from the available catalogue.',
      },
    },
    required: ['weakness', 'evidence', 'drillIds'],
    additionalProperties: false,
  },
}] }]

export function completeDrillRecommendationToolCall(call: FunctionCall, response: Record<string, unknown>): FunctionResponse {
  return {
    id: call.id,
    name: call.name,
    response,
    willContinue: false,
    scheduling: FunctionResponseScheduling.WHEN_IDLE,
  }
}

export async function processDrillRecommendationToolCalls(
  functionCalls: FunctionCall[],
  onRecommendations: (recommendation: DrillRecommendation) => void,
  onError: (message: string) => void,
): Promise<FunctionResponse[]> {
  return functionCalls.map((call) => {
    const weakness = typeof call.args?.weakness === 'string' ? call.args.weakness.trim() : ''
    const evidence = typeof call.args?.evidence === 'string' ? call.args.evidence.trim() : ''
    const drillIds = Array.isArray(call.args?.drillIds)
      ? [...new Set(call.args.drillIds.filter((id): id is RecommendedDrillId => drillCatalog.some((drill) => drill.id === id)))]
      : []
    if (call.name !== drillRecommendationToolName || !weakness || !evidence || drillIds.length === 0) {
      onError('The coach could not prepare an evidence-based drill recommendation. Continue practising, or ask the coach to try again.')
      return completeDrillRecommendationToolCall(call, { error: 'Provide a specific observed weakness, evidence from this session, and at least one valid drill ID.' })
    }
    const recommendation = { weakness, evidence, drillIds: drillIds.slice(0, 3) }
    onRecommendations(recommendation)
    return completeDrillRecommendationToolCall(call, {
      accepted: true,
      instruction: 'The app displayed these targeted drills with the observed evidence. Briefly explain the recommendation to the learner and let them decide whether to open one. Do not overstate a short session as a stable diagnosis.',
    })
  })
}
