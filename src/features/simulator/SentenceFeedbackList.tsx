import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { SentenceFeedback } from './types'

export function SentenceFeedbackList({ items }: { items: SentenceFeedback[] }) {
  if (items.length === 0) {
    return <Card className="sentence-feedback-empty"><p>Sentence-level feedback is not available for this assessment.</p></Card>
  }

  return <div className="sentence-feedback-list">
    {items.map((item, index) => <Card className="sentence-feedback-card" key={`${index}-${item.originalSentence}`}>
      <div className="sentence-feedback-heading"><Badge>Sentence {index + 1}</Badge><span>{item.issue}</span></div>
      <blockquote>{item.originalSentence}</blockquote>
      <div className="sentence-feedback-version"><strong>Suggested correction</strong><p>{item.correction}</p></div>
      <div className="sentence-feedback-version sentence-feedback-band"><strong>Band 8-style alternative</strong><p>{item.bandEightVersion}</p></div>
      <p className="sentence-feedback-explanation">{item.explanation}</p>
    </Card>)}
  </div>
}
