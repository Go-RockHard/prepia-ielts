export type PlacementSkill = 'speaking' | 'writing'

export type PlacementCriterion = {
  id: string
  label: string
  band: number
  evidence: string
  nextStep: string
}

export type PlacementAssessment = {
  id: string
  skill: PlacementSkill
  overallBand: number
  createdAt: number
  summary: string
  priority: string
  criteria: PlacementCriterion[]
}

export function isPlacementAssessment(value: unknown): value is PlacementAssessment {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && (record.skill === 'speaking' || record.skill === 'writing')
    && typeof record.overallBand === 'number' && Number.isFinite(record.overallBand) && record.overallBand >= 0 && record.overallBand <= 9
    && typeof record.createdAt === 'number' && Number.isFinite(record.createdAt)
    && typeof record.summary === 'string'
    && typeof record.priority === 'string'
    && Array.isArray(record.criteria)
    && record.criteria.length === 4
    && record.criteria.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item)
      && typeof item.id === 'string'
      && typeof item.label === 'string'
      && typeof item.band === 'number' && Number.isFinite(item.band) && item.band >= 0 && item.band <= 9
      && typeof item.evidence === 'string'
      && typeof item.nextStep === 'string')
}
