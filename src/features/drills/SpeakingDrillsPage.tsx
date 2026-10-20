import { useEffect, useMemo, useState } from 'react'
import { ThinkingLevel } from '@google/genai'
import { AlertCircle, ArrowLeft, ArrowRight, Clock3, LoaderCircle, Mic, MicOff, Sparkles, Target, Waves } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { TranscriptAudioList } from '@/features/simulator/TranscriptAudioList'
import { useGeminiLive } from '@/features/simulator/useGeminiLive'
import type { TranscriptEntry } from '@/features/simulator/types'

interface Drill {
  id: string
  title: string
  skill: string
  durationSeconds: number
  task: string
  instructions: string
  openingPrompt: string
}

const drills: Drill[] = [
  {
    id: 'fluency',
    title: 'One-minute fluency',
    skill: 'Fluency & coherence',
    durationSeconds: 60,
    task: 'Speak for one minute about a place you enjoy visiting. Keep your ideas connected and continue naturally if you lose your place.',
    instructions: 'Give a short topic and ask the learner to speak continuously for one minute. Do not interrupt. When they ask to finish, give focused feedback on pace, pauses, idea development, linking, and one practical fluency improvement.',
    openingPrompt: 'Start the one-minute fluency drill. Briefly introduce the task and invite the learner to begin speaking about a place they enjoy visiting. Let them speak without interruptions.',
  },
  {
    id: 'pronunciation',
    title: 'Pronunciation & shadowing',
    skill: 'Pronunciation',
    durationSeconds: 90,
    task: 'Repeat short, natural IELTS-style sentences and practise clear word stress, sentence rhythm, connected speech, and intonation.',
    instructions: 'Lead a progressive speech-shadowing drill. Say one short natural sentence clearly, ask the learner to repeat it, then compare only what is reasonably audible. Focus on intelligibility, stress, rhythm, connected speech, and intonation. Give a model and another attempt when useful; never claim certainty about subtle sounds that are unclear.',
    openingPrompt: 'Begin a pronunciation and shadowing drill with one short, natural IELTS Speaking sentence. Ask the learner to repeat it and wait for their attempt.',
  },
  {
    id: 'vocabulary',
    title: 'Vocabulary in context',
    skill: 'Lexical resource',
    durationSeconds: 90,
    task: 'Use three natural expressions about a familiar topic without forcing them into your answer.',
    instructions: 'Choose a familiar topic and give three useful, natural collocations or expressions with brief meanings. Ask the learner to answer a speaking question using them naturally. Notice range, precision, collocation, and repetition; give a natural reformulation and invite a retry.',
    openingPrompt: 'Start a vocabulary drill. Choose a familiar topic, give three useful natural expressions with brief meanings, then ask one question that lets the learner use them.',
  },
  {
    id: 'grammar',
    title: 'Flexible sentence building',
    skill: 'Grammar range & accuracy',
    durationSeconds: 90,
    task: 'Answer aloud using a mix of simple and complex sentences, including a reason, contrast, or conditional idea.',
    instructions: 'Ask one IELTS-style question, then coach the learner to express the answer using varied sentence forms, such as a reason clause, contrast, relative clause, or conditional. Correct errors kindly, explain the pattern briefly, and ask for a spoken retry.',
    openingPrompt: 'Start a grammar range drill with one everyday IELTS Speaking question. Invite the learner to answer aloud with varied sentence structures.',
  },
  {
    id: 'part1',
    title: 'Part 1 quick responses',
    skill: 'IELTS Speaking Part 1',
    durationSeconds: 90,
    task: 'Answer familiar questions directly, then add a reason or specific detail in a natural two- or three-sentence response.',
    instructions: 'Run a rapid IELTS Speaking Part 1 drill with one familiar question at a time. Keep answers brief and natural, ask a few varied questions, then give concise feedback on relevance, development, fluency, and natural phrasing.',
    openingPrompt: 'Begin an IELTS Speaking Part 1 quick-response drill. Ask one familiar personal question and wait for the learner to answer before continuing.',
  },
  {
    id: 'part2',
    title: 'Part 2 story structure',
    skill: 'IELTS Speaking Part 2',
    durationSeconds: 120,
    task: 'Build a clear beginning, a few specific details, and a reflection into a short talk about a memorable day.',
    instructions: 'Give a compact IELTS Speaking Part 2 cue card about a memorable day. Allow a brief moment to plan, then invite a long turn without interruption. On request to finish, comment on organization, detail, development, fluency, and one way to extend the response.',
    openingPrompt: 'Begin an IELTS Speaking Part 2 drill. Give a cue card about a memorable day, allow a short planning pause, and then invite the learner to speak at length without interruption.',
  },
  {
    id: 'part3',
    title: 'Part 3 develop an opinion',
    skill: 'IELTS Speaking Part 3',
    durationSeconds: 120,
    task: 'Develop an opinion with a clear point, explanation, relevant example, and a thoughtful qualification.',
    instructions: 'Ask an IELTS Speaking Part 3 discussion question. Coach a structured response using a point, explanation, example, and qualification where appropriate. Ask a follow-up that invites analysis or comparison, then give specific feedback on reasoning, support, coherence, and language.',
    openingPrompt: 'Begin an IELTS Speaking Part 3 opinion drill. Ask one thoughtful discussion question and wait for the learner to develop an answer.',
  },
]

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

