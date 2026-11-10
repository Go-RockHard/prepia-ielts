import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { SentenceFeedback } from './types'

export function SentenceFeedbackList({ items }: { items: SentenceFeedback[] }) {
  if (items.length === 0) {
    return <Card className="sentence-feedback-empty"><p>Sentence-level feedback is not available for this assessment.</p></Card>
  }

  return <div className="sentence-feedback-list">
    {items.map((item, index) => <details className="sentence-feedback-card" key={`${index}-${item.originalSentence}`}>
      <summary className="sentence-feedback-summary">
        <span className="sentence-feedback-summary-topline">
          <Badge>Sentence {index + 1}</Badge>
          <span className="sentence-feedback-issue">{item.issue}</span>
        </span>
        <span className="sentence-feedback-preview">{item.originalSentence}</span>
        <span className="sentence-feedback-expand-label">View feedback</span>
      </summary>
      <div className="sentence-feedback-detail">
        <blockquote>{item.originalSentence}</blockquote>
        <div className="sentence-feedback-version"><strong>Suggested correction</strong><p>{item.correction}</p></div>
        <div className="sentence-feedback-version sentence-feedback-band"><strong>Band 8-style alternative</strong><p>{item.bandEightVersion}</p></div>
        <p className="sentence-feedback-explanation">{item.explanation}</p>
      </div>
    </details>)}
  </div>
}
