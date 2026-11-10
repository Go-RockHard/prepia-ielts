import { useEffect, useMemo, useState } from 'react'
import { BarChart3, BookOpen, ClipboardCheck, Headphones, Layers3, Presentation, Search, Sparkles, X } from 'lucide-react'
import type { CoachAsset } from './assetsStorage'
import { coachAssetsUpdatedEvent, loadCoachAssets, saveCoachAssetInteraction } from './assetsStorage'
import { AdaptiveQuizWidget } from './AdaptiveQuizWidget'
import { InlineAudioLesson } from './InlineAudioLesson'
import { InlineInteractiveLesson } from './InlineInteractiveLesson'
import type { EmbeddedLearningModule } from './learningModules'
import type { InteractiveLesson } from './interactiveLesson'
import { InlineInfographic } from './InlineInfographic'

type AssetKind = 'all' | CoachAsset['kind']

const filters: { value: AssetKind; label: string; icon: typeof Sparkles }[] = [
  { value: 'all', label: 'All assets', icon: Layers3 },
  { value: 'lesson', label: 'Lessons', icon: Sparkles },
  { value: 'flashcards', label: 'Flashcards', icon: BookOpen },
  { value: 'slides', label: 'Slide decks', icon: Presentation },
  { value: 'quiz', label: 'Quizzes', icon: ClipboardCheck },
  { value: 'audio-lesson', label: 'Audio lessons', icon: Headphones },
  { value: 'infographic', label: 'Infographics', icon: BarChart3 },
]

function assetLabel(kind: CoachAsset['kind']): string {
  if (kind === 'lesson') return 'Interactive lesson'
  if (kind === 'slides') return 'Slide deck'
  if (kind === 'flashcards') return 'Flashcards'
  if (kind === 'quiz') return 'Interactive quiz'
  if (kind === 'infographic') return 'Interactive infographic'
  return 'Audio lesson'
}

