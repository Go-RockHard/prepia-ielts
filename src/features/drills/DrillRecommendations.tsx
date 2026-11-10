import { ArrowRight, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { drillCatalog, type DrillRecommendation } from './recommendations'

export function DrillRecommendations({ recommendation, context, onOpenDrill }: {
  recommendation: DrillRecommendation
  context?: string
  onOpenDrill: (drillId: string, context?: string) => void
}) {
  const drills = recommendation.drillIds.flatMap((id) => {
    const drill = drillCatalog.find((item) => item.id === id)
    return drill ? [drill] : []
  })
  if (!drills.length) return null

  return <section className="cross-module-drill-recommendations" aria-live="polite" aria-label="Targeted speaking drill recommendations">
    <header><span><Target size={16} /></span><div><strong>Targeted practice suggestion</strong><small>{recommendation.weakness}</small></div></header>
    <p>{recommendation.evidence}</p>
    {context && <div className="cross-module-drill-context"><small>Continue with this question in the drill</small><p>{context}</p></div>}
    <div>{drills.map((drill) => <article key={drill.id}>
      <span><strong>{drill.title}</strong><small>{drill.skill}</small></span>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenDrill(drill.id, context)}>Open drill with this question <ArrowRight size={13} /></Button>
    </article>)}</div>
    <small>Based on this session only; use it as a practice suggestion, not a fixed judgment.</small>
  </section>
}
