import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Bookmark, Clock3, Filter, Play, Search, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { TestPart } from '@/features/simulator/types'
import { topicCategories, type TopicBankPrompt, type TopicCategory } from './types'
import { bankPrompts, modelAnswerFor } from './topicPrompts'
import { ModelAnswerAudioPlayer } from './ModelAnswerAudioPlayer'

const categories: ('All Topics' | TopicCategory)[] = ['All Topics', ...topicCategories]

const partFilters: { value: TestPart | 'all'; label: string }[] = [
  { value: 'all', label: 'All Parts' },
  { value: 'full', label: 'Full Mock Test' },
  { value: 'part1', label: 'Part 1' },
  { value: 'part2', label: 'Part 2 Cue Cards' },
  { value: 'part3', label: 'Part 3' },
]

export function TopicBankPage({
  apiKey,
  customPrompts,
  pinnedIds,
  onTogglePin,
  onPractice,
  onStartCoachLive,
}: {
  apiKey: string
  customPrompts: TopicBankPrompt[]
  pinnedIds: string[]
  onTogglePin: (id: string) => void
  onPractice: (part: TestPart, prompt?: TopicBankPrompt) => void
  onStartCoachLive: (topic: string, context: string) => void
}) {
  const [category, setCategory] = useState<(typeof categories)[number]>('All Topics')
  const [part, setPart] = useState<TestPart | 'all'>('all')
  const [search, setSearch] = useState('')
  const [pinFilter, setPinFilter] = useState<'all' | 'pinned' | 'unpinned'>('all')
  const availablePrompts = useMemo(() => [...customPrompts, ...bankPrompts], [customPrompts])
  const filteredPrompts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return availablePrompts.filter((prompt) =>
      (part === 'all' || part === 'full' || prompt.part === part)
      && (category === 'All Topics' || prompt.category === category)
      && (pinFilter === 'all' || (pinFilter === 'pinned') === pinnedIds.includes(`topic:${prompt.id}`))
      && (!term || [prompt.topic, prompt.question, ...prompt.vocabulary, ...(prompt.cuePoints ?? []), modelAnswerFor(prompt)]
        .some((value) => value.toLocaleLowerCase().includes(term))),
    ).sort((first, second) => first.part.localeCompare(second.part))
  }, [availablePrompts, category, part, pinFilter, pinnedIds, search])

  return (
    <div className="page-content inner-page topic-bank-page">
      <div className="inner-page-heading">
        <div>
          <p className="eyebrow">PRACTISE WITH PURPOSE</p>
          <h1>IELTS Speaking Question &amp; Topic Bank</h1>
          <p className="page-subtitle">Browse practice prompts for Part 1, Part 2 cue cards, Part 3 discussion, or a complete mock-test sequence.</p>
        </div>
        <Badge className="topic-bank-count">{filteredPrompts.length} prompts</Badge>
      </div>

      <Card className="topic-bank-search-card">
        <label className="topic-bank-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search topics, questions, or useful vocabulary…" aria-label="Search the Topic Bank" /></label>
        <div className="topic-bank-parts" aria-label="Filter questions by test part">
          {partFilters.map((filter) => <button type="button" key={filter.value} className={part === filter.value ? 'topic-bank-filter-active' : ''} aria-pressed={part === filter.value} onClick={() => setPart(filter.value)}><Filter size={13} />{filter.label}</button>)}
        </div>
        <div className="topic-bank-categories" aria-label="Filter by topic category">
          {categories.map((item) => <button type="button" key={item} className={category === item ? 'topic-bank-category-active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
        <div className="topic-bank-pin-filters" role="group" aria-label="Filter pinned prompts">
          {([{ id: 'all', label: 'All prompts' }, { id: 'pinned', label: 'Pinned' }, { id: 'unpinned', label: 'Unpinned' }] as const).map((filter) => (
            <button key={filter.id} type="button" className={pinFilter === filter.id ? 'topic-bank-pin-filter-active' : ''} aria-pressed={pinFilter === filter.id} onClick={() => setPinFilter(filter.id)}>{filter.label}<span>{filter.id === 'all' ? availablePrompts.length : availablePrompts.filter((prompt) => pinnedIds.includes(`topic:${prompt.id}`) === (filter.id === 'pinned')).length}</span></button>
          ))}
        </div>
      </Card>

      {part === 'full' && <Card className="topic-bank-mock-callout"><BookOpen size={19} /><div><strong>Full mock-test sequence</strong><p>Work through Part 1 warm-up questions, one Part 2 cue card, and Part 3 discussion prompts. Choose any prompt below to practise that part with Speakia Coach, or launch a full examiner simulation.</p></div><Button className="start-button" onClick={() => onPractice('full')}><Play size={14} /> Start full mock test</Button></Card>}

      <div className="topic-bank-results-heading"><div><h2>{part === 'full' ? 'Mock test question sequence' : category === 'All Topics' ? 'Speaking questions' : category}</h2><p>{filteredPrompts.length} questions · {part === 'full' ? 'all three test parts' : part === 'all' ? 'all test parts' : partFilters.find((item) => item.value === part)?.label}</p></div><span><Clock3 size={15} /> Part 2 preparation: 1 minute</span></div>

      {filteredPrompts.length
        ? <div className="topic-bank-grid">{filteredPrompts.map((prompt) => (
          <Card className={`topic-bank-card ${pinnedIds.includes(`topic:${prompt.id}`) ? 'topic-bank-card-pinned' : ''}`} key={prompt.id}>
            <div className="topic-bank-card-top"><Badge className={`topic-part-badge topic-part-${prompt.part}`}>{prompt.part === 'part1' ? 'PART 1 · WARM-UP' : prompt.part === 'part2' ? 'PART 2 · CUE CARD' : 'PART 3 · DISCUSSION'}</Badge><span>{prompt.category}</span><button type="button" className="learning-pin-button" aria-label={`${pinnedIds.includes(`topic:${prompt.id}`) ? 'Unpin' : 'Pin'} ${prompt.topic}`} aria-pressed={pinnedIds.includes(`topic:${prompt.id}`)} onClick={() => onTogglePin(`topic:${prompt.id}`)}><Bookmark size={15} fill={pinnedIds.includes(`topic:${prompt.id}`) ? 'currentColor' : 'none'} /></button></div>
            <h3>{prompt.topic}</h3>
            <p className="topic-bank-question">{prompt.question}</p>
            {prompt.cuePoints && <div className="topic-cue-points"><strong>You should say:</strong><ul>{prompt.cuePoints.map((point) => <li key={point}>{point}</li>)}</ul></div>}
            <div className="topic-vocab"><span><Sparkles size={13} /> Useful vocabulary</span><div>{prompt.vocabulary.map((word) => <Badge key={word}>{word}</Badge>)}</div></div>
            <details className="topic-model-answer"><summary><BookOpen size={14} /> View model answer</summary><p>{modelAnswerFor(prompt)}</p><small>Use this as an example and adapt the details to your own experience.</small><ModelAnswerAudioPlayer promptId={prompt.id} answer={modelAnswerFor(prompt)} apiKey={apiKey} /></details>
            <div className="topic-bank-card-footer"><span>{prompt.part === 'part2' ? '1 min prep · 1–2 min speaking' : prompt.part === 'part1' ? 'Short personal response' : 'Develop and explain your view'}</span><div className="topic-bank-card-actions"><Button variant="outline" size="sm" aria-label={`Use ${prompt.topic} in Practice`} onClick={() => onPractice(prompt.part, prompt)}><Play size={13} /> Use in practice <ArrowRight size={13} /></Button><Button variant="outline" size="sm" aria-label={`Ask Speakia about ${prompt.topic}`} onClick={() => onStartCoachLive(prompt.topic, [
              `IELTS Speaking ${prompt.part.replace('part', 'Part ')}`,
              `Question/cue card: ${prompt.question}`,
              ...(prompt.cuePoints?.length ? [`Cue points: ${prompt.cuePoints.join('; ')}`] : []),
              `Useful vocabulary: ${prompt.vocabulary.join(', ')}`,
              `Illustrative model answer: ${modelAnswerFor(prompt)}`,
            ].join('\n'))}><Play size={13} /> Ask Speakia <ArrowRight size={13} /></Button></div></div>
          </Card>
        ))}</div>
        : <Card className="topic-bank-empty"><Search size={21} /><h2>No matching questions</h2><p>Try another search or clear the topic, test-part, or pinned filters.</p><Button variant="outline" onClick={() => { setSearch(''); setCategory('All Topics'); setPart('all'); setPinFilter('all') }}>Clear filters</Button></Card>}
    </div>
  )
}
