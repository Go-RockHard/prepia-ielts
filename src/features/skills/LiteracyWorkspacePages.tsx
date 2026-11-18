import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpenCheck, ClipboardCheck, Search, Target, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { UserProfile } from '@/features/profile/localAccount'
import { CONTENT_GENERATION_MODELS, LISTENING_TTS_MODELS, generateAndSavePracticePackage } from '@/features/skills/literacyAi'
import { getTopicPresets, type TopicPreset } from '@/features/skills/literacyTopics'
import { isLocalTopicUsed, type LocalContentPackage, type SkillAttempt, type SkillProduct } from '@/features/skills/literacyStorage'
import type { PracticeSet, SkillQuestion } from '@/features/skills/questionTypes'

type LiteracyAssignment = {
  id: string
  setId: string
  title: string
  focus: string
  status: 'assigned' | 'completed'
  createdAt: string
}

const questionTypeDrills: Array<{ label: string; types: SkillQuestion['type'][]; generationType: SkillQuestion['type']; guidance: string }> = [
  { label: 'Multiple choice', types: ['multiple-choice'], generationType: 'multiple-choice', guidance: 'Compare each option with the source and reject distractors unsupported by evidence.' },
  { label: 'Multiple choice · multiple answers', types: ['multiple-select'], generationType: 'multiple-select', guidance: 'Check the number of required choices and verify each choice independently.' },
  { label: 'Matching headings', types: ['matching-headings'], generationType: 'matching-headings', guidance: 'Identify the paragraph’s central idea rather than matching a repeated detail.' },
  { label: 'Matching information', types: ['matching-information'], generationType: 'matching-information', guidance: 'Scan for names, dates, and paraphrased details, then verify the surrounding context.' },
  { label: 'Matching features', types: ['matching-features'], generationType: 'matching-features', guidance: 'Track which person, group, or category supports each statement.' },
  { label: 'Matching sentence endings', types: ['matching-sentence-endings'], generationType: 'matching-sentence-endings', guidance: 'Read the sentence stem for meaning and grammar before comparing endings.' },
  { label: 'Matching items', types: ['matching'], generationType: 'matching', guidance: 'Match each item using its meaning and the source evidence, not just repeated words.' },
  { label: 'Sentence / summary completion', types: ['sentence-completion'], generationType: 'sentence-completion', guidance: 'Predict the answer form, respect the word limit, and check grammar against the source.' },
  { label: 'Form / table completion', types: ['completion'], generationType: 'completion', guidance: 'Read the row and column labels, predict the missing information, and check the word limit.' },
  { label: 'Note completion', types: ['note-completion'], generationType: 'note-completion', guidance: 'Follow the note structure and use nearby signposts to anticipate each missing detail.' },
  { label: 'Diagram labelling', types: ['labeling'], generationType: 'labeling', guidance: 'Follow spatial or process relationships and match labels to the relevant source detail.' },
  { label: 'Flow-chart completion', types: ['flow-chart'], generationType: 'flow-chart', guidance: 'Follow the sequence and identify cause, action, and outcome links in the source.' },
  { label: 'Classification', types: ['classification'], generationType: 'classification', guidance: 'Compare each statement against the exact categories and supporting evidence.' },
  { label: 'Short answer', types: ['short-answer'], generationType: 'short-answer', guidance: 'Locate the specific fact and keep the response within the stated word limit.' },
]

const questionTypeGroups = [
  { title: 'Choose & classify', types: ['multiple-choice', 'multiple-select', 'classification'] },
  { title: 'Match & locate', types: ['matching-headings', 'matching-information', 'matching-features', 'matching-sentence-endings', 'matching'] },
  { title: 'Complete & label', types: ['sentence-completion', 'completion', 'note-completion', 'labeling', 'flow-chart', 'short-answer'] },
]

function assignmentStorageKey(username: string, product: SkillProduct): string {
  return `prepia-${product}-assignments-v1:${username.trim().toLocaleLowerCase()}`
}

