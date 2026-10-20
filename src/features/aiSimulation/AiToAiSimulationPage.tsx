import { useEffect, useMemo, useState } from 'react'
import { Activity, BookOpen, Check, ChevronDown, Clock3, Headphones, ListFilter, MessageCircle, Mic2, Play, Radio, Search, Square, Timer, Waves } from 'lucide-react'
import { useAiToAiSimulation } from './useAiToAiSimulation'
import { loadAiSimulationAudio } from './storage'
import { shareAudioWithCoach } from '@/features/assistant/audioSharing'
import { SpeechHighlight } from '@/features/simulator/SpeechHighlight'
import { transcriptPositionAtTime, wordIndexAtElapsed } from '@/features/simulator/speechTiming'
import type { AiSimulationPart, AiSimulationRecord } from './types'

const formats: { part: AiSimulationPart; title: string; label: string; description: string; duration: string; icon: typeof MessageCircle; tone: string }[] = [
  { part: 'part1', title: 'Part 1', label: 'Familiar topics', description: 'Warm-up questions about everyday life, your routines, home, work, or study.', duration: '5 questions · 4–6 min', icon: MessageCircle, tone: 'green' },
  { part: 'part2', title: 'Part 2', label: 'Long turn', description: 'An examiner-led cue card, preparation pause, long turn, and a short follow-up.', duration: 'Cue card · 3–4 min', icon: Timer, tone: 'amber' },
  { part: 'part3', title: 'Part 3', label: 'Discussion', description: 'Broader questions that explore opinions, causes, change, and future possibilities.', duration: '5 questions · 5–7 min', icon: Waves, tone: 'blue' },
  { part: 'full', title: 'Full test', label: 'Complete simulation', description: 'A continuous Part 1, Part 2, and Part 3 test with two AI voices.', duration: 'All 3 parts · 10–14 min', icon: Radio, tone: 'coral' },
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
    {loading ? <span>Loading recording…</span> : url && audio ? <><audio controls preload="metadata" src={url} aria-label={`${partName(simulation.part)} simulation recording`} onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime, event.currentTarget.duration)} onPause={(event) => onTimeUpdate(event.currentTarget.currentTime, event.currentTarget.duration)} /><button type="button" className="ai-sim-share-coach" onClick={() => shareAudioWithCoach(audio, `${partName(simulation.part)} AI-to-AI simulation`)}><MessageCircle size={14} /> Discuss with Coach</button></> : <span role="status">{error}</span>}
  </div>
}