export function CoachAssetsPage({ platform = 'speaking', onOpenCoach, onAdapt }: {
  platform?: 'speaking' | 'writing'
  onOpenCoach: () => void
  onAdapt: (asset: InteractiveLesson | EmbeddedLearningModule) => void
}) {
  const isWriting = platform === 'writing'
  const coachName = isWriting ? 'Writia Assistant' : 'Speakia Coach'
  const [assets, setAssets] = useState(() => loadCoachAssets(platform))
  const [kind, setKind] = useState<AssetKind>('all')
  const [topic, setTopic] = useState('All topics')
  const [search, setSearch] = useState('')
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const refreshAssets = () => setAssets(loadCoachAssets(platform))
    window.addEventListener(coachAssetsUpdatedEvent, refreshAssets)
    return () => window.removeEventListener(coachAssetsUpdatedEvent, refreshAssets)
  }, [platform])

  const topics = useMemo(() => [...new Set(assets.map((asset) => asset.topic.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [assets])
  const counts = useMemo(() => ({
    all: assets.length,
    lesson: assets.filter((asset) => asset.kind === 'lesson').length,
    flashcards: assets.filter((asset) => asset.kind === 'flashcards').length,
    slides: assets.filter((asset) => asset.kind === 'slides').length,
    quiz: assets.filter((asset) => asset.kind === 'quiz').length,
    'audio-lesson': assets.filter((asset) => asset.kind === 'audio-lesson').length,
    infographic: assets.filter((asset) => asset.kind === 'infographic').length,
  }), [assets])
  const visibleFilters = isWriting ? filters.filter((filter) => filter.value !== 'infographic') : filters
  const visibleAssets = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return assets.filter((asset) => {
      if (kind !== 'all' && asset.kind !== kind) return false
      if (topic !== 'All topics' && asset.topic !== topic) return false
      if (!query) return true
      const content = asset.kind === 'quiz'
        ? asset.quiz.questions.map((question) => question.question).join(' ')
        : asset.kind === 'lesson'
          ? asset.lesson.html
            .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
          : asset.kind === 'audio-lesson'
            ? asset.audioLesson.transcript
            : asset.kind === 'infographic'
              ? JSON.stringify(asset.infographic)
              : `${asset.module.summary} ${asset.module.items.map((item) => `${item.title} ${item.body}`).join(' ')}`
      return `${asset.title} ${asset.topic} ${asset.summary} ${content}`.toLocaleLowerCase().includes(query)
    })
  }, [assets, kind, search, topic])

  function recordInteraction(assetId: string, interaction: string) {
    setError('')
    try {
      saveCoachAssetInteraction(assetId, interaction, platform)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Asset progress could not be saved.')
    }
  }

  return <div className="page-content inner-page coach-assets-page">
    <div className="inner-page-heading">
      <div><p className="eyebrow">YOUR {isWriting ? 'WRITIA ASSISTANT' : 'SPEAKIA COACH'} LIBRARY</p><h1>{isWriting ? 'Writia Coach Assets' : 'Speakia Coach Assets'}</h1><p className="page-subtitle">Every lesson, flashcard set, deck, quiz, and audio lesson your {isWriting ? 'Writia Assistant' : 'Speakia Coach'} has created—organized in one place.</p></div>
      <button className="start-button coach-assets-create" type="button" onClick={onOpenCoach}><Sparkles size={15} /> {isWriting ? 'Ask Writia' : 'Ask Speakia'}</button>
    </div>
    <section className="coach-assets-overview" aria-label="Asset library summary">
      <span className="coach-assets-overview-icon"><Layers3 size={22} /></span>
      <div><span className="section-kicker">YOUR LEARNING LIBRARY</span><strong>{assets.length} {assets.length === 1 ? 'asset' : 'assets'}</strong><p>Generated in your {isWriting ? 'Writia Assistant' : 'Speakia Coach'} conversations</p></div>
      <div className="coach-assets-type-summary">{visibleFilters.slice(1).map((filter) => {
        const Icon = filter.icon
        return <span key={filter.value}><Icon size={14} />{counts[filter.value]} {filter.label.toLocaleLowerCase()}</span>
      })}</div>
    </section>
    <div className="coach-assets-controls">
      <label className="coach-assets-search"><Search size={17} /><input aria-label="Search coach assets" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets, topics, or content…" />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><X size={15} /></button>}</label>
      <label className="coach-assets-topic">Topic<select value={topic} onChange={(event) => setTopic(event.target.value)}><option>All topics</option>{topics.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    <div className="coach-assets-filters" role="group" aria-label={`Filter ${isWriting ? 'Writia' : 'Speakia'} coach assets by category`}>{visibleFilters.map((filter) => {
      const Icon = filter.icon
      return <button key={filter.value} type="button" className={`coach-assets-filter ${kind === filter.value ? 'coach-assets-filter-active' : ''}`} aria-pressed={kind === filter.value} onClick={() => setKind(filter.value)}><Icon size={15} />{filter.label}<span>{counts[filter.value]}</span></button>
    })}</div>
    {error && <p className="coach-assets-error" role="alert">{error}</p>}
    {visibleAssets.length ? <div className="coach-assets-grid">{visibleAssets.map((asset) => {
      const expanded = expandedAsset === asset.id
      const activityLabel = asset.kind === 'quiz'
        ? `${asset.quiz.questions.length} questions`
        : asset.kind === 'audio-lesson'
          ? 'Spoken lesson'
          : asset.kind === 'infographic'
            ? `${asset.infographic.layout.replace('-', ' ')}${asset.infographic.knowledgeCheck || asset.infographic.layout === 'checklist' ? ' · interactive' : ' visual'}`
          : `${asset.kind === 'lesson' ? asset.lesson.interactions.length : asset.module.interactions.length} activities explored`
      return <article className={`coach-asset-card ${expanded ? 'coach-asset-card-expanded' : ''}`} key={asset.id}>
        <div className="coach-asset-card-heading"><span className={`coach-asset-icon coach-asset-icon-${asset.kind}`}>{asset.kind === 'lesson' ? <Sparkles size={17} /> : asset.kind === 'slides' ? <Presentation size={17} /> : asset.kind === 'flashcards' ? <BookOpen size={17} /> : asset.kind === 'audio-lesson' ? <Headphones size={17} /> : asset.kind === 'infographic' ? <BarChart3 size={17} /> : <ClipboardCheck size={17} />}</span><span className="coach-asset-kind">{assetLabel(asset.kind)}</span><span className="coach-asset-topic">{asset.topic}</span></div>
        <h2>{asset.title}</h2>
        <p className="coach-asset-summary">{asset.summary}</p>
        <div className="coach-asset-footer"><span>{activityLabel}</span><button type="button" onClick={() => { setExpandedAsset(expanded ? null : asset.id); setError('') }} aria-expanded={expanded}>{expanded ? 'Close asset' : 'Open asset'}</button></div>
        {expanded && <div className="coach-asset-preview">
          {asset.kind === 'quiz'
            ? <AdaptiveQuizWidget key={asset.id} quiz={asset.quiz} />
            : asset.kind === 'audio-lesson'
              ? <InlineAudioLesson key={asset.id} lesson={asset.audioLesson} />
              : asset.kind === 'infographic'
                ? <InlineInfographic key={asset.id} infographic={asset.infographic} />
              : <InlineInteractiveLesson key={asset.id} lesson={asset.kind === 'lesson' ? asset.lesson : asset.module} onProgress={recordInteraction} onAdapt={onAdapt} />}
        </div>}
      </article>
    })}</div> : <section className="coach-assets-empty"><span className="coach-assets-empty-icon"><Sparkles size={22} /></span><h2>{assets.length ? 'No assets match those filters' : `${coachName} library is ready for its first asset`}</h2><p>{assets.length ? 'Try a different search or category, or clear the topic filter.' : `Ask ${coachName} to create an interactive lesson, audio lesson, flashcard set, slide deck, quiz${isWriting ? '' : ', or infographic'}. New assets will appear here and stay available in chat.`}</p>{assets.length ? <button type="button" onClick={() => { setSearch(''); setTopic('All topics'); setKind('all') }}>Clear filters</button> : <button type="button" onClick={onOpenCoach}><Sparkles size={15} /> {isWriting ? 'Ask Writia' : 'Ask Speakia'}</button>}</section>}
  </div>
}
