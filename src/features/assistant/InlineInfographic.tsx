import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowDown, ArrowRight, BarChart3, Check, Clock3, Expand, GitCompareArrows, Minimize, Sparkles } from 'lucide-react'
import type { Infographic, InfographicPalette } from './infographic'

const legacyPalettes: Record<NonNullable<Infographic['accent']>, InfographicPalette> = {
  violet: { primary: '#7866d6', secondary: '#a18cf4', background: '#f8f6ff', surface: '#ffffff', text: '#302e3d', muted: '#737180' },
  blue: { primary: '#3978bd', secondary: '#5cb7dc', background: '#f3f8ff', surface: '#ffffff', text: '#25364a', muted: '#61758a' },
  teal: { primary: '#278c83', secondary: '#50bea6', background: '#f1fbf8', surface: '#ffffff', text: '#243c39', muted: '#687d79' },
  amber: { primary: '#c27b25', secondary: '#e9ac45', background: '#fff9ee', surface: '#ffffff', text: '#403322', muted: '#796d5d' },
  rose: { primary: '#c35b76', secondary: '#ef8b9b', background: '#fff5f7', surface: '#ffffff', text: '#462c35', muted: '#806b74' },
}

export function InlineInfographic({ infographic }: { infographic: Infographic }) {
  const infographicRef = useRef<HTMLElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState('')
  const palette = infographic.palette ?? legacyPalettes[infographic.accent ?? 'violet']
  const maximum = Math.max(...infographic.data.map((item) => item.value), 1)
  const paletteStyle = {
    '--infographic-primary': palette.primary,
    '--infographic-secondary': palette.secondary,
    '--infographic-background': palette.background,
    '--infographic-surface': palette.surface,
    '--infographic-text': palette.text,
    '--infographic-muted': palette.muted,
  } as CSSProperties

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === infographicRef.current)
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  async function toggleFullscreen() {
    setFullscreenError('')
    try {
      if (document.fullscreenElement === infographicRef.current) {
        await document.exitFullscreen()
      } else if (infographicRef.current?.requestFullscreen) {
        await infographicRef.current.requestFullscreen()
      } else {
        throw new Error('Fullscreen is not supported in this browser.')
      }
    } catch (error) {
      console.error('Unable to open the Speakia infographic in fullscreen.', error)
      setFullscreenError(error instanceof Error ? error.message : 'Fullscreen view is unavailable in this browser.')
    }
  }

  return <article ref={infographicRef} className="coach-infographic" style={paletteStyle}>
    <header className="coach-infographic-header">
      <span className="coach-infographic-mark"><Sparkles size={17} /></span>
      <div><span className="coach-infographic-eyebrow">{infographic.topic} · SPEAKING VISUAL</span><h2>{infographic.title}</h2><p>{infographic.summary}</p></div>
      <div className="coach-infographic-header-actions">
        <span className="coach-infographic-type">{infographic.layout.replace('-', ' ')}</span>
        <button type="button" className="coach-infographic-fullscreen" aria-label={isFullscreen ? 'Exit infographic fullscreen' : 'View infographic fullscreen'} title={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'} onClick={() => void toggleFullscreen()}>
          {isFullscreen ? <Minimize size={17} /> : <Expand size={17} />}
        </button>
      </div>
    </header>

    {infographic.layout === 'metric-grid' && <div className="coach-infographic-metrics">
      {infographic.metrics.map((metric, index) => <section key={`${metric.label}-${index}`}>
        <span>{String(index + 1).padStart(2, '0')}</span><strong>{metric.value}</strong><h3>{metric.label}</h3><p>{metric.detail}</p>
      </section>)}
    </div>}

    {infographic.layout === 'bar-chart' && <div className="coach-infographic-chart">
      <div className="coach-infographic-chart-legend"><BarChart3 size={16} /><span>Compare the key ideas</span><small>Relative values</small></div>
      <div className="coach-infographic-bars" role="img" aria-label={`${infographic.title}: ${infographic.data.map((item) => `${item.label}, ${item.value}`).join('; ')}`}>
        {infographic.data.map((item, index) => <div className="coach-infographic-bar-row" key={`${item.label}-${index}`}>
          <span className="coach-infographic-bar-label">{item.label}</span>
          <div className="coach-infographic-bar-track"><span style={{ width: `${Math.max(3, item.value / maximum * 100)}%`, animationDelay: `${index * 70}ms` }} /></div>
          <strong>{item.value}</strong>
        </div>)}
      </div>
      <svg className="coach-infographic-chart-decoration" viewBox="0 0 640 30" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 25 C80 22 82 8 160 14 S258 27 320 12 S440 7 480 16 S564 25 640 4" fill="none" stroke={palette.secondary} strokeOpacity=".7" strokeWidth="3" />
      </svg>
    </div>}

    {(infographic.layout === 'process' || infographic.layout === 'timeline') && <ol className={`coach-infographic-steps coach-infographic-steps-${infographic.layout}`}>
      {infographic.steps.map((step, index) => <li key={`${step.title}-${index}`}>
        <span className="coach-infographic-step-index">{infographic.layout === 'timeline' ? <Clock3 size={14} /> : String(index + 1).padStart(2, '0')}</span>
        <div><span className="coach-infographic-step-meta">{step.meta}</span><h3>{step.title}</h3><p>{step.body}</p></div>
        {index < infographic.steps.length - 1 && <span className="coach-infographic-step-connector" aria-hidden="true">{infographic.layout === 'timeline' ? <ArrowRight size={14} /> : <ArrowDown size={14} />}</span>}
      </li>)}
    </ol>}

    {infographic.layout === 'comparison' && <div className="coach-infographic-comparisons">
      {infographic.columns.map((column, index) => <section key={`${column.title}-${index}`}>
        <span className="coach-infographic-comparison-icon">{index === 0 ? <GitCompareArrows size={16} /> : <Check size={16} />}</span>
        <h3>{column.title}</h3><p>{column.summary}</p>
        <ul>{column.points.map((point, pointIndex) => <li key={`${point}-${pointIndex}`}><Check size={13} />{point}</li>)}</ul>
      </section>)}
    </div>}

    {infographic.layout === 'mind-map' && <div className="coach-infographic-mind-map">
      <div className="coach-infographic-mind-map-center"><span>THE BIG IDEA</span><strong>{infographic.summary}</strong></div>
      <div className="coach-infographic-mind-map-branches">{infographic.steps.map((step, index) => <section key={`${step.title}-${index}`}>
        <span>{step.meta || String(index + 1).padStart(2, '0')}</span><div><h3>{step.title}</h3><p>{step.body}</p></div>
      </section>)}</div>
    </div>}

    {(infographic.layout === 'funnel' || infographic.layout === 'pyramid') && <div className={`coach-infographic-stages coach-infographic-stages-${infographic.layout}`}>
      {(infographic.layout === 'pyramid' ? [...infographic.data].reverse() : infographic.data).map((item, index) => {
        const width = Math.max(34, item.value / maximum * 100)
        const order = index + 1
        return <div className="coach-infographic-stage" key={`${item.label}-${index}`}>
          <span className="coach-infographic-stage-number">{String(order).padStart(2, '0')}</span>
          <div className="coach-infographic-stage-bar" style={{ width: `${width}%` }}><strong>{item.label}</strong><span>{item.value}</span></div>
        </div>
      })}
    </div>}

    {infographic.layout === 'checklist' && <InfographicChecklist steps={infographic.steps} />}
    {infographic.knowledgeCheck && <KnowledgeCheck key={infographic.id} check={infographic.knowledgeCheck} />}

    <footer className="coach-infographic-footer"><span><Sparkles size={13} /> Personalized for your speaking practice</span><span>{infographic.knowledgeCheck || infographic.layout === 'checklist' ? 'Explore and practise' : 'Visual learning card'}</span></footer>
    {fullscreenError && <p className="coach-infographic-fullscreen-error" role="alert">{fullscreenError}</p>}
  </article>
}

