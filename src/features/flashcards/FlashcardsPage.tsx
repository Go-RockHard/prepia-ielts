import { useEffect, useMemo, useState } from 'react'
import { GoogleGenAI } from '@/lib/geminiClient'
import { getProdiaTextModel } from '@/lib/geminiModels'
import { createEmptyCard, fsrs, Rating, State, type Grade } from 'ts-fsrs'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Flame,
  Layers3,
  Lightbulb,
  LoaderCircle,
  RotateCcw,
  Search,
  Sparkles,
  Volume2,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fromFsrsCard, loadFlashcardProgress, saveFlashcardProgress, toFsrsCard, type FlashcardProduct, type FlashcardProgress } from './storage'
import { vocabularyMemory } from './memoryStrength'

const NEW_CARDS_PER_DAY = 20
const scheduler = fsrs({
  request_retention: 0.9,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
})

const ratings = [
  { rating: Rating.Again, label: 'Again', shortcut: '1', className: 'flashcard-rating-again' },
  { rating: Rating.Hard, label: 'Hard', shortcut: '2', className: 'flashcard-rating-hard' },
  { rating: Rating.Good, label: 'Good', shortcut: '3', className: 'flashcard-rating-good' },
  { rating: Rating.Easy, label: 'Easy', shortcut: '4', className: 'flashcard-rating-easy' },
] as const

interface SessionRating {
  again: number
  hard: number
  good: number
  easy: number
}

