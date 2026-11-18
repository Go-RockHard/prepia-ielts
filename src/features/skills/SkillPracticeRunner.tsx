import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Clock3, LoaderCircle, Mic, MicOff, Play, RotateCcw, Send, VolumeX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useGeminiLive } from '@/features/simulator/useGeminiLive'
import { type PracticeSet, type SkillQuestion } from '@/features/skills/questionTypes'
import { deleteActiveSkillSession, loadActiveSkillSession, loadLocalAudioAsset, saveActiveSkillSession, saveSkillAttempt, updateLocalTopicExposure, type SkillAttempt } from '@/features/skills/literacyStorage'

export type SkillProduct = 'readia' | 'listenia'
export type LiteracyView = 'home' | 'practice' | 'progress' | 'content' | 'drills' | 'assignments' | 'learner-profile' | 'placement' | 'performance-history' | 'podcasts' | 'coach-assets'
type PracticeMode = 'exam' | 'guided'
type AnswerSlot = { key: string; label: string; acceptedAnswers: string[]; options?: string[]; multiSelect?: boolean }

function answerSlots(question: SkillQuestion, questionIndex: number): AnswerSlot[] {
  const keyPrefix = `q${questionIndex}`
  switch (question.type) {
    case 'multiple-choice':
    case 'classification':
      return [{ key: keyPrefix, label: question.prompt, acceptedAnswers: [question.answer], options: question.options }]
    case 'multiple-select':
      return [{ key: keyPrefix, label: question.prompt, acceptedAnswers: [question.answer.map(normalizeAnswer).sort().join(' | ')], options: question.options, multiSelect: true }]
    case 'matching':
    case 'matching-headings':
    case 'matching-information':
    case 'matching-features':
    case 'matching-sentence-endings':
      return question.items.map((item) => ({ key: `${keyPrefix}-${item.id}`, label: item.text, acceptedAnswers: [item.answer], options: question.options }))
    case 'completion':
    case 'note-completion':
    case 'sentence-completion':
      return question.gaps.map((gap) => ({ key: `${keyPrefix}-${gap.id}`, label: gap.label, acceptedAnswers: gap.acceptedAnswers }))
    case 'short-answer':
      return [{ key: keyPrefix, label: question.prompt, acceptedAnswers: question.acceptedAnswers }]
    case 'labeling':
    case 'flow-chart':
      return question.items.map((item) => ({ key: `${keyPrefix}-${item.id}`, label: item.label, acceptedAnswers: [item.answer], options: question.options }))
  }
}

function questionMarkCount(question: SkillQuestion): number {
  if (question.type === 'multiple-select') return question.answer.length
  if (question.type === 'matching' || question.type === 'matching-headings' || question.type === 'matching-information' || question.type === 'matching-features' || question.type === 'matching-sentence-endings' || question.type === 'labeling' || question.type === 'flow-chart') return question.items.length
  if (question.type === 'completion' || question.type === 'note-completion' || question.type === 'sentence-completion') return question.gaps.length
  return 1
}

function isMarkAnswered(question: SkillQuestion, questionIndex: number, markIndex: number, answers: Record<string, string>): boolean {
  if (question.type === 'multiple-select') {
    const selected = (answers[`q${questionIndex}`] ?? '').split(' | ').filter(Boolean)
    return selected.length > markIndex
  }
  const slots = answerSlots(question, questionIndex)
  return Boolean(answers[slots[markIndex]?.key]?.trim())
}

function normalizeAnswer(value: string): string {
  return value.toLocaleLowerCase().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim()
}

function wordLimitFromInstruction(instruction: string): number | undefined {
  const limit = instruction.match(/NO MORE THAN\s+(\w+)\s+WORDS?/i)?.[1]?.toLocaleLowerCase()
  if (!limit) return undefined
  const limits: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
  return Number(limit) || limits[limit]
}

function isCorrectAnswer(value: string | undefined, acceptedAnswers: string[]): boolean {
  if (!value) return false
  let normalized = normalizeAnswer(value)
  if (value.includes(' | ')) normalized = value.split(' | ').map(normalizeAnswer).sort().join(' | ')
  return acceptedAnswers.some((answer) => normalizeAnswer(answer) === normalized)
}

function scoreAnswers(questions: SkillQuestion[], answers: Record<string, string>): { score: number; total: number } {
  return questions.reduce((result, question, index) => {
    if (question.type === 'multiple-select') {
      const selected = new Set((answers[`q${index}`] ?? '').split(' | ').filter(Boolean).map(normalizeAnswer))
      const correct = question.answer.map(normalizeAnswer)
      return {
        score: result.score + (selected.size <= correct.length ? correct.filter((answer) => selected.has(answer)).length : 0),
        total: result.total + correct.length,
      }
    }
    const slots = answerSlots(question, index)
    return {
      score: result.score + slots.filter((slot) => isCorrectAnswer(answers[slot.key], slot.acceptedAnswers)).length,
      total: result.total + slots.length,
    }
  }, { score: 0, total: 0 })
}

