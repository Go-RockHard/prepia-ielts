import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Archive, BookOpen, Check, Clock3, Download, Headphones, LoaderCircle, Pencil, Sparkles, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { SkillQuestion } from '@/features/skills/questionTypes'
import { CONTENT_GENERATION_MODELS, CONTENT_REVIEW_MODELS, LISTENING_TTS_MODELS, generateAndSavePracticePackage, publishLocalContentPackage, reviewLocalContentPackage, validateEditedPracticeSet, validateImportedContentBundle, type ContentGenerationModel, type ContentReviewModel, type ImportedContentBundle, type ListeningTtsModel, type PracticeGenerationRequest } from '@/features/skills/literacyAi'
import { archiveLocalContentPackage, createLocalContentVersion, deleteLocalAudioAsset, getLocalStorageEstimate, loadLocalAudioAsset, loadLocalContentPackages, loadLocalContentWorkflowJobs, reserveLocalTopic, saveLocalAudioAsset, saveLocalContentPackage, savePublishedContentPackage, updateLocalTopicExposure, type LocalContentPackage, type LocalContentWorkflowJob, type SkillProduct } from '@/features/skills/literacyStorage'
import { getTopicPresets } from '@/features/skills/literacyTopics'

const QUESTION_TYPE_CHOICES = [
  ['multiple-choice', 'Multiple choice'],
  ['multiple-select', 'Multiple select'],
  ['classification', 'True / False / Not Given'],
  ['matching-headings', 'Matching headings'],
  ['matching-information', 'Matching information'],
  ['matching-features', 'Matching features'],
  ['matching-sentence-endings', 'Matching sentence endings'],
  ['matching', 'Matching items'],
  ['completion', 'Form / table completion'],
  ['note-completion', 'Note completion'],
  ['sentence-completion', 'Sentence completion'],
  ['short-answer', 'Short-answer questions'],
  ['labeling', 'Plan / map / diagram labelling'],
  ['flow-chart', 'Flow-chart completion'],
] as const satisfies ReadonlyArray<readonly [SkillQuestion['type'], string]>

const MODEL_STORAGE_PREFIX = 'prepia.receptive-content-studio'

function readModelPreference<T extends string>(key: string, models: ReadonlyArray<{ id: T }>, fallback: T): T {
  try {
    const saved = localStorage.getItem(key)
    return models.find((model) => model.id === saved)?.id ?? fallback
  } catch (error) {
    console.error('Unable to load a local Content Studio model preference.', error)
    return fallback
  }
}