function InfographicChecklist({ steps }: { steps: Infographic['steps'] }) {
  const [checked, setChecked] = useState<boolean[]>(() => steps.map(() => false))
  const completed = checked.filter(Boolean).length
  return <div className="coach-infographic-checklist">
    <div className="coach-infographic-checklist-progress"><span>Practice checklist</span><strong>{completed}/{steps.length} complete</strong><span className="coach-infographic-checklist-track"><span style={{ width: `${completed / steps.length * 100}%` }} /></span></div>
    {steps.map((step, index) => <button type="button" className={`coach-infographic-checklist-item ${checked[index] ? 'coach-infographic-checklist-item-checked' : ''}`} key={`${step.title}-${index}`} aria-pressed={checked[index]} onClick={() => setChecked((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value))}>
      <span className="coach-infographic-check">{checked[index] && <Check size={14} />}</span><span><small>{step.meta}</small><strong>{step.title}</strong><span>{step.body}</span></span>
    </button>)}
  </div>
}

function KnowledgeCheck({ check }: { check: NonNullable<Infographic['knowledgeCheck']> }) {
  const [selected, setSelected] = useState<number | null>(null)
  const answer = selected === null ? undefined : check.options[selected]
  return <section className="coach-infographic-quiz" aria-label="Quick knowledge check">
    <span className="coach-infographic-quiz-kicker"><Sparkles size={14} /> QUICK PRACTICE</span>
    <h3>{check.question}</h3>
    <div className="coach-infographic-quiz-options">{check.options.map((option, index) => <button type="button" key={`${option.label}-${index}`} className={selected === index ? 'coach-infographic-quiz-option-selected' : ''} aria-pressed={selected === index} onClick={() => setSelected(index)}><span>{String.fromCharCode(65 + index)}</span>{option.label}</button>)}</div>
    {answer && <p className={`coach-infographic-quiz-feedback ${answer.isCorrect ? 'coach-infographic-quiz-correct' : 'coach-infographic-quiz-incorrect'}`} role="status">{answer.isCorrect ? 'Exactly right. ' : 'Not quite. '}{answer.feedback}</p>}
  </section>
}