function loadAssignments(username: string, product: SkillProduct): LiteracyAssignment[] {
  try {
    const stored = localStorage.getItem(assignmentStorageKey(username, product))
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every((item) =>
      typeof item === 'object' && item !== null
      && 'id' in item && typeof item.id === 'string'
      && 'setId' in item && typeof item.setId === 'string'
      && 'title' in item && typeof item.title === 'string'
      && 'focus' in item && typeof item.focus === 'string'
      && 'status' in item && (item.status === 'assigned' || item.status === 'completed')
      && 'createdAt' in item && typeof item.createdAt === 'string')) {
      throw new Error('Saved receptive-skill assignments are not in a supported format.')
    }
    return parsed as LiteracyAssignment[]
  } catch (error) {
    console.error(`Unable to load ${product} assignments from this browser.`, error)
    throw new Error('Saved assignments could not be loaded. Clear the damaged assignment data from browser storage or contact support.')
  }
}

function persistAssignments(username: string, product: SkillProduct, assignments: LiteracyAssignment[]): void {
  try {
    localStorage.setItem(assignmentStorageKey(username, product), JSON.stringify(assignments))
  } catch (error) {
    console.error(`Unable to save ${product} assignments in this browser.`, error)
    throw new Error('The assignment could not be saved on this device. Check available browser storage and try again.')
  }
}

export function LiteracyLearnerProfile({ product, profile, attempts, onSave }: {
  product: SkillProduct
  profile: UserProfile
  attempts: SkillAttempt[]
  onSave: (profile: UserProfile) => Promise<void>
}) {
  const isReading = product === 'readia'
  const skill = isReading ? 'reading' : 'listening'
  const label = isReading ? 'Reading' : 'Listening'
  const targetKey = isReading ? 'readingTargetBand' : 'listeningTargetBand'
  const dateKey = isReading ? 'readingTestDate' : 'listeningTestDate'
  const goalKey = isReading ? 'readingStudyGoal' : 'listeningStudyGoal'
  const [target, setTarget] = useState(profile[targetKey] ?? '')
  const [testDate, setTestDate] = useState(profile[dateKey] ?? '')
  const [goal, setGoal] = useState(profile[goalKey] ?? '')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const baseline = isReading ? profile.readingPlacementBaseline : profile.listeningPlacementBaseline
  const recentAttempts = useMemo(() => attempts.slice(0, 5), [attempts])
  const observedAccuracy = attempts.reduce((summary, attempt) => ({
    score: summary.score + attempt.score,
    total: summary.total + attempt.total,
  }), { score: 0, total: 0 })

  async function save() {
    setSaving(true)
    setSaveMessage('')
    try {
      await onSave({
      ...profile,
      [targetKey]: target,
      [dateKey]: testDate,
      [goalKey]: goal,
      })
      setSaveMessage(`${label} goals saved on this device.`)
    } catch (error) {
      console.error(`Unable to save the ${skill} learner profile.`, error)
      setSaveMessage(error instanceof Error ? error.message : `The ${label} profile could not be saved.`)
    } finally {
      setSaving(false)
    }
  }

  return <section className={`page-content inner-page literacy-page literacy-${product}`}>
    <header className="literacy-heading"><div><p className="eyebrow">PREPIA IELTS · {label.toLocaleUpperCase()} PROFILE</p><h1>{label} learner profile</h1><p className="page-subtitle">A skill-specific view of your goals and observed practice evidence.</p></div><span className="literacy-heading-icon"><UserRound size={24} /></span></header>
    <div className="literacy-workspace-grid">
      <Card className="literacy-progress"><div className="literacy-section-heading"><div><span className="section-kicker">YOUR PLAN</span><h2>{label} goals</h2></div></div>
        <label className="literacy-profile-field">Target band<input inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="e.g. 7.0" /></label>
        <label className="literacy-profile-field">Planned test date<input type="date" value={testDate} onChange={(event) => setTestDate(event.target.value)} /></label>
        <label className="literacy-profile-field">Study goal<textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} placeholder={`What would you like to improve in ${skill}?`} /></label>
        <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : `Save ${label} goals`}</Button>
        {saveMessage && <p className={saveMessage.includes('could not') || saveMessage.includes('Unable') ? 'literacy-error' : 'literacy-analytics-provenance'} role={saveMessage.includes('could not') || saveMessage.includes('Unable') ? 'alert' : 'status'}>{saveMessage}</p>}
      </Card>
      <Card className="literacy-progress"><div className="literacy-section-heading"><div><span className="section-kicker">BASELINE &amp; PRACTICE</span><h2>Observed evidence</h2></div></div>
        {baseline ? <p className="literacy-analytics-provenance">Placement diagnostic: {baseline.score} of {baseline.total} marks ({Math.round(baseline.score / Math.max(1, baseline.total) * 100)}%) on {new Date(baseline.completedAt).toLocaleDateString()}. This is a local practice baseline, not an official IELTS band score.</p> : <p className="literacy-analytics-provenance">No {skill} placement diagnostic has been completed yet. You can take one from Placement Assessment.</p>}
        {attempts.length > 0 ? <><p className="literacy-analytics-provenance">Across {attempts.length} completed practice attempts: {observedAccuracy.score} of {observedAccuracy.total} marks ({Math.round(observedAccuracy.score / Math.max(1, observedAccuracy.total) * 100)}%) observed accuracy. Accuracy is not converted into a band score.</p><h3>Recent activity</h3><ul className="literacy-workspace-list">{recentAttempts.map((attempt) => <li key={attempt.id}><span>{attempt.title}</span><strong>{attempt.score}/{attempt.total}</strong><small>{new Date(attempt.completedAt).toLocaleDateString()}</small></li>)}</ul></> : <p>No completed practice is recorded on this device yet.</p>}
      </Card>
    </div>
  </section>
}