export function LiteracyContentStudio({ product, username, apiKey, testType, onBack, onOpenPractice }: {
  product: SkillProduct
  username: string
  apiKey: string
  testType: 'Academic' | 'General Training'
  onBack: () => void
  onOpenPractice: (content: LocalContentPackage) => void
}) {
  const isReading = product === 'readia'
  const [packages, setPackages] = useState<LocalContentPackage[]>([])
  const [workflowJobs, setWorkflowJobs] = useState<LocalContentWorkflowJob[]>([])
  const [topic, setTopic] = useState('')
  const [topicAngle, setTopicAngle] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [generationTestType, setGenerationTestType] = useState(testType)
  const [level, setLevel] = useState<PracticeGenerationRequest['level']>('Intermediate')
  const [questionCount, setQuestionCount] = useState(4)
  const [minutes, setMinutes] = useState(isReading ? 12 : 10)
  const [contentMode, setContentMode] = useState<'practice' | 'full-mock'>('practice')
  const [questionType, setQuestionType] = useState<SkillQuestion['type'] | 'mixed'>('mixed')
  const [generationModel, setGenerationModel] = useState<ContentGenerationModel>(() => readModelPreference(`${MODEL_STORAGE_PREFIX}.${product}.generation`, CONTENT_GENERATION_MODELS, 'gemini-4-hydrogen'))
  const [reviewModel, setReviewModel] = useState<ContentReviewModel>(() => readModelPreference(`${MODEL_STORAGE_PREFIX}.${product}.review`, CONTENT_REVIEW_MODELS, 'gemini-4-hydrogen'))
  const [ttsModel, setTtsModel] = useState<ListeningTtsModel>(() => readModelPreference(`${MODEL_STORAGE_PREFIX}.listenia.tts`, LISTENING_TTS_MODELS, 'gemini-3.8-flash-tts'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorDraft, setEditorDraft] = useState('')
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null)
  const topicPresets = getTopicPresets(product, generationTestType)

  function saveModelPreference(key: string, value: string, save: () => void) {
    try {
      localStorage.setItem(key, value)
      save()
      setError('')
    } catch (caughtError) {
      console.error('Unable to save a local Content Studio model preference.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'The selected model could not be saved in this browser.')
    }
  }

  function handlePresetChange(id: string) {
    setSelectedPresetId(id)
    const preset = topicPresets.find((candidate) => candidate.id === id)
    if (preset) {
      setTopic(preset.topic)
      setTopicAngle(preset.angle)
    }
  }

  useEffect(() => {
    let active = true
    void Promise.all([loadLocalContentPackages(product, true), loadLocalContentWorkflowJobs(username, product)]).then(([saved, jobs]) => {
      if (!active) return
      setPackages(saved)
      setWorkflowJobs(jobs)
    }).catch((caughtError: unknown) => {
      console.error(`Unable to load ${product} content or workflow history from local storage.`, caughtError)
      if (active) setError(caughtError instanceof Error ? caughtError.message : 'Local content could not be loaded.')
    })
    return () => { active = false }
  }, [product, username])

  useEffect(() => {
    let active = true
    void getLocalStorageEstimate().then((estimate) => {
      if (active) setStorageEstimate(estimate)
    }).catch((caughtError: unknown) => {
      console.error('Unable to estimate local receptive-skill storage use.', caughtError)
    })
    return () => { active = false }
  }, [])

  async function generateContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const generated = await generateAndSavePracticePackage(apiKey, {
        product,
        username,
        topic,
        topicAngle,
        level,
        questionCount,
        minutes,
        testType: generationTestType,
        contentMode,
        ...(contentMode === 'practice' && questionType !== 'mixed' ? { questionTypes: [questionType] } : {}),
        generationModel,
        reviewModel,
        ...(product === 'listenia' ? { ttsModel } : {}),
      })
      setPackages((current) => [generated.content, ...current.filter((item) => item.id !== generated.content.id)])
      setMessage(`Draft saved locally${generated.warnings.length ? `. ${generated.warnings.join(' ')}` : '. Review the answers and evidence before publishing.'}`)
      setTopic('')
      setTopicAngle('')
      setSelectedPresetId('')
    } catch (caughtError) {
      console.error(`Unable to generate a ${product} content package.`, caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Content generation failed. No package was published.')
    } finally {
      setBusy(false)
      try {
        setWorkflowJobs(await loadLocalContentWorkflowJobs(username, product))
      } catch (caughtError) {
        console.error(`Unable to refresh ${product} content workflow history.`, caughtError)
      }
    }
  }

  async function review(content: LocalContentPackage) {
    setError('')
    try {
      const reviewed = await reviewLocalContentPackage(apiKey, content, reviewModel)
      await saveLocalContentPackage(reviewed)
      setPackages((current) => current.map((item) => item.id === reviewed.id ? reviewed : item))
      setMessage(`“${reviewed.title}” passed independent review${reviewed.qualityReview?.findings.length ? ` with ${reviewed.qualityReview.findings.length} note(s)` : ''}. You can now publish it.`)
    } catch (caughtError) {
      console.error('Unable to complete independent review of local content.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Independent content review failed.')
    }
  }

  async function publish(content: LocalContentPackage) {
    setError('')
    try {
      const published = await publishLocalContentPackage(content)
      await savePublishedContentPackage(published)
      setPackages((current) => current.map((item) => item.id === published.id ? published : item))
      setMessage(`“${published.title}” is now published to this browser’s ${isReading ? 'reading' : 'listening'} library.`)
    } catch (caughtError) {
      console.error('Unable to publish local content package.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'The content package could not be published.')
    }
  }

  async function archive(content: LocalContentPackage) {
    setError('')
    try {
      const archived = { ...content, status: 'archived' as const, updatedAt: new Date().toISOString() }
      await archiveLocalContentPackage(content)
      setPackages((current) => current.map((item) => item.id === archived.id ? archived : item))
      setMessage(`“${archived.title}” was archived locally.`)
    } catch (caughtError) {
      console.error('Unable to archive local content package.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'The content package could not be archived.')
    }
  }

  async function saveDraftEdit(content: LocalContentPackage) {
    setError('')
    try {
      if (editorDraft.length > 500_000) throw new Error('Draft edits must be smaller than 500 KB.')
      const parsedDraft: unknown = JSON.parse(editorDraft)
      const validatedSet = validateEditedPracticeSet(parsedDraft, content, testType)
      const edited: LocalContentPackage = { ...content, title: validatedSet.title, set: validatedSet, qualityReview: undefined, updatedAt: new Date().toISOString() }
      const updated = await reviewLocalContentPackage(apiKey, edited, reviewModel)
      await saveLocalContentPackage(updated)
      setPackages((current) => current.map((item) => item.id === updated.id ? updated : item))
      setEditingId(null)
      setEditorDraft('')
      setMessage(`“${updated.title}” was validated, independently reviewed, and saved as a draft${updated.qualityReview?.findings.length ? ` with ${updated.qualityReview.findings.length} reviewer note(s)` : ''}.`)
    } catch (caughtError) {
      console.error('Unable to validate or save the local draft edit.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'The draft could not be validated or saved.')
    }
  }

  async function createVersion(content: LocalContentPackage) {
    setError('')
    try {
      const version = await createLocalContentVersion(content)
      setPackages((current) => [version, ...current])
      setMessage(`Version ${version.version} was created as a separate draft. The published version remains unchanged.`)
    } catch (caughtError) {
      console.error('Unable to create a new local content version.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'A new content version could not be created.')
    }
  }

  async function exportPackage(content: LocalContentPackage) {
    setError('')
    try {
      const bundle: ImportedContentBundle = {
        format: 'prepia-receptive-content',
        schemaVersion: 1,
        content: {
          product: content.product,
          title: content.title,
          topicId: content.topicId,
          topicFingerprint: content.topicFingerprint,
          version: content.version,
          source: content.source,
          createdAt: content.createdAt,
          updatedAt: content.updatedAt,
          set: content.set,
        },
      }
      if (content.audioAssetId) {
        const asset = await loadLocalAudioAsset(content.audioAssetId)
        if (!asset) throw new Error('The saved audio for this package is missing; the package cannot be exported.')
        if (asset.byteLength > 10 * 1024 * 1024) throw new Error('The recording is larger than the 10 MB portable-package limit.')
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The local audio could not be encoded for export.'))
          reader.onerror = () => reject(reader.error ?? new Error('The local audio could not be read for export.'))
          reader.readAsDataURL(asset.audio)
        })
        bundle.audio = { mimeType: asset.mimeType, data: dataUrl.split(',', 2)[1] }
      }
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${content.product}-${content.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'practice-package'}-v${content.version}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setMessage(`“${content.title}” was exported. Imported packages return as drafts and must pass local review before publishing.`)
    } catch (caughtError) {
      console.error('Unable to export the local content package.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'The package could not be exported.')
    }
  }

  async function importPackage(file: File) {
    setError('')
    setMessage('')
    let reservationId: string | undefined
    let audioId: string | undefined
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error('Import files must be 15 MB or smaller.')
      const raw: unknown = JSON.parse(await file.text())
      const validated = validateImportedContentBundle(raw, product, testType)
      const reservation = await reserveLocalTopic({
        username,
        product,
        topicId: crypto.randomUUID(),
        fingerprint: validated.content.topicFingerprint,
      })
      reservationId = reservation.id
      const id = `${product}:${crypto.randomUUID()}:v${validated.content.version}`
      const createdAt = new Date().toISOString()
      let set = { ...validated.content.set }
      let importedAudioId: string | undefined
      if (validated.audio) {
        importedAudioId = `${id}:audio:0`
        set = { ...set, audioAssetId: importedAudioId }
        audioId = importedAudioId
        await saveLocalAudioAsset({
          id: importedAudioId,
          contentId: id,
          contentVersion: validated.content.version,
          sectionIndex: 0,
          mimeType: validated.audio.type,
          byteLength: validated.audio.size,
          createdAt,
          audio: validated.audio,
        })
      }
      const content: LocalContentPackage = {
        ...validated.content,
        id,
        exposureId: reservation.id,
        createdAt,
        updatedAt: createdAt,
        set,
        ...(importedAudioId ? { audioAssetId: importedAudioId } : {}),
      }
      await saveLocalContentPackage(content)
      setPackages((current) => [content, ...current])
      setMessage(`“${content.title}” imported as a draft. It has no inherited review approval; run independent review before publishing.`)
    } catch (caughtError) {
      if (audioId) {
        try {
          await deleteLocalAudioAsset(audioId)
        } catch (cleanupError) {
          console.error('Unable to clean up an incomplete imported audio asset.', cleanupError)
        }
      }
      if (reservationId) {
        try {
          await updateLocalTopicExposure(reservationId, 'released')
        } catch (cleanupError) {
          console.error('Unable to release a failed imported topic reservation.', cleanupError)
        }
      }
      console.error('Unable to import the local content package.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'The package could not be imported.')
    }
  }

  return <div className={`page-content inner-page literacy-page literacy-${product} literacy-content-studio`}>
    <header className="literacy-heading">
      <div>
        <p className="eyebrow">PREPIA IELTS · LOCAL CONTENT MANAGEMENT</p>
        <h1>{isReading ? 'Readia' : 'Listenia'} Content Studio</h1>
        <p className="page-subtitle">Create original practice packages, review the content, then publish an immutable copy to this browser’s library.</p>
      </div>
      <Button type="button" variant="outline" onClick={onBack}><ArrowLeft size={14} /> Back to {isReading ? 'Readia' : 'Listenia'}</Button>
    </header>

    <Card className="literacy-content-studio-card">
      <div className="literacy-section-heading"><div><span className="section-kicker">AI CONTENT PIPELINE</span><h2>{isReading ? 'Build a passage and question set' : 'Build a listening script, questions, and recording'}</h2></div><span className="literacy-studio-local-badge">Stored in this browser</span></div>
      <p className="literacy-studio-description">Choose a preset topic, test type, and question format. Prepia creates an original practice set or a 40-question full mock; a bounded repair loop fixes malformed or invalid output before content is rejected. Deterministic evidence checks and independent review run before a draft is saved. Topic repetition is checked across your local Reading and Listening history.</p>
      {storageEstimate?.usage !== undefined && <p className="literacy-storage-indicator">Browser storage in use: {(storageEstimate.usage / 1024 / 1024).toFixed(1)} MB{storageEstimate.quota === undefined ? '' : ` of ${(storageEstimate.quota / 1024 / 1024).toFixed(0)} MB`}</p>}
      {!apiKey.trim() && <p className="literacy-error" role="status">Add your Prepia AI access key in shared Settings to generate content. Your key remains in this browser.</p>}
      <label className="literacy-import-control"><Upload size={15} /> Import a package JSON<input type="file" accept="application/json,.json" onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) void importPackage(file)
        event.target.value = ''
      }} /><small>Up to 15 MB. Imported packages are validated and saved as drafts; approvals are not transferred.</small></label>
      <form className="literacy-content-form" onSubmit={(event) => void generateContent(event)}>
        <label>Content mode<select value={contentMode} onChange={(event) => {
          const nextMode = event.target.value as 'practice' | 'full-mock'
          setContentMode(nextMode)
          setQuestionCount(nextMode === 'full-mock' ? 40 : 4)
          setMinutes(nextMode === 'full-mock' ? (isReading ? 60 : 30) : (isReading ? 12 : 10))
          setQuestionType('mixed')
        }}><option value="practice">Question-type practice</option><option value="full-mock">Full-length mock · 40 questions</option></select></label>
        <label>Test type<select value={generationTestType} onChange={(event) => {
          setGenerationTestType(event.target.value as typeof generationTestType)
          setSelectedPresetId('')
          setTopic('')
          setTopicAngle('')
        }}><option>Academic</option><option>General Training</option></select></label>
        <label>Preset topic<select value={selectedPresetId} onChange={(event) => handlePresetChange(event.target.value)}><option value="">Choose a preset or enter your own</option>{topicPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.topic}</option>)}</select></label>
        <label>Topic<input value={topic} onChange={(event) => { setSelectedPresetId(''); setTopic(event.target.value) }} placeholder="Choose a preset or enter a new topic" required maxLength={100} /></label>
        <label>Topic angle<input value={topicAngle} onChange={(event) => setTopicAngle(event.target.value)} placeholder="A specific focus within the topic" required maxLength={160} /></label>
        {contentMode === 'practice' && <label>Question type<select value={questionType} onChange={(event) => {
          const selected = QUESTION_TYPE_CHOICES.find(([value]) => value === event.target.value)?.[0]
          setQuestionType(selected ?? 'mixed')
        }}><option value="mixed">Mixed question types</option>{QUESTION_TYPE_CHOICES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        <label>Difficulty<select value={level} onChange={(event) => setLevel(event.target.value as PracticeGenerationRequest['level'])}><option value="Foundation">Foundation</option><option value="Intermediate">Intermediate</option></select></label>
        {contentMode === 'practice' ? <>
          <label>Questions<input type="number" value={questionCount} min={1} max={10} onChange={(event) => setQuestionCount(Number(event.target.value))} /></label>
          <label>Practice time (minutes)<input type="number" value={minutes} min={5} max={20} onChange={(event) => setMinutes(Number(event.target.value))} /></label>
        </> : <p className="literacy-full-mock-spec">{isReading ? '3 passages · 40 questions · 60 minutes' : '4 listening sections · 40 questions · 30 minutes'}</p>}
        <label>Content generation model<select value={generationModel} onChange={(event) => saveModelPreference(`${MODEL_STORAGE_PREFIX}.${product}.generation`, event.target.value, () => setGenerationModel(event.target.value as ContentGenerationModel))}>{CONTENT_GENERATION_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label>
        <label>Independent review model<select value={reviewModel} onChange={(event) => saveModelPreference(`${MODEL_STORAGE_PREFIX}.${product}.review`, event.target.value, () => setReviewModel(event.target.value as ContentReviewModel))}>{CONTENT_REVIEW_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label>
        {product === 'listenia' && <label>Listening TTS model<select value={ttsModel} onChange={(event) => saveModelPreference(`${MODEL_STORAGE_PREFIX}.listenia.tts`, event.target.value, () => setTtsModel(event.target.value as ListeningTtsModel))}>{LISTENING_TTS_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label>}
        <Button type="submit" disabled={busy || !apiKey.trim() || !topic.trim() || !topicAngle.trim()}>{busy ? <><LoaderCircle size={15} className="spin" /> Creating, repairing and validating…</> : <><Sparkles size={15} /> {contentMode === 'full-mock' ? 'Generate 40-question mock' : 'Generate local practice draft'} <ArrowRight size={14} /></>}</Button>
      </form>
      {error && <p className="literacy-error" role="alert">{error}</p>}
      {message && <p className="literacy-studio-status" role="status"><Check size={14} /> {message}</p>}
      {workflowJobs.length > 0 && <section className="literacy-workflow-history" aria-label="Recent content workflow history">
        <div className="literacy-workflow-history-heading"><strong>Recent generation jobs</strong><span>Saved locally</span></div>
        {workflowJobs.slice(0, 4).map((job) => <article className="literacy-workflow-job" key={job.id}>
          <span className={`literacy-workflow-job-indicator literacy-workflow-job-${job.status}`} aria-hidden="true" />
          <div><strong>{job.topic}</strong><small>{job.topicAngle}</small></div>
          <span className="literacy-workflow-job-stage">{job.status === 'completed' ? 'Complete' : job.status === 'failed' ? 'Failed' : job.stage.replaceAll('-', ' ')}</span>
          <time dateTime={job.updatedAt}>{new Intl.DateTimeFormat('en', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(job.updatedAt))}</time>
          {job.error && <p role="status">{job.error}</p>}
          {job.stageHistory?.length > 0 && <details className="literacy-workflow-job-details"><summary>Stage history</summary><ol>{job.stageHistory.map((entry, index) => <li key={`${job.id}-${entry.at}-${index}`}><strong>{entry.stage?.replaceAll('-', ' ') || 'Workflow step'}</strong><span>{entry.detail ?? entry.status ?? 'Recorded'}</span><time dateTime={entry.at}>{new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(new Date(entry.at))}</time></li>)}</ol></details>}
          {job.status === 'failed' && <button type="button" className="literacy-workflow-retry" onClick={() => { setTopic(job.topic); setTopicAngle(job.topicAngle); setError(''); setMessage('Review the request, then generate again to retry this saved job.') }}>Retry setup</button>}
        </article>)}
      </section>}
    </Card>

    <div className="literacy-section-heading literacy-studio-library-heading"><div><span className="section-kicker">LOCAL LIBRARY</span><h2>Authored packages</h2></div><span>{packages.length} {packages.length === 1 ? 'package' : 'packages'}</span></div>
    {packages.length ? <div className="literacy-set-grid">{packages.map((content) => <Card className={`literacy-set-card literacy-authored-card ${content.status === 'archived' ? 'literacy-authored-archived' : ''}`} key={content.id}>
      <div className="literacy-set-meta"><span>{content.status.toUpperCase()} · VERSION {content.version}</span><span>{content.source === 'generated' ? 'Prepia draft' : 'Imported'}</span></div>
      <h2>{content.title}</h2><p>{content.set.instructions}</p>
      {content.qualityReview && <div className="literacy-quality-review"><Check size={13} /><span>Independent review passed · {content.qualityReview.model}</span>{content.qualityReview.findings.map((finding, index) => <small key={`${content.id}-review-${index}`}>{finding}</small>)}</div>}
      <div className="literacy-authored-meta"><span>{content.set.questions.length} question groups</span><span><Clock3 size={13} /> {content.set.minutes} min</span>{!isReading && <span><Headphones size={13} /> {content.audioAssetId ? 'Audio saved locally' : 'Script only'}</span>}</div>
      <div className="literacy-set-footer">
        <span>{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(content.updatedAt))}</span>
      <div><Button type="button" variant="outline" onClick={() => void exportPackage(content)}><Download size={14} /> Export</Button><Button type="button" variant="outline" onClick={() => onOpenPractice(content)}><BookOpen size={14} /> Preview</Button>
          {content.status === 'draft' && <Button type="button" variant="outline" onClick={() => { setEditingId(content.id); setEditorDraft(JSON.stringify(content.set, null, 2)); setError('') }}><Pencil size={14} /> Edit draft</Button>}
          {content.status === 'draft' && !content.qualityReview?.approved && <Button type="button" variant="outline" disabled={!apiKey.trim()} onClick={() => void review(content)}><Check size={14} /> Review</Button>}
          {content.status === 'draft' && <Button type="button" disabled={!content.qualityReview?.approved} onClick={() => void publish(content)}><Check size={14} /> Publish</Button>}
          {content.status === 'published' && <Button type="button" variant="outline" onClick={() => void createVersion(content)}><Pencil size={14} /> New version</Button>}
          {content.status !== 'archived' && <Button type="button" variant="ghost" aria-label={`Archive ${content.title}`} onClick={() => void archive(content)}><Archive size={14} /></Button>}
        </div>
      </div>
      {editingId === content.id && <div className="literacy-draft-editor"><label htmlFor={`draft-editor-${content.id}`}>Edit structured practice set JSON. Every question must retain a source-supported evidence string.</label><textarea id={`draft-editor-${content.id}`} value={editorDraft} onChange={(event) => setEditorDraft(event.target.value)} spellCheck={false} /><div><Button type="button" variant="outline" onClick={() => { setEditingId(null); setEditorDraft('') }}>Cancel</Button><Button type="button" onClick={() => void saveDraftEdit(content)}><Check size={14} /> Validate and save draft</Button></div></div>}
    </Card>)}</div> : <Card className="literacy-progress-empty"><Sparkles size={21} /><strong>No authored content yet</strong><p>Generate your first topic-specific draft. Existing starter sets remain available in the module library.</p></Card>}
  </div>
}
