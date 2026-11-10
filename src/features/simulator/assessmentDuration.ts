import { ASSESSMENT_MODELS } from './gemini'

export function formatAssessmentDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`
}

export function getAssessmentModelLabel(modelId?: string): string {
  if (!modelId) return 'Model not recorded'
  return ASSESSMENT_MODELS.find((model) => model.id === modelId)?.label ?? 'Model not recorded'
}
