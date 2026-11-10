import { useEffect, useMemo, useState } from 'react'
import { Type } from '@google/genai'
import { GoogleGenAI } from '@/lib/geminiClient'
import { getProdiaTextModel } from '@/lib/geminiModels'
import { Activity, BookOpen, Check, ChevronDown, Clock3, Headphones, ListFilter, LoaderCircle, MessageCircle, Mic2, Play, Plus, Radio, Search, Sparkles, Square, Timer, Trash2, Waves, WandSparkles, X } from 'lucide-react'
import { useAiToAiSimulation } from './useAiToAiSimulation'
import { loadAiSimulationAudio } from './storage'
import { shareAudioWithCoach } from '@/features/assistant/audioSharing'
import { SpeechHighlight } from '@/features/simulator/SpeechHighlight'
import { cueCardTopics, generateAndSaveCueCard, useGeneratedCueCards } from '@/features/simulator/cueCards'
import { transcriptPositionAtTime, wordIndexAtElapsed } from '@/features/simulator/speechTiming'
import { useLexicalSessionCapture } from '@/features/vault/useLexicalSessionCapture'
import type { AiSimulationPart, AiSimulationRecord } from './types'
import type { LexicalEntry } from '@/features/vault/lexicalEntries'

interface CueCardTopic {
  id: string
  title: string
  cueCard: string
  source: 'suggested' | 'custom' | 'ai' | 'generated'
}

const CUE_CARD_STORAGE_KEY = 'speakia-ai-simulation-cue-cards-v1'

const suggestedCueCards: CueCardTopic[] = cueCardTopics.map((card) => ({ ...card, source: 'suggested' }))

function loadCustomCueCards(): CueCardTopic[] {
  try {
    const raw = localStorage.getItem(CUE_CARD_STORAGE_KEY)
    if (!raw) return []
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'object' && item !== null
      && typeof item.id === 'string' && typeof item.title === 'string'
      && typeof item.cueCard === 'string' && (item.source === 'custom' || item.source === 'ai'))) {
      throw new Error('Saved cue cards are not in a supported format.')
    }
    return value as CueCardTopic[]
  } catch (error) {
    console.error('Unable to load custom AI simulation cue cards.', error)
    return []
  }
}

const formats: { part: AiSimulationPart; title: string; label: string; description: string; duration: string; icon: typeof MessageCircle; tone: string }[] = [
  { part: 'part1', title: 'Part 1', label: 'Familiar topics', description: 'Warm-up questions about everyday life, your routines, home, work, or study.', duration: '5 questions · 4–6 min', icon: MessageCircle, tone: 'green' },
  { part: 'part2', title: 'Part 2', label: 'Long turn', description: 'An examiner-led cue card, preparation pause, long turn, and a short follow-up.', duration: 'Cue card · 3–4 min', icon: Timer, tone: 'amber' },
  { part: 'part3', title: 'Part 3', label: 'Discussion', description: 'Broader questions that explore opinions, causes, change, and future possibilities.', duration: '5 questions · 5–7 min', icon: Waves, tone: 'blue' },
  { part: 'full', title: 'Full test', label: 'Complete simulation', description: 'A continuous three-part test with five Part 1 questions, a Part 2 long turn, and five Part 3 questions.', duration: 'All 3 parts · 10–14 min', icon: Radio, tone: 'coral' },
]

type PartFilter = 'all' | AiSimulationPart
type StatusFilter = 'all' | 'completed' | 'stopped'

function partName(part: AiSimulationPart): string {
  return part === 'full' ? 'Full test' : `Part ${part.slice(-1)}`
}

function durationLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return minutes ? `${minutes}m ${String(remainder).padStart(2, '0')}s` : `${remainder}s`
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function SimulationAudio({ username, simulation, onTimeUpdate }: { username: string; simulation: AiSimulationRecord; onTimeUpdate: (time: number, duration: number) => void }) {
  const [url, setUrl] = useState('')
  const [audio, setAudio] = useState<Blob | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let current = true
    let objectUrl = ''
    void loadAiSimulationAudio(username, simulation.id).then((audio) => {
      if (!current) return
      if (!audio) {
        setError('Audio recording is unavailable on this device.')
        return
      }
      objectUrl = URL.createObjectURL(audio)
      setAudio(audio)
      setUrl(objectUrl)
    }).catch((caughtError: unknown) => {
      if (current) setError(caughtError instanceof Error ? caughtError.message : 'Audio recording could not be loaded.')
    }).finally(() => { if (current) setLoading(false) })
    return () => {
      current = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [username, simulation.id])

  return <div className="ai-sim-audio-row"><Headphones size={16} />
    {loading ? <span>Loading recording…</span> : url && audio ? <><audio controls preload="metadata" src={url} aria-label={`${partName(simulation.part)} simulation recording`} onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime, event.currentTarget.duration)} onPause={(event) => onTimeUpdate(event.currentTarget.currentTime, event.currentTarget.duration)} /><button type="button" className="ai-sim-share-coach" onClick={() => shareAudioWithCoach(audio, `${partName(simulation.part)} AI-to-AI simulation`)}><MessageCircle size={14} /> Ask Speakia</button></> : <span role="status">{error}</span>}
  </div>
}