export interface FlashcardEntry {
  id: string
  term: string
  category: string
  meaning: string
  example: string
  topic: string
  partOfSpeech?: string
  meanings?: string[]
  examples?: string[]
  sampleQuestions?: string[]
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatInterval(due: Date, now = new Date()): string {
  const minutes = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.max(1, Math.round(hours / 24))
  if (days < 30) return `${days}d`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo`
  return `${(days / 365).toFixed(1)}y`
}

function meaningsFor(entry: FlashcardEntry): string[] {
  return entry.meanings?.length ? entry.meanings : [entry.meaning]
}

function examplesFor(entry: FlashcardEntry): string[] {
  return entry.examples?.length ? entry.examples : [entry.example]
}

function makeSession(entries: FlashcardEntry[], progress: FlashcardProgress[], now: Date): string[] {
  const progressById = new Map(progress.map((item) => [item.sourceId, item]))
  const dueIds = entries
    .filter((entry) => {
      const card = progressById.get(entry.id)
      return card && Date.parse(card.due) <= now.getTime()
    })
    .sort((left, right) => Date.parse(progressById.get(left.id)?.due ?? '') - Date.parse(progressById.get(right.id)?.due ?? ''))
    .map((entry) => entry.id)
  const entryIds = new Set(entries.map((entry) => entry.id))
  const activeProgress = progress.filter((item) => entryIds.has(item.sourceId))
  const introducedToday = activeProgress.filter((item) => item.introducedAt && localDateKey(new Date(item.introducedAt)) === localDateKey(now)).length
  const remainingNewLimit = Math.max(0, NEW_CARDS_PER_DAY - introducedToday)
  const newIds = entries
    .filter((entry) => !progressById.has(entry.id))
    .slice(0, remainingNewLimit)
    .map((entry) => entry.id)
  return [...dueIds, ...newIds]
}

export function FlashcardsPage({ username, entries, savedIds, apiKey, onOpenSettings, onOpenLexis, product = 'speakia', showSavedFilter = true }: {
  username: string
  entries: FlashcardEntry[]
  savedIds: string[]
  apiKey: string
  onOpenSettings: () => void
  onOpenLexis: () => void
  product?: FlashcardProduct
  showSavedFilter?: boolean
}) {
  const isWritia = product === 'writia'
  const brand = isWritia ? 'Writia' : 'Speakia'
  const vocabularySource = isWritia ? 'Topics & Vocabulary' : 'Lexical Vault'
  const loaded = useMemo(() => loadFlashcardProgress(username, product), [product, username])
  const [progress, setProgress] = useState<FlashcardProgress[]>(loaded.items)
  const [storageError, setStorageError] = useState(loaded.error)
  const [now, setNow] = useState(() => new Date())
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('All topics')
  const [category, setCategory] = useState('All')
  const [savedOnly, setSavedOnly] = useState(false)
  const [sessionIds, setSessionIds] = useState<string[] | null>(null)
  const [sessionIndex, setSessionIndex] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)
  const [sessionRatings, setSessionRatings] = useState<SessionRating>({ again: 0, hard: 0, good: 0, easy: 0 })
  const [aiExample, setAiExample] = useState('')
  const [aiExampleFor, setAiExampleFor] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const topics = useMemo(() => [...new Set(entries.map((entry) => entry.topic).filter(Boolean))].sort((left, right) => left.localeCompare(right)), [entries])
  const categories = useMemo(() => ['All', ...new Set(entries.map((entry) => entry.category).filter(Boolean).sort((left, right) => left.localeCompare(right)))], [entries])
  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    return entries.filter((entry) => {
      if (topic !== 'All topics' && entry.topic !== topic) return false
      if (category !== 'All' && entry.category !== category) return false
      if (savedOnly && !savedIds.includes(entry.id)) return false
      if (!normalizedSearch) return true
      return [entry.term, entry.meaning, entry.example, entry.topic, entry.category, entry.partOfSpeech ?? '',
        ...meaningsFor(entry), ...examplesFor(entry)]
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
    })
  }, [category, entries, savedIds, savedOnly, search, topic])

  const progressById = useMemo(() => new Map(progress.map((item) => [item.sourceId, item])), [progress])
  const dueCount = filteredEntries.filter((entry) => {
    const card = progressById.get(entry.id)
    return card && Date.parse(card.due) <= now.getTime()
  }).length
  const newCount = filteredEntries.filter((entry) => !progressById.has(entry.id)).length
  const entryIds = new Set(entries.map((entry) => entry.id))
  const activeProgress = progress.filter((item) => entryIds.has(item.sourceId))
  const introducedToday = progress.filter((item) => entryIds.has(item.sourceId) && item.introducedAt && localDateKey(new Date(item.introducedAt)) === localDateKey(now)).length
  const availableNewCount = Math.min(newCount, Math.max(0, NEW_CARDS_PER_DAY - introducedToday))
  const masteredCount = activeProgress.filter((item) => item.state === State.Review && item.scheduled_days >= 21).length
  const currentEntry = sessionIds ? entries.find((entry) => entry.id === sessionIds[sessionIndex]) : undefined
  const isSessionComplete = Boolean(sessionIds && sessionIndex >= sessionIds.length)
  const fsrsCard = currentEntry ? progressById.get(currentEntry.id) : undefined
  const currentFsrsCard = fsrsCard ? toFsrsCard(fsrsCard) : createEmptyCard(now)
  const previews = currentEntry && isRevealed
    ? scheduler.repeat(currentFsrsCard, now)
    : null
  const sessionCompleted = sessionRatings.again + sessionRatings.hard + sessionRatings.good + sessionRatings.easy

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  function startSession() {
    const currentTime = new Date()
    setNow(currentTime)
    const queue = makeSession(filteredEntries, progress, currentTime)
    if (!queue.length) return
    setSessionIds(queue)
    setSessionIndex(0)
    setIsRevealed(false)
    setSessionRatings({ again: 0, hard: 0, good: 0, easy: 0 })
    setAiExample('')
    setAiExampleFor('')
    setAiError('')
  }

  function endSession() {
    setSessionIds(null)
    setSessionIndex(0)
    setIsRevealed(false)
    setAiExample('')
    setAiExampleFor('')
    setAiError('')
  }

  function rateCard(rating: Grade) {
    if (!currentEntry) return
    const reviewedAt = now
    const existing = progressById.get(currentEntry.id)
    const before = existing ? toFsrsCard(existing) : createEmptyCard(reviewedAt)
    const result = scheduler.next(before, reviewedAt, rating)
    const nextCard = fromFsrsCard(currentEntry.id, result.card, rating, reviewedAt)
    nextCard.introducedAt = existing?.introducedAt ?? reviewedAt.toISOString()
    const nextProgress = [
      ...progress.filter((item) => item.sourceId !== currentEntry.id),
      nextCard,
    ]
    const saveError = saveFlashcardProgress(username, nextProgress, product)
    if (saveError) {
      setStorageError(saveError)
      return
    }
    setProgress(nextProgress)
    setStorageError('')
    const ratingKey = rating === Rating.Again ? 'again' : rating === Rating.Hard ? 'hard' : rating === Rating.Good ? 'good' : 'easy'
    setSessionRatings((current) => ({ ...current, [ratingKey]: current[ratingKey] + 1 }))
    setSessionIndex((current) => current + 1)
    setIsRevealed(false)
    setAiExample('')
    setAiExampleFor('')
    setAiError('')
  }

  async function generateExample(entry: FlashcardEntry) {
    if (!apiKey.trim()) {
      setAiError(`Add your shared AI service key to create a personalized ${isWritia ? 'writing' : 'speaking'} example.`)
      return
    }
    setAiLoading(true)
    setAiError('')
    try {
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const response = await client.models.generateContent({
        model: getProdiaTextModel(),
        contents: [{
          role: 'user',
          parts: [{
            text: isWritia
              ? `Create one natural, concise IELTS Writing example (one or two sentences) about "${entry.topic}". Use the vocabulary item "${entry.term}" accurately and naturally. Meaning: ${meaningsFor(entry).join('; ')}. Category: ${entry.category}. Use an appropriate academic or formal register, and do not invent statistics or evidence. Return only the example sentence(s).`
              : `Create one natural, concise IELTS Speaking practice answer (2–3 sentences) about "${entry.topic}". Use the vocabulary item "${entry.term}" accurately and naturally. Meaning: ${meaningsFor(entry).join('; ')}. Category: ${entry.category}. Make it sound like a real candidate, not a memorized essay. Then add one short follow-up question for the learner to answer using the same item. Return only the answer and question, clearly separated.`,
          }],
        }],
      })
      if (!response.text?.trim()) throw new Error(`${brand} AI returned an empty ${isWritia ? 'writing' : 'speaking'} example. Please try again.`)
      setAiExample(response.text.trim())
      setAiExampleFor(entry.id)
    } catch (error) {
      console.error(`Unable to generate an AI ${isWritia ? 'writing' : 'speaking'} example for this flashcard.`, error)
      setAiError(error instanceof Error ? error.message : `The AI ${isWritia ? 'writing' : 'speaking'} example could not be generated.`)
    } finally {
      setAiLoading(false)
    }
  }

  function speakTerm(term: string) {
    if (!('speechSynthesis' in window)) {
      setStorageError('Audio pronunciation is not supported in this browser.')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(term)
    utterance.lang = 'en-US'
    utterance.rate = 0.88
    window.speechSynthesis.speak(utterance)
  }

  if (sessionIds && !isSessionComplete && currentEntry) {
    return (
      <div className={`page-content inner-page flashcards-page flashcards-study-page ${isWritia ? 'writa-flashcards-page' : ''}`}>
        <div className="flashcards-study-topbar">
          <Button variant="ghost" onClick={endSession}><ArrowLeft size={16} /> Exit session</Button>
          <div className="flashcards-session-progress"><span>REVIEW SESSION</span><strong>{sessionIndex + 1}<small> / {sessionIds.length}</small></strong></div>
          <span className="flashcards-session-due"><Clock3 size={14} /> {Math.max(0, sessionIds.length - sessionIndex)} cards left in session</span>
        </div>
        {storageError && <p className="flashcards-alert" role="alert">{storageError}</p>}
        <div className="flashcards-study-heading"><p className="eyebrow">{currentEntry.topic} <span>·</span> {currentEntry.category}</p><h1>Recall the meaning</h1><p>{isWritia ? 'Recall the meaning and how to use it in a writing task. Then reveal the answer.' : 'Say it aloud if you can. Then reveal the answer to check your recall.'}</p></div>
        <Card className={`flashcards-card ${isRevealed ? 'flashcards-card-revealed' : ''}`}>
          <div className="flashcards-card-topline"><span>{currentEntry.topic}</span><span>{fsrsCard ? 'SCHEDULED REVIEW' : 'NEW WORD'}</span></div>
          <div className="flashcards-card-front">
            <div className="flashcards-term-row"><h2>{currentEntry.term}</h2><button type="button" className="flashcards-pronounce" onClick={() => speakTerm(currentEntry.term)} aria-label={`Hear pronunciation of ${currentEntry.term}`} title="Hear pronunciation"><Volume2 size={19} /></button></div>
            {currentEntry.partOfSpeech && <span className="flashcards-part-of-speech">{currentEntry.partOfSpeech}</span>}
            <p className="flashcards-recall-prompt">What does this mean, and how could you use it in an IELTS {isWritia ? 'Writing task' : 'Speaking answer'}?</p>
            {!isRevealed && <Button className="flashcards-reveal-button" onClick={() => setIsRevealed(true)}>Reveal answer <ArrowRight size={15} /></Button>}
          </div>
          {isRevealed && <div className="flashcards-card-back">
            <div className="flashcards-definition"><span>MEANING</span>{meaningsFor(currentEntry).map((meaning, index) => <p key={`${index}-${meaning}`}>{meaning}</p>)}</div>
            <div className="flashcards-example"><span>IN CONTEXT</span>{examplesFor(currentEntry).map((example, index) => <p key={`${index}-${example}`}>{example}</p>)}</div>
            {!isWritia && currentEntry.sampleQuestions?.length ? <div className="flashcards-speaking-prompt"><span>TRY IT IN A RESPONSE</span><p>{currentEntry.sampleQuestions[0]}</p></div> : null}
            {aiExampleFor === currentEntry.id && aiExample && <div className="flashcards-ai-example"><span><Sparkles size={13} /> {brand.toUpperCase()} AI {isWritia ? 'WRITING' : 'SPEAKING'} EXAMPLE</span><p>{aiExample}</p></div>}
            {aiError && <div className="flashcards-ai-error"><p className="flashcards-alert" role="alert">{aiError}</p>{!apiKey.trim() && <Button variant="outline" size="sm" onClick={onOpenSettings}>Open Settings</Button>}</div>}
            <Button variant="outline" className="flashcards-ai-button" disabled={aiLoading} onClick={() => void generateExample(currentEntry)}>
              {aiLoading ? <LoaderCircle className="spin-icon" size={15} /> : <Sparkles size={15} />}
              {aiLoading ? `Creating ${isWritia ? 'writing' : 'speaking'} example…` : aiExampleFor === currentEntry.id ? 'Try another AI example' : !apiKey.trim() ? 'Add API key for AI examples' : `Create an AI ${isWritia ? 'writing' : 'speaking'} example`}
            </Button>
          </div>}
          {isRevealed && previews && <div className="flashcards-rating-panel">
            <p>How well did you remember it?</p>
            <div className="flashcards-rating-grid">
              {ratings.map((option) => <button type="button" key={option.rating} className={`flashcards-rating ${option.className}`} onClick={() => rateCard(option.rating)}>
                <strong>{option.label}</strong><small>{formatInterval(previews[option.rating].card.due, now)}</small><kbd>{option.shortcut}</kbd>
              </button>)}
            </div>
            <small className="flashcards-rating-note">FSRS schedules the next review from your recall and review history.</small>
          </div>}
        </Card>
        <div className="flashcards-study-footer"><span><Layers3 size={14} /> {currentEntry.category} <i /> {currentEntry.topic}</span><span>Press a rating to continue</span></div>
      </div>
    )
  }

  if (isSessionComplete) {
    return (
      <div className={`page-content inner-page flashcards-page ${isWritia ? 'writa-flashcards-page' : ''}`}>
        <div className="flashcards-complete">
          <span className="flashcards-complete-icon"><Check size={27} /></span>
          <p className="eyebrow">SESSION COMPLETE</p>
          <h1>Good work. Your memory is stronger.</h1>
          <p className="flashcards-complete-copy">You reviewed {sessionCompleted} {sessionCompleted === 1 ? 'card' : 'cards'}. FSRS has scheduled your next reviews based on how confidently you recalled each item.</p>
          <div className="flashcards-session-results">
            {ratings.map((option) => {
              const key = option.rating === Rating.Again ? 'again' : option.rating === Rating.Hard ? 'hard' : option.rating === Rating.Good ? 'good' : 'easy'
              return <div key={option.rating}><span>{option.label}</span><strong>{sessionRatings[key]}</strong></div>
            })}
          </div>
          <div className="flashcards-complete-actions"><Button className="start-button" onClick={endSession}>Back to overview</Button>{(dueCount > 0 || availableNewCount > 0) && <Button variant="outline" onClick={startSession}><RotateCcw size={15} /> Start another session</Button>}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`page-content inner-page flashcards-page ${isWritia ? 'writa-flashcards-page' : ''}`}>
      <div className="inner-page-heading">
      <div><p className="eyebrow">REMEMBER THE WORDS THAT RAISE YOUR BAND</p><h1>{brand} Flashcards</h1><p className="page-subtitle">{isWritia ? 'Build lasting IELTS Writing vocabulary with FSRS-powered review, writing examples, and vocabulary from Topics & Vocabulary.' : 'Build lasting IELTS vocabulary with intelligent, FSRS-powered review and examples from your Lexical Vault.'}</p></div>
        <Button className="start-button" onClick={startSession} disabled={!dueCount && !availableNewCount}><Zap size={16} /> {dueCount ? 'Start review' : availableNewCount ? 'Learn new words' : 'All caught up'}</Button>
      </div>

      {storageError && <p className="flashcards-alert" role="alert">{storageError}</p>}
      <section className="flashcards-hero" aria-label="Flashcards review overview">
        <div className="flashcards-hero-copy">
          <Badge className="flashcards-hero-badge"><Sparkles size={13} /> FREE SPACED REPETITION</Badge>
          <h2>Small sessions.<br /><em>Lasting recall.</em></h2>
          <p>Review words just before you’re likely to forget them. Every answer helps FSRS choose a smarter next review.</p>
          <Button className="flashcards-hero-cta" onClick={startSession} disabled={!dueCount && !availableNewCount}>
            {dueCount ? `Review ${dueCount} due ${dueCount === 1 ? 'card' : 'cards'}` : availableNewCount ? `Study ${availableNewCount} new cards` : 'You’re up to date'}
            {dueCount || availableNewCount ? <ArrowRight size={15} /> : <Check size={15} />}
          </Button>
        </div>
        <div className="flashcards-hero-art" aria-hidden="true"><div className="flashcards-art-orbit" /><div className="flashcards-art-card flashcards-art-card-back"><BookOpen size={23} /><span>MEANING</span><i /></div><div className="flashcards-art-card flashcards-art-card-front"><span>IELTS {isWritia ? 'WRITING' : 'VOCABULARY'}</span><strong>{isWritia ? 'substantiate' : 'articulate'}</strong><small>{isWritia ? 'support a point with evidence' : 'express ideas clearly'}</small></div><span className="flashcards-art-sparkle"><Sparkles size={20} /></span></div>
      </section>

      <section className="flashcards-stat-grid" aria-label="Flashcard study progress">
        <Card className="flashcards-stat-card"><span className="flashcards-stat-icon flashcards-stat-due"><Clock3 size={17} /></span><div><strong>{dueCount}</strong><span>Due for review</span><small>Ready when you are</small></div></Card>
        <Card className="flashcards-stat-card"><span className="flashcards-stat-icon flashcards-stat-new"><Layers3 size={17} /></span><div><strong>{newCount}</strong><span>New in this deck</span><small>Up to {NEW_CARDS_PER_DAY} new per day</small></div></Card>
        <Card className="flashcards-stat-card"><span className="flashcards-stat-icon flashcards-stat-mastered"><Flame size={17} /></span><div><strong>{masteredCount}</strong><span>Long-term memory</span><small>21+ day FSRS interval</small></div></Card>
        <Card className="flashcards-stat-card"><span className="flashcards-stat-icon flashcards-stat-vault"><BookOpen size={17} /></span><div><strong>{entries.length}</strong><span>{isWritia ? 'Writing vocabulary cards' : 'Lexis &amp; Topics cards'}</span><small>Synced from {vocabularySource}</small></div></Card>
      </section>

      <div className="flashcards-workspace">
        <section className="flashcards-deck-panel">
          <div className="flashcards-section-heading"><div><p className="section-kicker">PERSONALIZE YOUR SESSION</p><h2>Choose your vocabulary</h2></div><span>{filteredEntries.length} cards</span></div>
          <label className="flashcards-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a word, meaning, or example" aria-label="Search flashcards" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search">×</button>}</label>
          <label className="flashcards-filter-label">IELTS topic<select value={topic} onChange={(event) => setTopic(event.target.value)}><option>All topics</option>{topics.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label>
          <div className="flashcards-categories" role="group" aria-label="Filter by lexical category">{categories.map((item) => <button type="button" key={item} className={category === item ? 'flashcards-category-active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
          {showSavedFilter && <label className="flashcards-saved-filter"><input type="checkbox" checked={savedOnly} onChange={(event) => setSavedOnly(event.target.checked)} /><span>Review saved Lexical Vault words only</span><Badge>{savedIds.length}</Badge></label>}
          <div className="flashcards-deck-footer"><span>{dueCount} due <i /> {newCount} new</span><Button className="start-button" onClick={startSession} disabled={!dueCount && !availableNewCount}>{dueCount ? 'Start review' : availableNewCount ? 'Study new cards' : 'All caught up'} <ArrowRight size={14} /></Button></div>
        </section>
        <aside className="flashcards-method-panel">
          <span className="flashcards-method-icon"><Lightbulb size={19} /></span>
          <p className="section-kicker">WHY SPACED REPETITION?</p>
          <h2>Review at the right moment.</h2>
          <p>FSRS (Free Spaced Repetition Scheduler) adapts each review interval to your recall. “Again” brings a card back soon; confident answers earn longer gaps.</p>
          <div className="flashcards-method-divider" />
          <div className="flashcards-method-note"><Sparkles size={15} /><span>{isWritia ? 'Create a concise AI writing example to see how each term works in context.' : 'Need a real speaking example? Ask Speakia AI for a fresh response that uses the word naturally.'}</span></div>
          <button className="flashcards-vault-link" onClick={onOpenLexis}>{isWritia ? 'Manage writing vocabulary in Topics & Vocabulary' : 'Manage vocabulary in Lexis & Topics'} <ArrowRight size={14} /></button>
        </aside>
      </div>

      <section className="flashcards-preview-section">
        <div className="flashcards-section-heading"><div><p className="section-kicker">YOUR DECK PREVIEW</p><h2>Vocabulary in this session</h2></div><span>First {Math.min(filteredEntries.length, 8)} of {filteredEntries.length}</span></div>
        {filteredEntries.length
          ? <div className="flashcards-preview-grid">{filteredEntries.slice(0, 8).map((entry) => {
            const cardProgress = progressById.get(entry.id)
            const memory = vocabularyMemory(cardProgress, now)
            return <Card className={`flashcards-preview-card flashcards-memory-${memory.level}`} key={entry.id}><div><Badge>{entry.category}</Badge><span className="flashcards-preview-topic">{entry.topic}</span></div><strong>{entry.term}</strong><p>{meaningsFor(entry)[0]}</p><div className="flashcards-memory-indicator" title={`${memory.label}${memory.reviewed ? ` · estimated recall ${Math.round(memory.score * 100)}%` : ' · study this card to build recall'}`}><span className={`lexical-memory-status-dot memory-${memory.level}`} /><span>{memory.label}</span><div className="lexical-memory-meter" role="meter" aria-label={`${entry.term} estimated memory strength`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(memory.score * 100)}><i style={{ width: `${memory.score * 100}%` }} /></div></div><small>{cardProgress ? `Next review ${new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(cardProgress.due))}` : 'New card · ready to learn'}</small></Card>
          })}</div>
          : <Card className="flashcards-empty-deck"><BookOpen size={23} /><h3>No vocabulary matches these filters.</h3><p>Choose another topic or category, or add vocabulary in {vocabularySource}.</p><Button variant="outline" onClick={onOpenLexis}>Open {vocabularySource} <ArrowRight size={14} /></Button></Card>}
      </section>
    </div>
  )
}
