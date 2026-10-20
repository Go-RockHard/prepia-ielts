import { useState } from 'react'
import { CheckCircle2, RotateCcw, Send, Sparkles, XCircle } from 'lucide-react'
import type { AdaptiveQuiz, AdaptiveQuizQuestion } from './adaptiveQuiz'

function isCorrect(question: AdaptiveQuizQuestion, response: string): boolean {
  const normalized = response.trim().toLocaleLowerCase()
  return normalized.length > 0 && question.correctAnswer.split('|').some(
    (answer) => answer.trim().toLocaleLowerCase() === normalized,
  )
}

export function AdaptiveQuizWidget({ quiz }: { quiz: AdaptiveQuiz }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const score = quiz.questions.filter((question) => isCorrect(question, answers[question.id] ?? '')).length

  function submitQuiz() {
    if (quiz.questions.some((question) => !answers[question.id]?.trim())) {
      setError('Answer every question before checking your results.')
      return
    }
    setError('')
    setSubmitted(true)
  }

  function setAnswer(question: AdaptiveQuizQuestion, answer: string) {
    if (submitted) return
    setError('')
    setAnswers((current) => ({ ...current, [question.id]: answer }))
  }

  return (
    <section className="adaptive-quiz" aria-label={`Interactive quiz: ${quiz.title}`}>
      <header className="adaptive-quiz-header">
        <span className="adaptive-quiz-icon"><Sparkles size={16} /></span>
        <div><strong>{quiz.title}</strong><span>{quiz.topic} · {quiz.questions.length} questions</span></div>
      </header>
      {submitted && (
        <div className="adaptive-quiz-score" role="status">
          <strong>{score} / {quiz.questions.length}</strong>
          <span>{score === quiz.questions.length ? 'Excellent work!' : 'Review the explanations and try again.'}</span>
        </div>
      )}
      <div className="adaptive-quiz-questions">
        {quiz.questions.map((question, index) => {
          const response = answers[question.id] ?? ''
          const correct = isCorrect(question, response)
          return (
            <fieldset className={`adaptive-quiz-question${submitted ? correct ? ' adaptive-quiz-correct' : ' adaptive-quiz-incorrect' : ''}`} key={question.id}>
              <legend><span>QUESTION {index + 1} · {question.type.replace('_', ' ').toUpperCase()}</span>{question.question}</legend>
              {(question.type === 'mcq' || question.type === 'true_false') && (
                <div className="adaptive-quiz-options">
                  {question.options.map((option) => (
                    <label className={response === option ? 'adaptive-quiz-option-selected' : ''} key={option}>
                      <input type="radio" name={`${quiz.id}-${question.id}`} value={option} checked={response === option} disabled={submitted} onChange={() => setAnswer(question, option)} />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              )}
              {question.type === 'dropdown' && (
                <label className="adaptive-quiz-select-label">
                  <select aria-label={`Choose an answer for question ${index + 1}`} value={response} disabled={submitted} onChange={(event) => setAnswer(question, event.target.value)}>
                    <option value="">Choose an answer…</option>
                    {question.options.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              )}
              {question.type === 'fill_blank' && (
                <label className="adaptive-quiz-input-label">
                  <input aria-label={`Type your answer for question ${index + 1}`} value={response} disabled={submitted} onChange={(event) => setAnswer(question, event.target.value)} placeholder="Type your answer…" />
                </label>
              )}
              {submitted && (
                <div className="adaptive-quiz-feedback">
                  {correct ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                  <p><strong>{correct ? 'Correct' : `Answer: ${question.correctAnswer.split('|')[0]}`}</strong> {question.explanation}</p>
                </div>
              )}
            </fieldset>
          )
        })}
      </div>
      {error && <p className="adaptive-quiz-error" role="alert">{error}</p>}
      {submitted
        ? <button className="adaptive-quiz-submit" type="button" onClick={() => { setAnswers({}); setSubmitted(false); setError('') }}><RotateCcw size={15} /> Try again</button>
        : <button className="adaptive-quiz-submit" type="button" onClick={submitQuiz}><Send size={15} /> Check answers</button>}
    </section>
  )
}