export function AiToAiSimulationPage({ username, apiKey, lexicalTerms, onAddLexicalEntry, onOpenSettings }: {
  username: string
  apiKey: string
  lexicalTerms: string[]
  onAddLexicalEntry: (entry: Omit<LexicalEntry, 'id' | 'custom'>) => LexicalEntry
  onOpenSettings: () => void
}) {
  const [selectedTopic, setSelectedTopic] = useState('')
  const [selectedCueCardId, setSelectedCueCardId] = useState('')
  const [customCueCards, setCustomCueCards] = useState<CueCardTopic[]>(loadCustomCueCards)
  const [showCueCardEditor, setShowCueCardEditor] = useState(false)
  const [cueCardTitle, setCueCardTitle] = useState('')
  const [cueCardPrompt, setCueCardPrompt] = useState('')
  const [cueCardIdea, setCueCardIdea] = useState('')
  const [cueCardSearch, setCueCardSearch] = useState('')
  const [newCueCardTheme, setNewCueCardTheme] = useState('')
  const [generatingNewCueCard, setGeneratingNewCueCard] = useState(false)
  const [generatingCueCard, setGeneratingCueCard] = useState(false)
  const [cueCardError, setCueCardError] = useState('')
  const [partFilter, setPartFilter] = useState<PartFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [historyPlayback, setHistoryPlayback] = useState<{ id: string; time: number; duration: number }>({ id: '', time: 0, duration: 0 })
  const simulation = useAiToAiSimulation(username, apiKey)
  const lexicalCapture = useLexicalSessionCapture(simulation.records, apiKey, lexicalTerms, onAddLexicalEntry)
  const generatedCueCards = useGeneratedCueCards()
  const availableCueCards = useMemo(() => [
    ...suggestedCueCards,
    ...generatedCueCards.map((card) => ({ ...card, source: 'generated' as const })),
    ...customCueCards,
  ], [customCueCards, generatedCueCards])
  const filteredCueCards = useMemo(() => {
    const query = cueCardSearch.trim().toLocaleLowerCase()
    return availableCueCards.filter((card) => !query || `${card.title} ${card.cueCard}`.toLocaleLowerCase().includes(query))
  }, [availableCueCards, cueCardSearch])
  const selectedCueCard = availableCueCards.find((item) => item.id === selectedCueCardId)
  const filteredRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return simulation.records.filter((record) => (partFilter === 'all' || record.part === partFilter)
      && (statusFilter === 'all' || record.status === statusFilter)
      && (!query || `${record.topic} ${record.turns.map((turn) => turn.text).join(' ')}`.toLocaleLowerCase().includes(query)))
  }, [partFilter, search, simulation.records, statusFilter])

  const completedCount = simulation.records.filter((record) => record.status === 'completed').length
  const turnCount = simulation.turns.length

  async function generateCueCard() {
    if (!apiKey.trim()) {
      setCueCardError('Add your Speakia AI API key in Settings to generate a cue card.')
      return
    }
    if (!cueCardIdea.trim()) {
      setCueCardError('Describe a topic or theme for the cue card.')
      return
    }
    setGeneratingCueCard(true)
    setCueCardError('')
    try {
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const response = await client.models.generateContent({
        model: getProdiaTextModel(),
        contents: `Create an original IELTS Speaking Part 2 practice cue card about: ${cueCardIdea.trim()}. Return a concise title and candidate-facing cue card with an introductory instruction, four bullet points beginning with "You should say", and a final "and explain" prompt. Keep it natural, accessible and answerable from personal experience. Do not include sample answer or feedback.`,
        config: {
          temperature: 0.8,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              cueCard: { type: Type.STRING },
            },
            required: ['title', 'cueCard'],
          },
        },
      })
      if (!response.text?.trim()) throw new Error('Speakia AI returned an empty cue card.')
      let generated: unknown
      try {
        generated = JSON.parse(response.text)
      } catch (error) {
        console.error('Speakia AI returned invalid JSON for an AI simulation cue card.', error)
        throw new Error('Speakia AI returned an unreadable cue card. Try generating it again.')
      }
      if (typeof generated !== 'object' || generated === null || Array.isArray(generated)
        || !('title' in generated) || !('cueCard' in generated)
        || typeof generated.title !== 'string' || !generated.title.trim()
        || generated.title.length > 100 || typeof generated.cueCard !== 'string'
        || !generated.cueCard.trim() || generated.cueCard.length > 1000) {
        throw new Error('Speakia AI returned an incomplete cue card. Try a different topic.')
      }
      setCueCardTitle(generated.title.trim())
      setCueCardPrompt(generated.cueCard.trim())
    } catch (error) {
      console.error('Unable to generate an AI simulation cue card.', error)
      setCueCardError(error instanceof Error ? error.message : 'The cue card could not be generated.')
    } finally {
      setGeneratingCueCard(false)
    }
  }

  async function generateNewCueCard() {
    setGeneratingNewCueCard(true)
    setCueCardError('')
    try {
      const card = await generateAndSaveCueCard(apiKey, availableCueCards, newCueCardTheme)
      setSelectedCueCardId(card.id)
      setNewCueCardTheme('')
    } catch (error) {
      console.error('Unable to generate a new AI-to-AI simulation cue card.', error)
      setCueCardError(error instanceof Error ? error.message : 'Unable to generate a new cue-card topic.')
    } finally {
      setGeneratingNewCueCard(false)
    }
  }

  function saveCueCard() {
    const title = cueCardTitle.trim()
    const cueCard = cueCardPrompt.trim()
    if (!title || !cueCard) {
      setCueCardError('Add both a cue-card title and prompt before saving.')
      return
    }
    const card: CueCardTopic = { id: crypto.randomUUID(), title, cueCard, source: cueCardIdea.trim() ? 'ai' : 'custom' }
    const nextCards = [card, ...customCueCards]
    try {
      localStorage.setItem(CUE_CARD_STORAGE_KEY, JSON.stringify(nextCards))
      setCustomCueCards(nextCards)
    } catch (error) {
      console.error('Unable to save custom AI simulation cue card.', error)
      setCueCardError(error instanceof Error ? error.message : 'The cue card could not be saved in this browser.')
      return
    }
    setSelectedCueCardId(card.id)
    setSelectedTopic('')
    setShowCueCardEditor(false)
    setCueCardTitle('')
    setCueCardPrompt('')
    setCueCardIdea('')
    setCueCardError('')
  }

  function removeCueCard(cardId: string) {
    const nextCards = customCueCards.filter((card) => card.id !== cardId)
    try {
      localStorage.setItem(CUE_CARD_STORAGE_KEY, JSON.stringify(nextCards))
      setCustomCueCards(nextCards)
      setCueCardError('')
    } catch (error) {
      console.error('Unable to remove custom AI simulation cue card.', error)
      setCueCardError(error instanceof Error ? error.message : 'The cue card could not be removed.')
    }
    if (selectedCueCardId === cardId) setSelectedCueCardId('')
  }

  function startSelectedFormat(part: AiSimulationPart) {
    const cueCard = part === 'part2' || part === 'full' ? selectedCueCard : undefined
    void simulation.startSimulation(part, selectedTopic, undefined, undefined, cueCard
      ? { title: cueCard.title, prompt: cueCard.cueCard }
      : undefined)
  }

  return <div className="page-content inner-page ai-sim-page">
    <header className="ai-sim-heading">
      <div><p className="eyebrow">TWO VOICES · ONE IELTS TEST</p><h1>AI-to-AI speaking simulation</h1><p className="page-subtitle">Listen to an AI examiner and AI candidate complete realistic IELTS Speaking practice. Every run is saved with its transcript and audio.</p></div>
      <span className={`ai-sim-live-badge ${simulation.state === 'live' ? 'ai-sim-live-badge-on' : ''}`}><i />{simulation.state === 'live' ? 'LIVE SIMULATION' : simulation.state === 'connecting' ? 'CONNECTING' : 'READY WHEN YOU ARE'}</span>
    </header>
    {lexicalCapture.message && <div className={lexicalCapture.state === 'error' ? 'ai-sim-error' : 'tt-inline-notice'} role={lexicalCapture.state === 'error' ? 'alert' : 'status'}><span>{lexicalCapture.message}</span>{lexicalCapture.state === 'error' && <button type="button" onClick={lexicalCapture.retry}>Retry</button>}</div>}

    <section className="ai-sim-intro" aria-label="AI speaking simulation overview">
      <div className="ai-sim-intro-mark"><Radio size={21} /></div>
      <div><span className="section-kicker">AUTOMATED SPEAKING PRACTICE</span><strong>Watch the exchange. Hear every answer.</strong><p>Two independent Speakia voices take turns through the selected test format. No microphone is needed.</p></div>
      <div className="ai-sim-intro-stat"><span>Saved runs</span><strong>{simulation.records.length}</strong></div>
      <div className="ai-sim-intro-stat"><span>Completed</span><strong>{completedCount}</strong></div>
    </section>

    <div className="ai-sim-topic-control">
      <label htmlFor="ai-sim-topic">Practice topic <span>Optional</span></label>
      <input id="ai-sim-topic" value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)} placeholder="e.g. technology, hometown, an important decision" maxLength={120} disabled={simulation.state !== 'idle'} />
      <span>Used for Parts 1 and 3. For Part 2, choose a cue card or leave it blank for an AI-selected topic.</span>
    </div>

    <section className="ai-sim-cue-card-picker" aria-labelledby="ai-sim-cue-card-title">
      <div className="ai-sim-cue-card-heading"><div><span className="section-kicker">PART 2 · CUE CARD</span><h2 id="ai-sim-cue-card-title">Choose the long-turn topic</h2><p>Used in Part 2 and the Part 2 section of a full test. Leave unselected to let the AI choose a topic.</p></div><span className="ai-sim-cue-card-optional">Optional</span></div>
      <label className="ai-sim-cue-card-search"><Search size={15} /><span className="sr-only">Search cue-card topics</span><input type="search" value={cueCardSearch} onChange={(event) => setCueCardSearch(event.target.value)} placeholder="Search cue-card topics" disabled={simulation.state !== 'idle'} /></label>
      <div className="ai-sim-cue-card-library" role="group" aria-label="Choose a Part 2 cue card">
        <button type="button" className={`ai-sim-cue-card-option ai-sim-cue-card-ai ${selectedCueCardId ? '' : 'ai-sim-cue-card-option-selected'}`} aria-pressed={!selectedCueCardId} onClick={() => setSelectedCueCardId('')} disabled={simulation.state !== 'idle'}>
          <span className="ai-sim-cue-card-option-icon"><Sparkles size={16} /></span><strong>Let AI choose</strong><small>Generate a fresh IELTS topic when the simulation starts</small>
        </button>
        {filteredCueCards.map((card) => <button type="button" key={card.id} className={`ai-sim-cue-card-option ${selectedCueCardId === card.id ? 'ai-sim-cue-card-option-selected' : ''}`} aria-pressed={selectedCueCardId === card.id} onClick={() => setSelectedCueCardId(card.id)} disabled={simulation.state !== 'idle'}>
          <span className="ai-sim-cue-card-option-label">{card.source === 'suggested' ? 'TOPIC LIBRARY' : card.source === 'generated' || card.source === 'ai' ? 'AI-GENERATED · SAVED' : 'CUSTOM'}</span><strong>{card.title}</strong><small>{card.source === 'suggested' ? 'IELTS Part 2 practice card' : 'Your saved cue card'}</small>
        </button>)}
        {filteredCueCards.length === 0 && <p className="ai-sim-cue-card-no-results">No cue cards match that search.</p>}
      </div>
      <div className="ai-sim-new-topic">
        <label htmlFor="ai-sim-new-cue-theme">Looking for a topic not in the list?</label>
        <div><input id="ai-sim-new-cue-theme" value={newCueCardTheme} onChange={(event) => setNewCueCardTheme(event.target.value)} maxLength={160} placeholder="Optional theme, e.g. a useful lesson from a mistake" disabled={simulation.state !== 'idle' || generatingNewCueCard} /><button type="button" className="ai-sim-generate-cue-card" onClick={() => void generateNewCueCard()} disabled={simulation.state !== 'idle' || generatingNewCueCard || !apiKey.trim()}>{generatingNewCueCard ? <><LoaderCircle size={14} className="spin-icon" /> Generating…</> : <><WandSparkles size={14} /> Generate &amp; save topic</>}</button></div>
        <small>Speakia checks the existing library, creates a distinct IELTS cue card, saves it, and selects it for this simulation.</small>
        {cueCardError && <p className="ai-sim-cue-card-error" role="alert">{cueCardError}</p>}
      </div>
      {selectedCueCard ? <article className="ai-sim-cue-card-preview"><div><span>{selectedCueCard.source === 'suggested' ? 'SUGGESTED CUE CARD' : selectedCueCard.source === 'generated' || selectedCueCard.source === 'ai' ? 'SPEAKIA-GENERATED CUE CARD' : 'YOUR CUSTOM CUE CARD'}</span>{(selectedCueCard.source === 'custom' || selectedCueCard.source === 'ai') && <button type="button" aria-label={`Remove ${selectedCueCard.title}`} onClick={() => removeCueCard(selectedCueCard.id)} disabled={simulation.state !== 'idle'}><Trash2 size={14} /></button>}</div><strong>{selectedCueCard.title}</strong><p>{selectedCueCard.cueCard}</p></article> : <p className="ai-sim-cue-card-empty"><Sparkles size={15} /> No card selected—your AI speakers will choose an IELTS topic for Part 2.</p>}
      <button type="button" className="ai-sim-add-cue-card" onClick={() => { setShowCueCardEditor((open) => !open); setCueCardError('') }} disabled={simulation.state !== 'idle'}><Plus size={15} /> Create your own cue card <WandSparkles size={14} /></button>
      {showCueCardEditor && <div className="ai-sim-cue-card-editor"><div className="ai-sim-cue-card-editor-heading"><div><strong>Create a flexible Part 2 card</strong><span>Write it yourself or ask Speakia to draft one from a theme.</span></div><button type="button" aria-label="Close cue card editor" onClick={() => setShowCueCardEditor(false)}><X size={15} /></button></div><label>Theme for AI generation<input value={cueCardIdea} onChange={(event) => setCueCardIdea(event.target.value)} maxLength={160} placeholder="e.g. a community project that brought people together" /></label><button type="button" className="ai-sim-generate-cue-card" onClick={() => void generateCueCard()} disabled={generatingCueCard || !apiKey.trim()}>{generatingCueCard ? <><LoaderCircle size={14} className="spin-icon" /> Generating…</> : <><WandSparkles size={14} /> Generate with Speakia</>}</button><label>Cue card title<input value={cueCardTitle} onChange={(event) => setCueCardTitle(event.target.value)} maxLength={100} placeholder="e.g. A project that helped your community" /></label><label>Candidate-facing cue card<textarea value={cueCardPrompt} onChange={(event) => setCueCardPrompt(event.target.value)} maxLength={1000} rows={5} placeholder={'Describe a project that helped your community.\nYou should say:\n• what the project was\n• who took part\n• what you did\nand explain why it was important.'} /></label>{cueCardError && <p className="ai-sim-cue-card-error" role="alert">{cueCardError}</p>}<div className="ai-sim-cue-card-editor-actions"><button type="button" onClick={() => { setCueCardTitle(''); setCueCardPrompt(''); setCueCardIdea(''); setCueCardError('') }}>Clear fields</button><button type="button" onClick={saveCueCard}><Check size={14} /> Save cue card</button></div></div>}
    </section>

    <section className="ai-sim-formats" aria-labelledby="ai-sim-formats-title">
      <div className="ai-sim-section-heading"><div><span className="section-kicker">CHOOSE YOUR FORMAT</span><h2 id="ai-sim-formats-title">Four ways to run a practice</h2></div><span>AI examiner <span aria-hidden="true">↔</span> AI candidate</span></div>
      <div className="ai-sim-format-grid">{formats.map((format) => {
        const Icon = format.icon
        return <article className={`ai-sim-format-card ai-sim-tone-${format.tone}`} key={format.part}>
          <div className="ai-sim-format-top"><span className="ai-sim-format-icon"><Icon size={20} /></span><span className="ai-sim-format-label">{format.label}</span></div>
          <h3>{format.title}</h3><p>{format.description}</p>
          <div className="ai-sim-format-footer"><span><Clock3 size={13} />{format.duration}</span>
            <button type="button" onClick={() => startSelectedFormat(format.part)} disabled={simulation.state !== 'idle'} aria-label={`Start AI-to-AI ${format.title} simulation`}><Play size={14} fill="currentColor" />{simulation.state === 'idle' ? 'Start' : 'In progress'}</button>
          </div>
        </article>
      })}</div>
    </section>

    {(simulation.error || (!apiKey.trim() && simulation.state === 'idle')) && <div className="ai-sim-error" role="alert"><span>{simulation.error || 'A Speakia AI API key is needed to start an AI simulation.'}</span>{!apiKey.trim() && <button type="button" onClick={onOpenSettings}>Open settings</button>}</div>}

    {simulation.state !== 'idle' && <section className="ai-sim-session" aria-label="Current AI-to-AI simulation" aria-live="polite">
      <header className="ai-sim-session-header"><div><span className="section-kicker">{simulation.state === 'saving' ? 'SAVING SESSION' : simulation.state === 'connecting' ? 'CONNECTING BOTH SPEAKERS' : `${partName(simulation.part ?? 'full').toUpperCase()} · LIVE`}</span><h2>{simulation.topic || 'IELTS Speaking practice'}</h2></div>
        <div className="ai-sim-session-actions"><span className="ai-sim-speech-speed" title="Speakia AI voices play at their original pitch and natural speed">Natural voice</span><span className="ai-sim-session-time"><Timer size={15} />{durationLabel(simulation.elapsedSeconds)}</span><button type="button" className="ai-sim-stop" onClick={simulation.stopSimulation} disabled={simulation.state === 'saving'}><Square size={14} fill="currentColor" />{simulation.state === 'saving' ? 'Saving…' : 'Stop and save'}</button></div>
      </header>
      <div className="ai-sim-speakers"><div className={`ai-sim-speaker ai-sim-speaker-examiner ${simulation.activeSpeaker === 'examiner' ? 'ai-sim-speaker-active' : ''}`}><span><Mic2 size={17} /></span><div><strong>AI Examiner</strong><small>{simulation.activeSpeaker === 'examiner' ? 'Speaking now' : 'IELTS test host'}</small></div><i /></div><div className={`ai-sim-speaker ai-sim-speaker-candidate ${simulation.activeSpeaker === 'candidate' ? 'ai-sim-speaker-active' : ''}`}><span><Activity size={17} /></span><div><strong>AI Candidate</strong><small>{simulation.activeSpeaker === 'candidate' ? 'Speaking now' : 'Model response'}</small></div><i /></div></div>
      {simulation.state === 'connecting' && <p className="ai-sim-connecting"><Waves size={15} /> Establishing both Speakia voice connections…</p>}
      <div className="ai-sim-live-transcript">{turnCount ? simulation.turns.map((turn) => <article className={`ai-sim-turn ai-sim-turn-${turn.role}`} key={turn.id}><span>{turn.role === 'examiner' ? 'AI EXAMINER' : 'AI CANDIDATE'}{!turn.completedAt && <i> · speaking</i>}</span><p>{turn.text ? <SpeechHighlight text={turn.text} wordIndex={!turn.completedAt && simulation.activeSpeaker === turn.role ? wordIndexAtElapsed(turn.text, simulation.speechElapsedSeconds, turn.audioDurationSeconds || undefined) : -1} /> : 'Listening…'}</p></article>) : <div className="ai-sim-empty-live"><Headphones size={22} /><p>The speakers will appear here as the simulation begins.</p></div>}</div>
      <footer className="ai-sim-session-footer"><span><Waves size={14} /> Two AI voices are speaking and listening in turn.</span><span>{turnCount} turns</span></footer>
    </section>}

    <section className="ai-sim-history" aria-labelledby="ai-sim-history-title">
      <div className="ai-sim-section-heading"><div><span className="section-kicker">YOUR LOCAL ARCHIVE</span><h2 id="ai-sim-history-title">Simulation history</h2></div><span>{filteredRecords.length} {filteredRecords.length === 1 ? 'run' : 'runs'}</span></div>
      <div className="ai-sim-history-controls"><label className="ai-sim-search"><Search size={16} /><input aria-label="Search AI simulation history" placeholder="Search topic or transcript" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>×</button>}</label><label className="ai-sim-select"><ListFilter size={15} /><span>Part</span><select aria-label="Filter simulation history by part" value={partFilter} onChange={(event) => setPartFilter(event.target.value as PartFilter)}><option value="all">All formats</option><option value="part1">Part 1</option><option value="part2">Part 2</option><option value="part3">Part 3</option><option value="full">Full test</option></select></label><label className="ai-sim-select"><span>Status</span><select aria-label="Filter simulation history by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">All runs</option><option value="completed">Completed</option><option value="stopped">Stopped early</option></select></label></div>
      {filteredRecords.length ? <div className="ai-sim-history-list">{filteredRecords.map((record) => {
        const expanded = expandedId === record.id
        return <article className={`ai-sim-history-card ${expanded ? 'ai-sim-history-card-open' : ''}`} key={record.id}>
          <div className="ai-sim-history-card-main"><span className={`ai-sim-history-icon ai-sim-tone-${record.part === 'full' ? 'coral' : record.part === 'part1' ? 'green' : record.part === 'part2' ? 'amber' : 'blue'}`}><Headphones size={18} /></span><div className="ai-sim-history-copy"><div><strong>{partName(record.part)}</strong><span className={`ai-sim-status ai-sim-status-${record.status}`}>{record.status === 'completed' ? <Check size={12} /> : <Square size={10} />}{record.status === 'completed' ? 'Completed' : 'Stopped early'}</span></div><p>{record.topic}</p><small>{dateLabel(record.startedAt)} · {durationLabel(record.durationSeconds)} · {record.turns.length} turns</small></div><button className="ai-sim-expand-button" type="button" aria-label={`${expanded ? 'Hide' : 'Show'} ${partName(record.part)} transcript`} aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : record.id)}><span>{expanded ? 'Hide transcript' : 'View transcript'}</span><ChevronDown size={16} /></button></div>
          {expanded && <div className="ai-sim-history-detail">{record.audioAvailable && <SimulationAudio username={username} simulation={record} onTimeUpdate={(time, duration) => setHistoryPlayback({ id: record.id, time, duration })} />}<div className="ai-sim-saved-transcript">{record.turns.map((turn, index) => {
            const position = historyPlayback.id === record.id
              ? transcriptPositionAtTime(record.turns, historyPlayback.time, historyPlayback.duration)
              : null
            return <article className={`ai-sim-turn ai-sim-turn-${turn.role}`} key={`${record.id}-${turn.id}-${index}`}><span>{turn.role === 'examiner' ? 'AI EXAMINER' : 'AI CANDIDATE'}</span><p><SpeechHighlight text={turn.text} wordIndex={position?.turnIndex === index ? position.wordIndex : -1} /></p></article>
          })}</div></div>}
        </article>
      })}</div> : <div className="ai-sim-history-empty"><span><BookOpen size={20} /></span><h3>{simulation.records.length ? 'No simulations match these filters' : 'Your simulation archive is ready'}</h3><p>{simulation.records.length ? 'Try another part, status, or search term.' : 'Completed and stopped runs are saved here on this device with their transcripts and audio.'}</p>{simulation.records.length > 0 && <button type="button" onClick={() => { setPartFilter('all'); setStatusFilter('all'); setSearch('') }}>Clear filters</button>}</div>}
    </section>
  </div>
}