function scoreByQuestionType(questions: SkillQuestion[], answers: Record<string, string>): Record<string, { score: number; total: number }> {
  const scores: Record<string, { score: number; total: number }> = {}
  questions.forEach((question, index) => {
    const type = question.type
    const localAnswers: Record<string, string> = {}
    if (question.type === 'multiple-select') {
      localAnswers.q0 = answers[`q${index}`] ?? ''
    } else {
      const sourceSlots = answerSlots(question, index)
      const targetSlots = answerSlots(question, 0)
      sourceSlots.forEach((slot, slotIndex) => {
        localAnswers[targetSlots[slotIndex].key] = answers[slot.key] ?? ''
      })
    }
    const result = scoreAnswers([question], localAnswers)
    const current = scores[type] ?? { score: 0, total: 0 }
    scores[type] = { score: current.score + result.score, total: current.total + result.total }
  })
  return scores
}

function SkillQuestionCard({ question, questionIndex, firstQuestionNumber, answers, submitted, active, onAnswer, onQuestionFocus }: {
  question: SkillQuestion
  questionIndex: number
  firstQuestionNumber: number
  answers: Record<string, string>
  submitted: boolean
  active: boolean
  onAnswer: (key: string, value: string) => void
  onQuestionFocus: (questionIndex: number) => void
}) {
  const slots = answerSlots(question, questionIndex)
  const questionCorrect = slots.every((slot) => isCorrectAnswer(answers[slot.key], slot.acceptedAnswers))
  const selectedMultiple = question.type === 'multiple-select' ? (answers[`q${questionIndex}`] ?? '').split(' | ').filter(Boolean).map(normalizeAnswer) : []
  const expectedMultiple = question.type === 'multiple-select' ? question.answer.map(normalizeAnswer) : []
  const multipleCorrectCount = selectedMultiple.filter((answer) => expectedMultiple.includes(answer)).length
  const partialMultipleScore = question.type === 'multiple-select'
    && selectedMultiple.length <= question.answer.length
    && multipleCorrectCount > 0
    && multipleCorrectCount < question.answer.length
  const fieldset = (slot: AnswerSlot, select = false) => select
    ? <select aria-label={slot.label} value={answers[slot.key] ?? ''} disabled={submitted} onChange={(event) => onAnswer(slot.key, event.target.value)}>
      <option value="">Choose an answer</option>
      {slot.options?.map((option) => <option value={option} key={option}>{option}</option>)}
    </select>
    : <div className="literacy-choice-list">{slot.options?.map((option) => {
      const selectedValues = (answers[slot.key] ?? '').split(' | ').filter(Boolean)
      const checked = slot.multiSelect ? selectedValues.includes(option) : answers[slot.key] === option
      const correctOption = slot.multiSelect
        ? (slot.acceptedAnswers[0] ?? '').split(' | ').some((answer) => normalizeAnswer(answer) === normalizeAnswer(option))
        : slot.acceptedAnswers.some((answer) => normalizeAnswer(answer) === normalizeAnswer(option))
      return <label key={option} className={submitted && correctOption ? 'literacy-choice-correct' : ''}>
      <input type={slot.multiSelect ? 'checkbox' : 'radio'} name={`q${questionIndex}`} value={option} checked={checked} disabled={submitted} onChange={() => {
        if (!slot.multiSelect) onAnswer(slot.key, option)
        else onAnswer(slot.key, [...(checked ? selectedValues.filter((value) => value !== option) : [...selectedValues, option])].sort().join(' | '))
      }} />
      <span>{option}</span>
      {submitted && correctOption && <Check size={15} />}
    </label>})}</div>

  const lastQuestionNumber = firstQuestionNumber + questionMarkCount(question) - 1
  const questionRange = firstQuestionNumber === lastQuestionNumber ? `Question ${firstQuestionNumber}` : `Questions ${firstQuestionNumber}–${lastQuestionNumber}`

  return <Card id={`question-group-${questionIndex}`} data-active={active} onFocusCapture={() => onQuestionFocus(questionIndex)} className={`literacy-question ${submitted ? questionCorrect ? 'literacy-answer-correct' : partialMultipleScore ? 'literacy-answer-partial' : 'literacy-answer-incorrect' : ''}`}>
    <h3><span>{firstQuestionNumber === lastQuestionNumber ? firstQuestionNumber : `${firstQuestionNumber}–${lastQuestionNumber}`}</span><span className="literacy-question-body"><small>{questionRange}</small>{question.prompt}</span></h3>
    {question.type === 'multiple-choice' || question.type === 'classification' || question.type === 'multiple-select'
      ? <>{question.type === 'multiple-select' && <p className="literacy-question-instruction">{question.instruction}</p>}{fieldset(slots[0])}</>
      : question.type === 'matching' || question.type === 'matching-headings' || question.type === 'matching-information' || question.type === 'matching-features' || question.type === 'matching-sentence-endings' || question.type === 'labeling' || question.type === 'flow-chart'
        ? <>
          <p className="literacy-question-instruction">{'diagramDescription' in question ? question.diagramDescription : question.instruction}</p>
          <div className="literacy-matching-list">{slots.map((slot) => <label key={slot.key}><span>{slot.label}</span>{fieldset(slot, true)}</label>)}</div>
        </>
        : question.type === 'completion' || question.type === 'note-completion' || question.type === 'sentence-completion'
          ? <><p className="literacy-question-instruction">{question.instruction}</p><div className="literacy-gap-list">{slots.map((slot) => <label key={slot.key}><span>{slot.label}</span><input aria-label={slot.label} value={answers[slot.key] ?? ''} disabled={submitted} onChange={(event) => {
            const value = event.target.value
            const limit = wordLimitFromInstruction(question.instruction)
            if (!limit || value.trim().split(/\s+/).filter(Boolean).length <= limit) onAnswer(slot.key, value)
          }} /></label>)}</div></>
          : question.type === 'short-answer' ? <label className="literacy-short-answer"><span>Your answer</span><input aria-label={question.prompt} value={answers[`q${questionIndex}`] ?? ''} disabled={submitted} onChange={(event) => {
            const value = event.target.value
            if (value.trim().split(/\s+/).filter(Boolean).length <= question.wordLimit) onAnswer(`q${questionIndex}`, value)
          }} /><small>NO MORE THAN {question.wordLimit} WORDS</small></label> : null}
    {submitted && <>{question.evidence && <p className="literacy-evidence"><strong>Source evidence:</strong> “{question.evidence}”</p>}<p className="literacy-explanation">{question.explanation}</p>{slots.some((slot) => !isCorrectAnswer(answers[slot.key], slot.acceptedAnswers)) && <div className="literacy-correct-answers"><strong>Suggested answer{slots.length > 1 ? 's' : ''}:</strong>{slots.filter((slot) => !isCorrectAnswer(answers[slot.key], slot.acceptedAnswers)).map((slot) => <span key={slot.key}>{slot.label}: {slot.acceptedAnswers[0]}</span>)}</div>}</>}
  </Card>
}