function savedModel<T extends string>(key: string, models: ReadonlyArray<{ id: T }>, fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    return models.find((model) => model.id === stored)?.id ?? fallback
  } catch (error) {
    console.error('Unable to load a saved receptive drill model preference.', error)
    return fallback
  }
}

function saveModelPreference(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    console.error('Unable to save a receptive drill model preference.', error)
    return false
  }
}

export function LiteracyDrillsPage({ product, username, testType, apiKey, packages, onPractice }: {
  product: SkillProduct
  username: string
  testType: 'Academic' | 'General Training'
  apiKey: string
  packages: LocalContentPackage[]
  onPractice: (content: LocalContentPackage) => void
}) {
  const skill = product === 'readia' ? 'Reading' : 'Listening'
  const topicPresets = useMemo(() => getTopicPresets(product, testType), [product, testType])
  const [availableTopics, setAvailableTopics] = useState<TopicPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [customTopic, setCustomTopic] = useState('')
  const [customAngle, setCustomAngle] = useState('')
  const [generationModel, setGenerationModel] = useState(() => savedModel(`prepia.receptive-content-studio.${product}.generation`, CONTENT_GENERATION_MODELS, CONTENT_GENERATION_MODELS[0].id))
  const [reviewModel, setReviewModel] = useState(() => savedModel(`prepia.receptive-content-studio.${product}.review`, CONTENT_GENERATION_MODELS, CONTENT_GENERATION_MODELS[0].id))
  const [ttsModel, setTtsModel] = useState(() => savedModel('prepia.receptive-content-studio.listenia.tts', LISTENING_TTS_MODELS, LISTENING_TTS_MODELS[0].id))
  const [generatingType, setGeneratingType] = useState<SkillQuestion['type'] | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create')
  const [libraryQuery, setLibraryQuery] = useState('')
  const savedDrills = useMemo(() => packages
    .filter((content) => content.source === 'generated' && content.status !== 'archived' && !content.set.fullLength
      && (content.set.isFocusedDrill || new Set(content.set.questions.map((question) => question.type)).size === 1)), [packages])
  const filteredSavedDrills = useMemo(() => {
    const query = libraryQuery.trim().toLocaleLowerCase()
    return savedDrills.filter((content) => {
      const typeLabels = content.set.questions.map((question) =>
        questionTypeDrills.find((drill) => drill.types.includes(question.type))?.label ?? question.type.replaceAll('-', ' '),
      ).join(' ')
      return !query || `${content.title} ${content.topicFingerprint} ${typeLabels}`.toLocaleLowerCase().includes(query)
    })
  }, [libraryQuery, savedDrills])

  useEffect(() => {
    let active = true
    void Promise.all(topicPresets.map(async (preset) => ({
      preset,
      used: await isLocalTopicUsed(username, `${preset.topic} ${preset.angle}`),
    }))).then((results) => {
      if (!active) return
      const available = results.filter(({ used }) => !used).map(({ preset }) => preset)
      setAvailableTopics(available)
      setSelectedPresetId((current) => available.some((preset) => preset.id === current) ? current : available[0]?.id ?? '')
    }).catch((caughtError: unknown) => {
      console.error(`Unable to check ${skill} drill topic history.`, caughtError)
      if (active) setError(caughtError instanceof Error ? caughtError.message : 'Local topic history could not be checked.')
    })
    return () => { active = false }
  }, [skill, topicPresets, username])

  async function startDrill(drill: typeof questionTypeDrills[number]) {
    setError('')
    setStatus('')
    const existing = packages.find((content) => content.status !== 'archived'
      && !content.set.fullLength
      && content.set.questions.length > 0
      && content.set.questions.every((question) => drill.types.includes(question.type)))
    if (existing) {
      onPractice(existing)
      return
    }
    if (!apiKey.trim()) {
      setError('Add your Prepia AI access key in shared Settings before generating a question-type drill.')
      return
    }
    const selectedPreset = availableTopics.find((preset) => preset.id === selectedPresetId)
    const topic = customTopic.trim() || selectedPreset?.topic || ''
    const topicAngle = customTopic.trim() ? customAngle.trim() : selectedPreset?.angle || ''
    if (!topic || !topicAngle) {
      setError('Select an unused topic preset or enter both a topic and a specific angle.')
      return
    }
    try {
      if (await isLocalTopicUsed(username, `${topic} ${topicAngle}`)) {
        setError('This topic or a closely related one is already in your local practice history. Choose another unused topic.')
        return
      }
      setGeneratingType(drill.generationType)
      const generated = await generateAndSavePracticePackage(apiKey, {
        product,
        username,
        topic,
        topicAngle,
        level: 'Intermediate',
        questionCount: 5,
        minutes: product === 'readia' ? 8 : 7,
        testType,
        contentMode: 'drill',
        questionTypes: [drill.generationType],
        generationModel,
        reviewModel,
        ...(product === 'listenia' ? { ttsModel } : {}),
      })
      setStatus(`Generated, validated, independently reviewed, and saved “${generated.content.title}” in this browser.${generated.warnings.length ? ` ${generated.warnings.join(' ')}` : ''}`)
      onPractice(generated.content)
    } catch (caughtError) {
      console.error(`Unable to generate a ${skill} ${drill.label} drill.`, caughtError)
      setError(caughtError instanceof Error ? caughtError.message : `The ${skill} drill could not be generated.`)
    } finally {
      setGeneratingType(null)
    }
  }

  return <section className={`page-content inner-page literacy-page literacy-${product}`}>
    <header className="literacy-heading"><div><p className="eyebrow">PREPIA IELTS · SKILL DRILLS</p><h1>{skill} drills</h1><p className="page-subtitle">Build focused exercises by question type or revisit saved drills with the live tutor.</p></div><span className="literacy-heading-icon"><BookOpenCheck size={24} /></span></header>
    <div className="literacy-drill-tabs" role="tablist" aria-label={`${skill} drills workspace`}>
      <button type="button" role="tab" aria-selected={activeTab === 'create'} className={activeTab === 'create' ? 'literacy-drill-tab-active' : ''} onClick={() => setActiveTab('create')}>
        <BookOpenCheck size={16} /><span><strong>Create a drill</strong><small>Question types &amp; source topics</small></span>
      </button>
      <button type="button" role="tab" aria-selected={activeTab === 'library'} className={activeTab === 'library' ? 'literacy-drill-tab-active' : ''} onClick={() => setActiveTab('library')}>
        <Search size={16} /><span><strong>Drill library</strong><small>{savedDrills.length} saved for repeat practice</small></span>
      </button>
    </div>
    {activeTab === 'create' && <>
    <Card className="literacy-drill-setup"><div><span className="section-kicker">AI DRILL GENERATION</span><h2>Create a focused, original exercise</h2><p>When no saved exercise exists for a format, the authoring workflow creates source material, writes matching questions, validates answers and evidence, runs an independent review, and saves the draft locally before practice.</p></div>
      <label>Unused topic preset<select value={selectedPresetId} onChange={(event) => setSelectedPresetId(event.target.value)}><option value="">Choose an available topic</option>{availableTopics.map((preset) => <option key={preset.id} value={preset.id}>{preset.topic} — {preset.angle}</option>)}</select></label>
      <div className="literacy-drill-topic-override"><label>Or enter another topic<input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="e.g. Community garden design" maxLength={120} /></label><label>Topic angle<input value={customAngle} onChange={(event) => setCustomAngle(event.target.value)} placeholder="A specific question or perspective" maxLength={180} /></label></div>
      <div className="literacy-drill-models"><label>Authoring model<select value={generationModel} onChange={(event) => { const value = event.target.value as typeof generationModel; setGenerationModel(value); if (!saveModelPreference(`prepia.receptive-content-studio.${product}.generation`, value)) setError('The selected authoring model will be used for this visit but could not be saved in browser storage.') }}>{CONTENT_GENERATION_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label><label>Review model<select value={reviewModel} onChange={(event) => { const value = event.target.value as typeof reviewModel; setReviewModel(value); if (!saveModelPreference(`prepia.receptive-content-studio.${product}.review`, value)) setError('The selected review model will be used for this visit but could not be saved in browser storage.') }}>{CONTENT_GENERATION_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label>{product === 'listenia' && <label>Voice model<select value={ttsModel} onChange={(event) => { const value = event.target.value as typeof ttsModel; setTtsModel(value); if (!saveModelPreference('prepia.receptive-content-studio.listenia.tts', value)) setError('The selected voice model will be used for this visit but could not be saved in browser storage.') }}>{LISTENING_TTS_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label>}</div>
      {!apiKey.trim() && <p className="literacy-analytics-provenance">Connect your shared AI key in Settings to generate new exercises. Saved drills remain available without generation.</p>}
      {error && <p className="literacy-error" role="alert">{error}</p>}
      {status && <p className="literacy-analytics-provenance" role="status">{status}</p>}
    </Card>
    <div className="literacy-drill-categories">{questionTypeGroups.map((group) => <section className="literacy-drill-category" key={group.title}>
      <div className="literacy-section-heading"><div><span className="section-kicker">QUESTION FAMILIES</span><h2>{group.title}</h2></div><span>{group.types.length} types</span></div>
      <div className="literacy-drill-grid">{questionTypeDrills.filter((drill) => group.types.includes(drill.generationType)).map((drill) => {
      const existing = packages.find((content) => content.status !== 'archived'
        && !content.set.fullLength
        && content.set.questions.length > 0
        && content.set.questions.every((question) => drill.types.includes(question.type)))
      const generating = generatingType === drill.generationType
      return <Card className="literacy-drill-card" key={drill.label}><span className="section-kicker">QUESTION-TYPE DRILL</span><h2>{drill.label}</h2><p>{existing ? `${drill.guidance} Use your saved exercise “${existing.title}”.` : `${drill.guidance} A new source passage or listening script and question set will be generated for this format when requested.`}</p><Button type="button" variant={existing ? 'default' : 'outline'} disabled={Boolean(generatingType)} onClick={() => void startDrill(drill)}>{generating ? 'Generating and reviewing…' : existing ? 'Start saved drill' : 'Generate AI drill'}{!generating && <ArrowRight size={14} />}</Button></Card>
    })}</div>
    </section>)}</div>
    </>}
    {activeTab === 'library' && <Card className="literacy-drill-library">
      <div className="literacy-section-heading"><div><span className="section-kicker">YOUR LOCAL LIBRARY</span><h2>Generated drills</h2></div><span>{savedDrills.length} saved</span></div>
      <p className="literacy-analytics-provenance">Generated and reviewed exercises stay in this browser. Reopen any drill as many times as you like with its full source, answer key, explanations, and live {skill.toLocaleLowerCase()} tutor context.</p>
      {savedDrills.length > 0 && <label className="literacy-drill-library-search"><Search size={15} /><span className="sr-only">Search saved drills</span><input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Search title, topic, or question type" /></label>}
      {savedDrills.length > 0 && filteredSavedDrills.length > 0 ? <div className="literacy-drill-library-list">{filteredSavedDrills.map((content) => {
        const typeLabels = [...new Set(content.set.questions.map((question) =>
          questionTypeDrills.find((drill) => drill.types.includes(question.type))?.label ?? question.type.replaceAll('-', ' '),
        ))]
        return <article className="literacy-drill-library-item" key={content.id}>
          <div><span className="section-kicker">{typeLabels.join(' · ')}</span><h3>{content.title}</h3><p>{content.topicFingerprint}</p><small>{content.set.questions.length} question groups · Saved {new Date(content.updatedAt).toLocaleDateString()}</small>{product === 'listenia' && !content.audioAssetId && <small className="literacy-drill-audio-fallback">Generated script saved · uses browser speech playback</small>}</div>
          <Button type="button" onClick={() => onPractice(content)}>Practice with live tutor <ArrowRight size={14} /></Button>
        </article>
      })}</div> : savedDrills.length > 0
        ? <p className="literacy-drill-library-empty">No saved drills match that search.</p>
        : <p className="literacy-drill-library-empty">No generated drills are saved yet. Generate a question-type drill above to build your local library.</p>}
    </Card>}
  </section>
}

export function LiteracyAssignmentsPage({ username, product, sets, attempts, onPractice }: {
  username: string
  product: SkillProduct
  sets: PracticeSet[]
  attempts: SkillAttempt[]
  onPractice: (setId: string) => void
}) {
  const skill = product === 'readia' ? 'Reading' : 'Listening'
  const weakType = useMemo(() => {
    const scores = new Map<string, { score: number; total: number }>()
    attempts.forEach((attempt) => Object.entries(attempt.questionTypeScores ?? {}).forEach(([type, value]) => {
      const previous = scores.get(type) ?? { score: 0, total: 0 }
      scores.set(type, { score: previous.score + value.score, total: previous.total + value.total })
    }))
    return [...scores.entries()].filter(([, value]) => value.total > 0).sort((a, b) => a[1].score / a[1].total - b[1].score / b[1].total)[0]?.[0]
  }, [attempts])
  const [assignmentState, setAssignmentState] = useState(() => {
    try {
      return { assignments: loadAssignments(username, product), error: '' }
    } catch (error) {
      return { assignments: [] as LiteracyAssignment[], error: error instanceof Error ? error.message : 'Saved assignments could not be loaded.' }
    }
  })
  const { assignments, error } = assignmentState

  function setAssignments(updated: LiteracyAssignment[]) {
    setAssignmentState((current) => ({ ...current, assignments: updated }))
  }

  function setError(message: string) {
    setAssignmentState((current) => ({ ...current, error: message }))
  }

  function createAssignment() {
    const set = sets.find((candidate) => weakType && candidate.questions.some((question) => question.type === weakType)) ?? sets.find((candidate) => !candidate.fullLength) ?? sets[0]
    if (!set) {
      setError('There are no published exercises to assign yet. Create or publish content in Content Studio first.')
      return
    }
    const next: LiteracyAssignment = {
      id: crypto.randomUUID(),
      setId: set.id,
      title: `${skill} practice: ${set.title}`,
      focus: weakType ? `Focus on ${weakType.replaceAll('-', ' ')} using evidence from the source.` : 'Complete this short exercise and review each explanation.',
      status: 'assigned',
      createdAt: new Date().toISOString(),
    }
    try {
      const updated = [next, ...assignments]
      persistAssignments(username, product, updated)
      setAssignments(updated)
      setError('')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'The assignment could not be saved.')
    }
  }

  function complete(assignment: LiteracyAssignment) {
    try {
      const updated = assignments.map((item) => item.id === assignment.id ? { ...item, status: 'completed' as const } : item)
      persistAssignments(username, product, updated)
      setAssignments(updated)
      setError('')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'The assignment could not be saved.')
    }
  }

  return <section className={`page-content inner-page literacy-page literacy-${product}`}>
    <header className="literacy-heading"><div><p className="eyebrow">PREPIA IELTS · PERSONAL PRACTICE PLAN</p><h1>{skill} assignments</h1><p className="page-subtitle">Locally saved practice tasks, recommended from the areas shown in your recent results.</p></div><span className="literacy-heading-icon"><ClipboardCheck size={24} /></span></header>
    <Card className="literacy-progress"><div className="literacy-section-heading"><div><span className="section-kicker">YOUR TASKS</span><h2>Practice assignments</h2></div><Button type="button" onClick={createAssignment}>Create recommended assignment</Button></div>
      {weakType && <p className="literacy-analytics-provenance">Current recommendation focus: {weakType.replaceAll('-', ' ')} based on your recorded question-type accuracy. Recommendations are practice guidance, not an IELTS band assessment.</p>}
      {error && <p className="literacy-error" role="alert">{error}</p>}
      {assignments.length ? <ul className="literacy-assignment-list">{assignments.map((assignment) => <li key={assignment.id}><div><strong>{assignment.title}</strong><p>{assignment.focus}</p><small>{new Date(assignment.createdAt).toLocaleDateString()} · {assignment.status}</small></div><div className="literacy-assignment-actions">{assignment.status === 'assigned' && <><Button type="button" variant="outline" onClick={() => onPractice(assignment.setId)}>Start</Button><Button type="button" onClick={() => complete(assignment)}>Mark complete</Button></>}</div></li>)}</ul> : <p>No assignments yet. Create a recommended task to begin.</p>}
    </Card>
  </section>
}

export function LiteracyPlacementPage({ product, sets, baseline, onStart }: {
  product: SkillProduct
  sets: PracticeSet[]
  baseline?: UserProfile['readingPlacementBaseline']
  onStart: (setId: string) => void
}) {
  const skill = product === 'readia' ? 'Reading' : 'Listening'
  const diagnosticSet = sets.find((set) => !set.fullLength && set.questions.length >= 5) ?? sets.find((set) => !set.fullLength) ?? sets[0]
  return <section className={`page-content inner-page literacy-page literacy-${product}`}>
    <header className="literacy-heading"><div><p className="eyebrow">PREPIA IELTS · STARTING POINT</p><h1>{skill} placement assessment</h1><p className="page-subtitle">A short, objective comprehension diagnostic using locally available practice content.</p></div><span className="literacy-heading-icon"><Target size={24} /></span></header>
    <Card className="literacy-progress"><div className="literacy-section-heading"><div><span className="section-kicker">LOCAL DIAGNOSTIC</span><h2>Establish a practice baseline</h2></div></div>
      <p>This timed-style set records marks, question types, and completion time in this browser. It is an initial learning signal only; it is not an official IELTS test or band estimate.</p>
      {baseline && <p className="literacy-analytics-provenance">Previous baseline: {baseline.score}/{baseline.total} ({Math.round(baseline.score / Math.max(1, baseline.total) * 100)}%), completed {new Date(baseline.completedAt).toLocaleDateString()}.</p>}
      {diagnosticSet ? <><p><strong>{diagnosticSet.title}</strong> · {diagnosticSet.questions.length} question groups · {diagnosticSet.minutes} minutes</p><Button type="button" onClick={() => onStart(diagnosticSet.id)}>Start {skill} diagnostic<ArrowRight size={14} /></Button></> : <p>No local exercises are available yet. Publish content in Content Studio before starting a diagnostic.</p>}
    </Card>
  </section>
}