export function SpeakingDrillWidget({ apiKey, onOpenSettings, initialDrillId }: { apiKey: string; onOpenSettings: () => void; initialDrillId?: string }) {
  const [selectedDrillId, setSelectedDrillId] = useState(() => drills.find((drill) => drill.id === initialDrillId)?.id ?? drills[0].id)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isReviewing, setIsReviewing] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [finalTranscript, setFinalTranscript] = useState<TranscriptEntry[]>([])
  const drill = useMemo(() => drills.find((item) => item.id === selectedDrillId) ?? drills[0], [selectedDrillId])
  const live = useGeminiLive({
    apiKey,
    systemInstruction: `You are Speakia, a supportive IELTS Speaking drill coach. This is focused practice, not an official band assessment. Target skill: ${drill.skill}. Exercise: ${drill.task}\n${drill.instructions}\nUse additional internal reasoning to compare the learner's performance with the target skill and select the most useful next step. Never disclose private chain-of-thought. Give only actionable feedback and concise conclusions.`,
    thinkingLevel: ThinkingLevel.HIGH,
    openingPrompt: drill.openingPrompt,
  })
  const isActive = live.connected || live.connecting

  useEffect(() => {
    if (!live.connected || isReviewing) return
    const interval = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000)
    return () => window.clearInterval(interval)
  }, [isReviewing, live.connected])

  async function startDrill() {
    setElapsedSeconds(0)
    setIsReviewing(false)
    setIsFinished(false)
    setFinalTranscript([])
    await live.start()
  }

  function requestFeedback() {
    setIsReviewing(true)
    live.sendInstruction(`Please wrap up this ${drill.title} now. Give concise, specific feedback only on ${drill.skill}: mention one observed strength, one concrete improvement grounded in what the learner said, and one short spoken retry or next practice step. Be encouraging and do not give an official IELTS band score.`)
  }

  async function endDrill() {
    const result = await live.stop()
    setFinalTranscript(result.transcript)
    setIsFinished(true)
  }

  return (
    <div className="drills-inline-widget">
      <div className="drills-inline-heading">
        <div><span className="section-kicker">FOCUSED, REPEATABLE PRACTICE</span><strong>Speaking drills</strong><p>Choose one skill to practise live with Speakia Coach.</p></div>
        <Badge className="drills-thinking-badge"><Sparkles size={13} /> Gemini Live · extended thinking</Badge>
      </div>

      {!isActive && !isFinished && (
        <>
          <Card className="drills-intro-card">
            <span className="drills-intro-icon"><Target size={21} /></span>
            <div><strong>Practise one skill at a time</strong><p>Choose a focused exercise. Speakia listens, adapts the practice, and gives skill-specific feedback when you wrap up.</p></div>
          </Card>
          {!apiKey.trim() && <Card className="drills-key-notice"><AlertCircle size={17} /><p>Add your Gemini API key in Settings before starting a live drill.</p><Button variant="outline" size="sm" onClick={onOpenSettings}>Open Settings</Button></Card>}
          <div className="drills-grid" aria-label="Choose a speaking drill">
            {drills.map((item) => (
              <button type="button" key={item.id} className={`drill-choice ${selectedDrillId === item.id ? 'drill-choice-selected' : ''}`} aria-pressed={selectedDrillId === item.id} onClick={() => setSelectedDrillId(item.id)}>
                <span className="drill-choice-top"><span><Sparkles size={15} /></span><small>{formatTime(item.durationSeconds)}</small></span>
                <strong>{item.title}</strong>
                <span className="drill-skill">{item.skill}</span>
                <p>{item.task}</p>
              </button>
            ))}
          </div>
          <Card className="drill-task-card">
            <div className="drill-task-heading"><div><span className="section-kicker">YOUR TASK</span><h2>{drill.title}</h2></div><Badge className="assignment-part-badge">{drill.skill}</Badge></div>
            <p>{drill.task}</p>
            <div className="drill-task-footer"><span><Clock3 size={15} /> About {formatTime(drill.durationSeconds)} · You can finish whenever you’re ready</span><Button className="start-button" disabled={!apiKey.trim() || live.connecting} onClick={() => void startDrill()}>{live.connecting ? <><LoaderCircle className="spin-icon" size={16} /> Connecting…</> : <><Mic size={15} /> Start this drill <ArrowRight size={15} /></>}</Button></div>
            {live.error && <p className="simulator-error" role="alert"><AlertCircle size={15} /> {live.error}</p>}
          </Card>
        </>
      )}

      {isActive && (
        <section className="drill-session" aria-labelledby="drill-session-heading">
          <div className="drill-session-header">
            <Button variant="outline" onClick={() => void endDrill()} disabled={live.connecting}><ArrowLeft size={15} /> End drill</Button>
            <Badge className="drill-live-thinking"><span /> <Sparkles size={13} /> EXTENDED THINKING ACTIVE</Badge>
            <span className="drill-session-timer"><Clock3 size={15} /> {formatTime(Math.max(0, drill.durationSeconds - elapsedSeconds))}</span>
          </div>
          <Card className="drill-live-card">
            <div className={`drill-live-orb ${live.connected ? 'drill-live-orb-on' : ''}`}><Waves size={32} /></div>
            <div><span className="section-kicker">{drill.skill.toLocaleUpperCase()}</span><h2 id="drill-session-heading">{live.connected ? (isReviewing ? 'Speakia is preparing your feedback' : 'Your coach is listening') : 'Connecting to your coach…'}</h2><p>{drill.task}</p></div>
            <span className={`drill-connection-status ${live.connected ? 'drill-connected' : ''}`}><i />{live.status || 'Connecting'}</span>
          </Card>
          <Card className="drill-transcript-card">
            <div className="live-transcript-heading"><div><span className="section-kicker">LIVE PRACTICE</span><h3>What you and Speakia said</h3></div><span>{live.transcript.length} turns</span></div>
            <div className="live-transcript-scroll" aria-live="polite">
              {live.transcript.length ? <TranscriptAudioList turns={live.transcript.slice(-20)} variant="live" /> : <div className="transcript-waiting"><LoaderCircle size={17} /><span>Speakia will introduce the drill. Your captions will appear here.</span></div>}
              {live.candidateDraft && <div className="live-transcript-line candidate-line live-draft-line"><span>YOU · LIVE</span><p>{live.candidateDraft}</p></div>}
            </div>
          </Card>
          {live.error && <p className="simulator-error" role="alert"><AlertCircle size={15} /> {live.error}</p>}
          <div className="drill-session-actions">
            <span><Mic size={15} /> Speak naturally; your practice is not an official IELTS score.</span>
            {isReviewing
              ? <Button className="finish-live-button" disabled={!live.connected} onClick={() => void endDrill()}><MicOff size={15} /> Save transcript &amp; finish</Button>
              : <Button className="start-button" disabled={!live.connected} onClick={requestFeedback}><Sparkles size={15} /> Wrap up &amp; get feedback</Button>}
          </div>
        </section>
      )}

      {isFinished && (
        <Card className="drill-finished-card">
          <div className="drill-finished-heading"><span><Sparkles size={18} /></span><div><span className="section-kicker">{isReviewing ? 'DRILL COMPLETE' : 'SESSION ENDED'}</span><h2>{drill.title}</h2><p>{drill.skill} · Practice time {formatTime(elapsedSeconds)}</p></div></div>
          <div className="drill-finished-transcript"><h3>{isReviewing ? 'Session transcript & feedback' : 'Practice transcript'}</h3>{finalTranscript.length ? <TranscriptAudioList turns={finalTranscript} variant="live" /> : <p>No transcript was captured for this drill.</p>}</div>
          <div className="drill-finished-actions"><Button variant="outline" onClick={() => { setIsFinished(false); setElapsedSeconds(0) }}>Choose another drill</Button><Button className="start-button" onClick={() => void startDrill()}><Mic size={15} /> Repeat this drill <ArrowRight size={15} /></Button></div>
        </Card>
      )}
    </div>
  )
}