export function AiToAiSimulationPage({ username, apiKey, onOpenSettings }: { username: string; apiKey: string; onOpenSettings: () => void }) {
  const [selectedTopic, setSelectedTopic] = useState('')
  const [partFilter, setPartFilter] = useState<PartFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [historyPlayback, setHistoryPlayback] = useState<{ id: string; time: number; duration: number }>({ id: '', time: 0, duration: 0 })
  const simulation = useAiToAiSimulation(username, apiKey)
  const filteredRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return simulation.records.filter((record) => (partFilter === 'all' || record.part === partFilter)
      && (statusFilter === 'all' || record.status === statusFilter)
      && (!query || `${record.topic} ${record.turns.map((turn) => turn.text).join(' ')}`.toLocaleLowerCase().includes(query)))
  }, [partFilter, search, simulation.records, statusFilter])

  const completedCount = simulation.records.filter((record) => record.status === 'completed').length
  const turnCount = simulation.turns.length

  return <div className="page-content inner-page ai-sim-page">
    <header className="ai-sim-heading">
      <div><p className="eyebrow">TWO VOICES · ONE IELTS TEST</p><h1>AI-to-AI speaking simulation</h1><p className="page-subtitle">Listen to an AI examiner and AI candidate complete realistic IELTS Speaking practice. Every run is saved with its transcript and audio.</p></div>
      <span className={`ai-sim-live-badge ${simulation.state === 'live' ? 'ai-sim-live-badge-on' : ''}`}><i />{simulation.state === 'live' ? 'LIVE SIMULATION' : simulation.state === 'connecting' ? 'CONNECTING' : 'READY WHEN YOU ARE'}</span>
    </header>

    <section className="ai-sim-intro" aria-label="AI speaking simulation overview">
      <div className="ai-sim-intro-mark"><Radio size={21} /></div>
      <div><span className="section-kicker">AUTOMATED SPEAKING PRACTICE</span><strong>Watch the exchange. Hear every answer.</strong><p>Two independent Gemini Live voices take turns through the selected test format. No microphone is needed.</p></div>
      <div className="ai-sim-intro-stat"><span>Saved runs</span><strong>{simulation.records.length}</strong></div>
      <div className="ai-sim-intro-stat"><span>Completed</span><strong>{completedCount}</strong></div>
    </section>

    <div className="ai-sim-topic-control">
      <label htmlFor="ai-sim-topic">Practice topic <span>Optional</span></label>
      <input id="ai-sim-topic" value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)} placeholder="e.g. technology, hometown, an important decision" maxLength={120} disabled={simulation.state !== 'idle'} />
      <span>Leave blank for an everyday IELTS topic.</span>
    </div>

    <section className="ai-sim-formats" aria-labelledby="ai-sim-formats-title">
      <div className="ai-sim-section-heading"><div><span className="section-kicker">CHOOSE YOUR FORMAT</span><h2 id="ai-sim-formats-title">Four ways to run a practice</h2></div><span>AI examiner <span aria-hidden="true">↔</span> AI candidate</span></div>
      <div className="ai-sim-format-grid">{formats.map((format) => {
        const Icon = format.icon
        return <article className={`ai-sim-format-card ai-sim-tone-${format.tone}`} key={format.part}>
          <div className="ai-sim-format-top"><span className="ai-sim-format-icon"><Icon size={20} /></span><span className="ai-sim-format-label">{format.label}</span></div>
          <h3>{format.title}</h3><p>{format.description}</p>
          <div className="ai-sim-format-footer"><span><Clock3 size={13} />{format.duration}</span>
            <button type="button" onClick={() => void simulation.startSimulation(format.part, selectedTopic)} disabled={simulation.state !== 'idle'} aria-label={`Start AI-to-AI ${format.title} simulation`}><Play size={14} fill="currentColor" />{simulation.state === 'idle' ? 'Start' : 'In progress'}</button>
          </div>
        </article>
      })}</div>
    </section>

    {(simulation.error || (!apiKey.trim() && simulation.state === 'idle')) && <div className="ai-sim-error" role="alert"><span>{simulation.error || 'A Gemini API key is needed to start an AI simulation.'}</span>{!apiKey.trim() && <button type="button" onClick={onOpenSettings}>Open settings</button>}</div>}

    {simulation.state !== 'idle' && <section className="ai-sim-session" aria-label="Current AI-to-AI simulation" aria-live="polite">
      <header className="ai-sim-session-header"><div><span className="section-kicker">{simulation.state === 'saving' ? 'SAVING SESSION' : simulation.state === 'connecting' ? 'CONNECTING BOTH SPEAKERS' : `${partName(simulation.part ?? 'full').toUpperCase()} · LIVE`}</span><h2>{simulation.topic || 'IELTS Speaking practice'}</h2></div>
        <div className="ai-sim-session-actions"><span className="ai-sim-session-time"><Timer size={15} />{durationLabel(simulation.elapsedSeconds)}</span><button type="button" className="ai-sim-stop" onClick={simulation.stopSimulation} disabled={simulation.state === 'saving'}><Square size={14} fill="currentColor" />{simulation.state === 'saving' ? 'Saving…' : 'Stop and save'}</button></div>
      </header>
      <div className="ai-sim-speakers"><div className={`ai-sim-speaker ai-sim-speaker-examiner ${simulation.activeSpeaker === 'examiner' ? 'ai-sim-speaker-active' : ''}`}><span><Mic2 size={17} /></span><div><strong>AI Examiner</strong><small>{simulation.activeSpeaker === 'examiner' ? 'Speaking now' : 'IELTS test host'}</small></div><i /></div><div className={`ai-sim-speaker ai-sim-speaker-candidate ${simulation.activeSpeaker === 'candidate' ? 'ai-sim-speaker-active' : ''}`}><span><Activity size={17} /></span><div><strong>AI Candidate</strong><small>{simulation.activeSpeaker === 'candidate' ? 'Speaking now' : 'Model response'}</small></div><i /></div></div>
      {simulation.state === 'connecting' && <p className="ai-sim-connecting"><Waves size={15} /> Establishing both Gemini Live connections…</p>}
      <div className="ai-sim-live-transcript">{turnCount ? simulation.turns.map((turn) => <article className={`ai-sim-turn ai-sim-turn-${turn.role}`} key={turn.id}><span>{turn.role === 'examiner' ? 'AI EXAMINER' : 'AI CANDIDATE'}{!turn.completedAt && <i> · speaking</i>}</span><p>{turn.text ? <SpeechHighlight text={turn.text} wordIndex={!turn.completedAt && simulation.activeSpeaker === turn.role ? wordIndexAtElapsed(turn.text, simulation.speechElapsedSeconds) : -1} /> : 'Listening…'}</p></article>) : <div className="ai-sim-empty-live"><Headphones size={22} /><p>The speakers will appear here as the simulation begins.</p></div>}</div>
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