export function SkillPracticeRunner({ product, sets, username, onExit, onOpenProgress, apiKey, onOpenSettings, initialSetId, initialMode = 'exam', topicExposureId, topicId, learnerGoal, onSelectedSetChange, onCompleted }: {
  product: SkillProduct
  sets: PracticeSet[]
  username: string
  onExit: () => void
  onOpenProgress: () => void
  apiKey: string
  onOpenSettings: () => void
  initialSetId?: string
  initialMode?: PracticeMode
  topicExposureId?: string
  topicId?: string
  learnerGoal?: string
  onSelectedSetChange?: (setId: string) => void
  onCompleted?: (attempt: SkillAttempt) => void
}) {
  const isReading = product === 'readia'
  const [practiceMode, setPracticeMode] = useState<PracticeMode>(initialMode)
  const [selectedSetId, setSelectedSetId] = useState(initialSetId ?? sets[0].id)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [audioState, setAudioState] = useState<'idle' | 'playing' | 'paused'>('idle')
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioPlayed, setAudioPlayed] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [coachQuestion, setCoachQuestion] = useState('')
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null)
  const [activeQuestionNumber, setActiveQuestionNumber] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [examStartedAt, setExamStartedAt] = useState<number | null>(() => initialMode === 'exam' ? Date.now() : null)
  const [loadedSessionId, setLoadedSessionId] = useState('')
  const submissionStarted = useRef(false)
  const practiceStartedAt = useRef(0)
  const sessionSaveFailureReported = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioObjectUrlRef = useRef<string | null>(null)
  const audioRequestIdRef = useRef(0)
  const currentSet = sets.find((set) => set.id === selectedSetId) ?? sets[0]
  const activeSessionId = `${username.trim().toLocaleLowerCase()}:${product}:${currentSet.id}`
  const activeSection = currentSet.examSections?.[activeSectionIndex]
  const visibleQuestionIndices = activeSection
    ? Array.from({ length: activeSection.questionEndIndex - activeSection.questionStartIndex }, (_, index) => activeSection.questionStartIndex + index)
    : currentSet.questions.map((_, index) => index)
  const questionNumberStarts = currentSet.questions.map((_, index) => currentSet.questions.slice(0, index).reduce((total, question) => total + questionMarkCount(question), 1))
  const questionNavigation = currentSet.questions.flatMap((question, questionIndex) =>
    Array.from({ length: questionMarkCount(question) }, (_, markIndex) => ({
      number: questionNumberStarts[questionIndex] + markIndex,
      questionIndex,
      markIndex,
      answered: isMarkAnswered(question, questionIndex, markIndex, answers),
    })),
  )
  useEffect(() => {
    if (activeQuestionIndex === null) return
    document.getElementById(`question-group-${activeQuestionIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeQuestionIndex, activeQuestionNumber, activeSectionIndex])
  const activePassage = currentSet.passages?.[activeSectionIndex]
  const score = useMemo(() => scoreAnswers(currentSet.questions, answers), [answers, currentSet])
  const answeredCount = currentSet.questions.reduce((count, question, index) => {
    if (question.type !== 'multiple-select') {
      return count + answerSlots(question, index).filter((slot) => Boolean(answers[slot.key]?.trim())).length
    }
    const selected = (answers[`q${index}`] ?? '').split(' | ').filter(Boolean)
    return count + Math.min(selected.length, question.answer.length)
  }, 0)
  const learnerGuidance = useCallback((instruction: string) => {
    const material = isReading
      ? [currentSet.passage, ...(currentSet.passages ?? []).map(({ title, text }) => `${title}\n${text}`)].filter(Boolean).join('\n\n')
      : [currentSet.audioScript, ...(currentSet.audioSections ?? []).map(({ title, script }) => `${title}\n${script}`)].filter(Boolean).join('\n\n')
    const activeQuestion = activeQuestionIndex === null ? undefined : currentSet.questions[activeQuestionIndex]
    const focusedAnswers = activeQuestion && activeQuestionIndex !== null
      ? answerSlots(activeQuestion, activeQuestionIndex).map((slot) => ({ prompt: slot.label, response: answers[slot.key] ?? '' }))
      : []
    const questionBank = currentSet.questions.map((question, index) => ({
      questionNumbers: `${questionNumberStarts[index]}–${questionNumberStarts[index] + questionMarkCount(question) - 1}`,
      ...question,
    }))
    const learnerQuestionContext = activeQuestionIndex === null
      ? 'No question is currently focused.'
      : JSON.stringify({
          questionNumber: questionNumberStarts[activeQuestionIndex],
          question: activeQuestion,
          learnerResponses: focusedAnswers,
        })
    return `You are a patient IELTS ${isReading ? 'Reading' : 'Listening'} tutor in ${product === 'readia' ? 'Readia' : 'Listenia'}. The learner is in AI-guided practice for "${currentSet.title}".\n${isReading ? 'Help them understand questions, locate relevant paragraphs, scan for evidence, distinguish stated facts from inference, and notice paraphrases.' : 'Help them predict likely information, notice signposting and paraphrases, identify key details, and recover missed information.'}\n${learnerGoal?.trim() ? `Personal learning goal: ${learnerGoal.trim()}. Adapt examples and next steps to this goal without losing focus on the active question.` : ''}\nYou have the complete verbatim source material and complete question set, including answer keys, explanations, and evidence. Use these details to answer any question the learner asks. Explain answers with exact source evidence and clarify reasoning; do not dump answers unprompted, but give a direct answer when explicitly requested. If the learner's reference is ambiguous, ask which question they mean. Be supportive, concise, and clear. This is practice, not an official IELTS assessment.\nComplete task source:\n${material}\nComplete question set:\n${JSON.stringify(questionBank)}\nCurrent focus and learner responses:\n${learnerQuestionContext}\nCurrent learner prompt: ${instruction}`
  }, [activeQuestionIndex, answers, currentSet, isReading, learnerGoal, product, questionNumberStarts])
  const live = useGeminiLive({
    apiKey,
    systemInstruction: learnerGuidance('The learner has started a live guided practice session. Welcome them and ask what they would like help with.'),
    openingPrompt: `Welcome the learner to ${isReading ? 'Readia reading' : 'Listenia listening'} guided practice for "${currentSet.title}". Briefly explain that you will help them use strategies rather than simply give answers, then ask what they would like help with.`,
  })
  const stopLiveSession = live.stop

  useEffect(() => {
    practiceStartedAt.current = Date.now()
  }, [])

  useEffect(() => {
    if (!topicExposureId) return
    void updateLocalTopicExposure(topicExposureId, 'started').catch((caughtError: unknown) => {
      console.error('Unable to update local topic exposure for this practice session.', caughtError)
      setError('This practice started, but its topic-use history could not be updated.')
    })
  }, [topicExposureId])

  const submitAnswers = useCallback((timeExpired = false) => {
    if (submissionStarted.current) return
    if (!answeredCount && !timeExpired) {
      setError('Answer at least one question before checking your result.')
      return
    }
    submissionStarted.current = true
    const attempt: SkillAttempt = {
      id: crypto.randomUUID(),
      username: username.trim().toLocaleLowerCase(),
      product,
      setId: currentSet.id,
      setVersion: 1,
      topicId: topicId ?? currentSet.id,
      title: currentSet.title,
      mode: practiceMode,
      score: score.score,
      total: score.total,
      questionTypeScores: scoreByQuestionType(currentSet.questions, answers),
      elapsedSeconds: practiceMode === 'exam'
        ? Math.min(currentSet.minutes * 60, Math.max(elapsedSeconds, Math.floor((Date.now() - practiceStartedAt.current) / 1000)))
        : Math.max(elapsedSeconds, Math.floor((Date.now() - practiceStartedAt.current) / 1000)),
      answers: { ...answers },
      completedAt: new Date().toISOString(),
    }
    setSubmitted(true)
    setExamStartedAt(null)
    setError('')
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    audioRequestIdRef.current += 1
    audioRef.current?.pause()
    setAudioState('idle')
    onCompleted?.(attempt)
    void saveSkillAttempt(attempt).catch((caughtError: unknown) => {
      console.error(`Unable to save ${product} practice history.`, caughtError)
      setError('Your result is shown, but this attempt could not be saved in this browser.')
    })
    if (topicExposureId) {
      void updateLocalTopicExposure(topicExposureId, 'completed').catch((caughtError: unknown) => {
        console.error('Unable to mark the local topic as completed.', caughtError)
        setError('Your result is saved, but the topic-use history could not be updated.')
      })
    }
    void deleteActiveSkillSession(activeSessionId).catch((caughtError: unknown) => {
      console.error('Unable to clear the completed active practice session.', caughtError)
      setError('Your result is saved, but the unfinished session could not be cleared.')
    })
  }, [activeSessionId, answers, answeredCount, currentSet, elapsedSeconds, onCompleted, practiceMode, product, score, topicExposureId, topicId, username])

  useEffect(() => {
    let active = true
    void loadActiveSkillSession<{ answers: Record<string, string>; elapsedSeconds: number; practiceMode: PracticeMode }>(activeSessionId).then((saved) => {
      if (!active) return
      if (saved) {
        setAnswers(saved.answers)
        setElapsedSeconds(saved.elapsedSeconds)
        setPracticeMode(saved.practiceMode)
        practiceStartedAt.current = Date.now() - saved.elapsedSeconds * 1000
        setExamStartedAt(saved.practiceMode === 'exam' ? Date.now() - saved.elapsedSeconds * 1000 : null)
      }
      setLoadedSessionId(activeSessionId)
    }).catch((caughtError: unknown) => {
      console.error('Unable to restore the active local practice session.', caughtError)
      if (active) {
        setError('Your previous practice session could not be restored.')
        setLoadedSessionId(activeSessionId)
      }
    })
    return () => { active = false }
  }, [activeSessionId])

  useEffect(() => {
    if (submitted || loadedSessionId !== activeSessionId) return
    const timeout = window.setTimeout(() => {
      void saveActiveSkillSession(activeSessionId, { answers, elapsedSeconds, practiceMode }).then(() => {
        sessionSaveFailureReported.current = false
      }).catch((caughtError: unknown) => {
        if (!sessionSaveFailureReported.current) {
          sessionSaveFailureReported.current = true
          console.error('Unable to save the active local practice session.', caughtError)
          setError('Your in-progress answers could not be saved locally. Check available browser storage.')
        }
      })
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [activeSessionId, answers, elapsedSeconds, loadedSessionId, practiceMode, submitted])

  useEffect(() => {
    if (examStartedAt === null || submitted || practiceMode !== 'exam') return
    const duration = currentSet.minutes * 60
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - examStartedAt) / 1000)
      setElapsedSeconds(Math.min(elapsed, duration))
      if (elapsed >= duration) submitAnswers(true)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [currentSet.minutes, examStartedAt, practiceMode, submitAnswers, submitted])

  useEffect(() => {
    if (submitted || practiceMode !== 'guided') return
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - practiceStartedAt.current) / 1000))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [practiceMode, submitted])

  useEffect(() => () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    audioRequestIdRef.current += 1
    audioRef.current?.pause()
    if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current)
  }, [])

  useEffect(() => () => {
    void stopLiveSession().catch((caughtError) => console.error(`Unable to cleanly end the ${product} tutor session.`, caughtError))
  }, [stopLiveSession, product])

  function chooseSet(setId: string) {
    onSelectedSetChange?.(setId)
    setSelectedSetId(setId)
    setAnswers({})
    setSubmitted(false)
    setError('')
    setShowTranscript(false)
    setActiveSectionIndex(0)
    setActiveQuestionIndex(null)
    setActiveQuestionNumber(null)
    setElapsedSeconds(0)
    practiceStartedAt.current = Date.now()
    setAudioPlayed(false)
    submissionStarted.current = false
    setExamStartedAt(practiceMode === 'exam' ? Date.now() : null)
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    audioRequestIdRef.current += 1
    audioRef.current?.pause()
    audioRef.current = null
    if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current)
    audioObjectUrlRef.current = null
    setAudioState('idle')
  }

  function startPractice(mode: PracticeMode, setId = currentSet.id) {
    chooseSet(setId)
    setPracticeMode(mode)
    setExamStartedAt(mode === 'exam' ? Date.now() : null)
    setElapsedSeconds(0)
    practiceStartedAt.current = Date.now()
  }

  function askCoach() {
    const question = coachQuestion.trim()
    if (!question || !live.connected) return
    const focusedQuestion = activeQuestionIndex === null ? undefined : currentSet.questions[activeQuestionIndex]
    const focusedResponses = focusedQuestion && activeQuestionIndex !== null
      ? answerSlots(focusedQuestion, activeQuestionIndex).map((slot) => `${slot.label}: ${answers[slot.key] || '(not answered)'}`).join('; ')
      : 'No question is selected.'
    live.sendText(`${question}\n\n[Current focus: ${focusedQuestion?.prompt ?? 'none'}; current responses: ${focusedResponses}]`)
    setCoachQuestion('')
  }

  async function toggleCoach() {
    setError('')
    if (live.connected) {
      await live.stop()
      return
    }
    if (!apiKey.trim()) {
      setError('Add your Prepia AI access key in Settings before starting live guided practice.')
      return
    }
    await live.start({
      systemInstruction: learnerGuidance(`The learner has started live guided practice for "${currentSet.title}".`),
      openingPrompt: `Welcome the learner to ${isReading ? 'Readia reading' : 'Listenia listening'} guided practice for "${currentSet.title}". Ask what they would like to understand, and offer to guide them through one practice question without revealing its answer straight away.`,
    })
  }

  async function playAudio() {
    const audioParts = currentSet.audioSections?.map(({ title, script }) => `${title}. ${script}`) ?? (currentSet.audioScript ? [currentSet.audioScript] : [])
    if (!currentSet.audioAssetId && (!audioParts.length || !('speechSynthesis' in window))) {
      setError('Audio playback is not available in this browser.')
      return
    }
    if (audioState === 'playing') {
      if (currentSet.audioAssetId) audioRef.current?.pause()
      else window.speechSynthesis.pause()
      setAudioState('paused')
      return
    }
    if (audioState === 'paused') {
      if (currentSet.audioAssetId) {
        try {
          await audioRef.current?.play()
        } catch (caughtError) {
          console.error('Unable to resume the generated listening audio.', caughtError)
          setError('The saved listening recording could not be resumed.')
          return
        }
      } else window.speechSynthesis.resume()
      setAudioState('playing')
      return
    }
    if (practiceMode === 'exam' && audioPlayed) {
      setError('The recording can be played once during exam simulation.')
      return
    }
    setError('')
    setAudioPlayed(true)
    if (currentSet.audioAssetId) {
      const requestId = ++audioRequestIdRef.current
      setAudioLoading(true)
      try {
        const asset = await loadLocalAudioAsset(currentSet.audioAssetId)
        if (requestId !== audioRequestIdRef.current) return
        if (!asset) throw new Error('The saved audio asset is missing from this browser.')
        if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current)
        const url = URL.createObjectURL(asset.audio)
        const player = new Audio(url)
        audioObjectUrlRef.current = url
        audioRef.current = player
        player.onended = () => setAudioState('idle')
        player.onerror = () => {
          setAudioState('idle')
          setAudioPlayed(false)
          setError('The saved listening recording could not be played.')
        }
        await player.play()
        setAudioState('playing')
      } catch (caughtError) {
        if (requestId !== audioRequestIdRef.current) return
        console.error('Unable to play the saved listening audio.', caughtError)
        setAudioState('idle')
        setAudioPlayed(false)
        setError(caughtError instanceof Error ? caughtError.message : 'The saved listening recording could not be played.')
      } finally {
        if (requestId === audioRequestIdRef.current) setAudioLoading(false)
      }
      return
    }
    setAudioState('playing')
    audioParts.forEach((part, index) => {
      const utterance = new SpeechSynthesisUtterance(part)
      utterance.lang = 'en-GB'
      utterance.rate = 0.92
      if (index === audioParts.length - 1) utterance.onend = () => setAudioState('idle')
      utterance.onerror = () => {
        setAudioState('idle')
        setAudioPlayed(false)
        setError('The listening audio could not be played. Try again or use a different browser.')
      }
      window.speechSynthesis.speak(utterance)
    })
  }

  return <div className={`literacy-page literacy-${product} ${currentSet.fullLength ? 'literacy-full-mock' : ''}`}>
    <section className="literacy-practice">
      <Card className="literacy-practice-toolbar">
        <label>Practice set<select value={currentSet.id} onChange={(event) => chooseSet(event.target.value)}>{sets.map((set) => <option key={set.id} value={set.id}>{set.title}</option>)}</select></label>
        <div><span className={`literacy-mode-badge literacy-mode-${practiceMode}`}>{practiceMode === 'exam' ? 'EXAM SIMULATION' : 'AI GUIDED PRACTICE'}</span>{practiceMode === 'exam' && <span className="literacy-countdown"><Clock3 size={15} /> {formatDuration(Math.max(0, currentSet.minutes * 60 - elapsedSeconds))}</span>}</div>
        <Button type="button" variant="outline" onClick={onExit}><X size={14} /> Exit</Button>
      </Card>
      <Card className="literacy-instructions">
        <div className="literacy-task-instructions"><span className="section-kicker">{isReading ? 'READING TASK' : 'LISTENING TASK'}</span><p>{currentSet.instructions}</p></div>
        {practiceMode === 'exam' && <p className="literacy-exam-note">{currentSet.fullLength ? `Full-length practice simulation · ${isReading ? '60' : '30'} minutes · ${score.total} marks. Unanswered questions are marked incorrect when time expires.` : 'Short, timed IELTS-style practice. This is not a full-length test.'}</p>}
        {!isReading && <div className="literacy-audio-controls">
          <Button type="button" variant="outline" disabled={audioLoading || (practiceMode === 'exam' && audioPlayed && audioState === 'idle')} onClick={() => void playAudio()}>{audioLoading ? <><LoaderCircle size={15} className="spin" /> Loading recording…</> : audioState === 'playing' ? <><VolumeX size={15} /> Pause</> : audioState === 'paused' ? <><Play size={15} /> Resume</> : <><Play size={15} /> {practiceMode === 'exam' ? 'Play recording once' : 'Play recording'}</>}</Button>
          <Button type="button" variant="outline" disabled={practiceMode === 'exam' && !submitted} onClick={() => setShowTranscript((visible) => !visible)}>{showTranscript ? 'Hide transcript' : practiceMode === 'exam' ? 'Review transcript after submission' : 'Show transcript'}</Button>
          <small className="literacy-audio-note">{currentSet.audioAssetId ? 'Prepia-generated practice recording; not official IELTS audio.' : 'Practice speech is browser-generated and is not official IELTS audio.'}</small>
        </div>}
      </Card>
      {currentSet.fullLength && currentSet.examSections && <nav className="literacy-section-navigation" aria-label={`${isReading ? 'Passage' : 'Listening'} navigation`}>
        {currentSet.examSections.map((section, index) => {
          const firstQuestion = questionNumberStarts[section.questionStartIndex] ?? score.total
          const lastQuestion = questionNumberStarts[section.questionEndIndex]
            ? questionNumberStarts[section.questionEndIndex] - 1
            : score.total
          return <button key={section.title} type="button" className={index === activeSectionIndex ? 'literacy-section-active' : ''} aria-current={index === activeSectionIndex ? 'step' : undefined} onClick={() => {
            setActiveSectionIndex(index)
            setActiveQuestionIndex(section.questionStartIndex)
            setActiveQuestionNumber(questionNumberStarts[section.questionStartIndex] ?? null)
          }}>
            <span>{section.title}</span><small>Questions {firstQuestion}–{lastQuestion}</small>
          </button>
        })}
      </nav>}
      {!isReading && showTranscript && (currentSet.audioScript || currentSet.audioSections) && <Card className="literacy-passage literacy-transcript"><span className="section-kicker">LISTENING TRANSCRIPT · REVIEW AFTER YOUR FIRST LISTEN</span>{currentSet.audioSections ? currentSet.audioSections.map((section, index) => <div key={`${currentSet.id}-transcript-${index}`}><h2>{section.title}</h2><p>{section.script}</p></div>) : <p>{currentSet.audioScript}</p>}</Card>}
      <div className={currentSet.fullLength && isReading ? 'literacy-mock-layout literacy-mock-reading' : 'literacy-mock-layout'}>
        {isReading && (currentSet.passages?.[activeSectionIndex] || currentSet.passage) && <Card className="literacy-passage literacy-mock-material">
          <span className="section-kicker">{currentSet.fullLength ? `READING ${activeSection?.title.toLocaleUpperCase() ?? ''}` : 'PASSAGE'}</span>
          <h2>{activePassage?.title ?? currentSet.title}</h2>
          {(activePassage?.text ?? currentSet.passage ?? '').split('\n\n').map((paragraph, index) => <p key={`${currentSet.id}-${activeSectionIndex}-${index}`}>{paragraph}</p>)}
        </Card>}
        <div className="literacy-question-list">
          {visibleQuestionIndices.map((index) => <SkillQuestionCard key={`${currentSet.id}-${index}`} question={currentSet.questions[index]} questionIndex={index} firstQuestionNumber={questionNumberStarts[index]} answers={answers} submitted={submitted} active={activeQuestionIndex === index} onQuestionFocus={(questionIndex) => {
            setActiveQuestionIndex(questionIndex)
            setActiveQuestionNumber(questionNumberStarts[questionIndex] ?? null)
          }} onAnswer={(key, value) => setAnswers((current) => ({ ...current, [key]: value }))} />)}
        </div>
      </div>
      {practiceMode === 'guided' && <Card className="literacy-coach"><div className="literacy-coach-heading"><div><span className={`literacy-coach-dot ${live.connected ? 'literacy-coach-live' : ''}`} /><div><span className="section-kicker">LIVE READING &amp; LISTENING TUTOR</span><h2>{live.connected ? 'Your tutor is listening' : 'Ask for realtime guidance'}</h2></div></div><Button type="button" onClick={() => void toggleCoach()} disabled={live.connecting}>{live.connecting ? <><LoaderCircle size={14} className="spin" /> Connecting…</> : live.connected ? <><MicOff size={14} /> End tutor session</> : <><Mic size={14} /> Start live tutor</>}</Button></div>{!apiKey.trim() && <p>Add your Prepia AI access key in Settings before starting a live session. <button type="button" onClick={onOpenSettings}>Open Settings</button></p>}{live.error && <p className="literacy-error" role="alert">{live.error}</p>}{live.connected && <><div className="literacy-coach-transcript">{live.transcript.slice(-6).map((turn) => <article key={turn.id} className={`literacy-coach-turn literacy-coach-${turn.role}`}><span>{turn.role === 'candidate' ? 'YOU' : `${isReading ? 'READIA' : 'LISTENIA'} TUTOR`}</span><p>{turn.text}</p></article>)}</div><form className="literacy-coach-input" onSubmit={(event) => { event.preventDefault(); askCoach() }}><input aria-label="Ask the live tutor a question" value={coachQuestion} onChange={(event) => setCoachQuestion(event.target.value)} placeholder={`Ask about this ${isReading ? 'passage or question' : 'listening task'}…`} /><Button type="submit" disabled={!coachQuestion.trim()}><Send size={14} /> Send</Button><Button type="button" variant="outline" aria-label={live.micMuted ? 'Unmute microphone' : 'Mute microphone'} onClick={live.toggleMicMuted}>{live.micMuted ? <Mic size={14} /> : <MicOff size={14} />}</Button></form></>}</Card>}
      {submitted && <Card className="literacy-result"><div><span className="section-kicker">TEST COMPLETE</span><h2>{score.score} / {score.total}</h2><p>{score.score === score.total ? 'Excellent accuracy—keep checking each answer against the available evidence.' : 'Review the explanations, then try the set again to strengthen accuracy.'}</p></div><div><Button type="button" variant="outline" onClick={() => startPractice(practiceMode)}><RotateCcw size={14} /> Try again</Button><Button type="button" onClick={onOpenProgress}>View progress <ArrowRight size={14} /></Button></div></Card>}
      {error && <p className="literacy-error" role="alert">{error}</p>}
      {!submitted && <div className="literacy-submit"><span>{answeredCount} of {score.total} marks attempted{practiceMode === 'exam' && elapsedSeconds >= currentSet.minutes * 60 ? ' · Time is up' : ''}</span><Button type="button" onClick={() => submitAnswers()}>{practiceMode === 'exam' ? 'Finish and review' : 'Check answers'} <ArrowRight size={14} /></Button></div>}
      {currentSet.fullLength && !submitted && <nav className="literacy-question-navigation" aria-label="Jump to question">
        <div><strong>Questions</strong><span>{answeredCount} of {score.total} answered</span></div>
        {currentSet.examSections && <div className="literacy-question-parts" role="group" aria-label="Test parts">
          {currentSet.examSections.map((section, index) => {
                const sectionQuestions = questionNavigation.filter((item) => item.questionIndex >= section.questionStartIndex && item.questionIndex < section.questionEndIndex)
                const firstQuestion = sectionQuestions[0]?.number ?? 0
                const lastQuestion = sectionQuestions.at(-1)?.number ?? firstQuestion
                return <button type="button" className={`literacy-part-anchor ${index === activeSectionIndex ? 'literacy-part-active' : ''}`} key={section.title} aria-current={index === activeSectionIndex ? 'location' : undefined} onClick={() => {
                    setActiveSectionIndex(index)
                    setActiveQuestionIndex(section.questionStartIndex)
                    setActiveQuestionNumber(firstQuestion)
                  }}>{section.title || `Part ${index + 1}`}<small>{firstQuestion}–{lastQuestion}</small></button>
              })}
        </div>}
        <div className="literacy-question-navigation-row">
          {questionNavigation.map((item) => <button type="button" key={item.number} data-answered={item.answered} aria-label={`Go to question ${item.number}${item.answered ? ', answered' : ', unanswered'}`} aria-current={item.number === (activeQuestionNumber ?? questionNavigation[0]?.number) ? 'true' : undefined} onClick={() => {
            const sectionIndex = currentSet.examSections?.findIndex((section) => item.questionIndex >= section.questionStartIndex && item.questionIndex < section.questionEndIndex) ?? -1
            if (sectionIndex >= 0) setActiveSectionIndex(sectionIndex)
            setActiveQuestionIndex(item.questionIndex)
            setActiveQuestionNumber(item.number)
          }}>{item.number}</button>)}
        </div>
      </nav>}
    </section>
    <p className="literacy-disclaimer">Original IELTS-style practice for learning. These are not official IELTS questions or scores.</p>
  </div>
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, seconds)
  return `${Math.floor(safeSeconds / 60).toString().padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`
}
