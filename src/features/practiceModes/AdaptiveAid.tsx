import { Lightbulb } from 'lucide-react'
import type { AdaptiveAid } from './adaptiveAidTypes'

export function AdaptiveAidWidget({ aid, ariaLabel = 'Adaptive coaching support' }: { aid: AdaptiveAid; ariaLabel?: string }) {
  return <section className="practice-mode-adaptive-aid" aria-live="polite" aria-label={ariaLabel}>
    <div className="practice-mode-adaptive-aid-heading"><span><Lightbulb size={17} /></span><div><strong>{aid.supportType === 'idea-cue' ? 'A few ideas to get started' : aid.supportType === 'vocabulary' ? 'Useful words for this answer' : aid.supportType === 'answer-structure' ? 'A simple way to shape your answer' : aid.supportType === 'sentence-frames' ? 'Sentence starters you can adapt' : 'A short worked example'}</strong><small>{aid.reason}</small></div></div>
    {aid.hints && <ul>{aid.hints.map((hint, index) => <li key={`${index}-${hint}`}>{hint}</li>)}</ul>}
    {aid.vocabulary && <div className="practice-mode-adaptive-vocabulary">{aid.vocabulary.map((item) => <article key={item.phrase}><strong>{item.phrase}</strong><span>{item.meaning}</span><small>{item.example}</small></article>)}</div>}
    {aid.framework && <ol>{aid.framework.map((step, index) => <li key={`${index}-${step}`}><span>{index + 1}</span>{step}</li>)}</ol>}
    {aid.sentenceFrames && <div className="practice-mode-adaptive-frames">{aid.sentenceFrames.map((frame, index) => <p key={`${index}-${frame}`}>{frame}</p>)}</div>}
    {aid.workedExample && <p className="practice-mode-adaptive-example">{aid.workedExample}<small>Use this as an example to learn from—not a script to memorize.</small></p>}
    <small className="practice-mode-adaptive-reminder">Take only what helps, then make the answer your own.</small>
  </section>
}
