import { useEffect, useMemo, useState } from 'react'
import { AudioLines, Check, Clock3, FileAudio, LoaderCircle, MessageCircle, Sparkles, Target, Video } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SentenceFeedbackList } from '@/features/simulator/SentenceFeedbackList'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { assessMedia, normalizeYouTubeUrl, type MediaAssessment, type MediaAssessmentModel, type MediaAssessmentSource } from './assessment'
import { loadMediaAssessments, loadMediaSource, saveMediaAssessments, saveMediaSource } from './storage'
import { shareAudioWithCoach, shareYoutubeWithCoach } from '@/features/assistant/audioSharing'

type ArchiveFilter = 'all' | MediaAssessmentSource
type DisplayCriterion = MediaAssessment['criteria'][number]

const modelOptions: { value: MediaAssessmentModel; label: string }[] = [
  { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
]

const criterionColors: Record<DisplayCriterion['id'], string> = {
  fluency: '#7665cf',
  lexical: '#e58c72',
  grammar: '#75a992',
  pronunciation: '#d1a653',
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}

export function MediaAssessmentPage({ apiKey, onOpenSettings }: { apiKey: string; onOpenSettings: () => void }) {
  const [source, setSource] = useState<MediaAssessmentSource>('audio')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [model, setModel] = useState<MediaAssessmentModel>('gemini-3.8-flash')
  const [assessments, setAssessments] = useState<MediaAssessment[]>(loadMediaAssessments)
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null)
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const filteredAssessments = useMemo(
    () => assessments.filter((item) => archiveFilter === 'all' || item.source === archiveFilter),
    [archiveFilter, assessments],
  )
  const selectedAssessment = filteredAssessments.find((item) => item.id === selectedAssessmentId) ?? filteredAssessments[0] ?? null

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (!apiKey.trim()) throw new Error('Enter your Gemini API key to assess media.')
      const normalizedYoutubeUrl = source === 'youtube' ? normalizeYouTubeUrl(youtubeUrl) : undefined
      if (source === 'audio' && !selectedFile) throw new Error('Choose an audio file to assess.')

      let assessment = await assessMedia({
        apiKey,
        model,
        source,
        ...(source === 'audio' ? { file: selectedFile ?? undefined } : { youtubeUrl: normalizedYoutubeUrl }),
      })
      let replayWarning = ''
      if (source === 'audio' && selectedFile) {
        try {
          await saveMediaSource(assessment.id, selectedFile)
          assessment = { ...assessment, audioAvailable: true }
        } catch (storageError) {
          console.error('Unable to save the assessed source audio for replay.', storageError)
          replayWarning = ' The assessment is complete, but its source audio could not be saved for replay in this browser.'
        }
      }
      const nextAssessments = [assessment, ...assessments]
      setAssessments(nextAssessments)
      setSelectedAssessmentId(assessment.id)
      try {
        saveMediaAssessments(nextAssessments)
        setNotice(`Assessment complete and saved to your archive.${replayWarning}`)
      } catch (storageError) {
        setError(storageError instanceof Error ? storageError.message : 'The assessment completed but could not be saved to this browser.')
      }
    } catch (caughtError) {
      console.error('Unable to complete the external-media IELTS assessment.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to assess this media. Check your connection, API key, and model access.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-content inner-page media-assessment-page">
      <div className="inner-page-heading">
        <div>
          <p className="eyebrow">ASSESS YOUR OWN SPEAKING MEDIA</p>
          <h1>Media assessments</h1>
          <p className="page-subtitle">Assess an IELTS speaking recording or YouTube practice video, then review the source alongside detailed feedback.</p>
        </div>
      </div>

      <Card className="media-assessment-intro">
        <span className="media-intro-icon"><Sparkles size={20} /></span>
        <div><strong>Assessment, playback, and feedback in one place</strong><p>Review your original audio or video alongside a practice band, criterion-level feedback, transcript, strengths, and next steps.</p></div>
      </Card>
      {!apiKey.trim() && <Card className="simulator-key-notice"><Target size={17} /><p>Add your Gemini API key in Settings to assess media.</p><Button variant="outline" size="sm" onClick={onOpenSettings}>Open Settings</Button></Card>}

      <Card className="media-assessment-form-card">
        <form onSubmit={(event) => void submit(event)}>
          <details className="media-source-accordion">
            <summary><span>{source === 'audio' ? <FileAudio size={17} /> : <Video size={17} />}{source === 'audio' ? selectedFile?.name ?? 'Choose an audio recording' : youtubeUrl ? 'YouTube video selected' : 'Add a YouTube video'}</span><small>{modelOptions.find((option) => option.value === model)?.label} · Change source or settings</small></summary>
            <div className="media-source-accordion-content">
              <div className="media-source-tabs" role="group" aria-label="Media type">
                <button type="button" className={source === 'audio' ? 'media-source-active' : ''} aria-pressed={source === 'audio'} onClick={() => { setSource('audio'); setError('') }}><FileAudio size={17} /> Audio recording</button>
                <button type="button" className={source === 'youtube' ? 'media-source-active' : ''} aria-pressed={source === 'youtube'} onClick={() => { setSource('youtube'); setError('') }}><Video size={17} /> YouTube video</button>
              </div>
              {source === 'audio'
                ? <label className="media-input-label">Audio file <span>MP3, WAV, M4A, OGG, FLAC, AIFF, AAC, or WebM</span>
                  <input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aiff,.aac,.webm" onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setError('') }} />
                  {selectedFile && <small className="media-file-selected"><FileAudio size={15} />{selectedFile.name} · {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</small>}
                </label>
                : <label className="media-input-label">YouTube URL <span>Public YouTube video link</span>
                  <input type="url" value={youtubeUrl} onChange={(event) => { setYoutubeUrl(event.target.value); setError('') }} placeholder="https://www.youtube.com/watch?v=…" />
                </label>}
              <label className="media-input-label media-model-label">Gemini model
                <select value={model} onChange={(event) => setModel(event.target.value as MediaAssessmentModel)}>{modelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              </label>
            </div>
          </details>

          <div className="media-privacy-note"><Target size={15} /><p>Media is sent from this browser to Google Gemini for assessment; uploaded audio is deleted from Gemini after processing when possible. For replay, selected audio is stored in this browser’s IndexedDB with the assessment. YouTube videos are replayed from their public URL. Google’s processing and retention policies apply. YouTube assessment availability, pricing, and rate limits may change.</p></div>
          {error && <p className="media-assessment-error" role="alert">{error}</p>}
          {notice && <p className="media-assessment-success" role="status">{notice}</p>}
          <div className="media-assessment-submit"><Button className="start-button" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin-icon" size={16} /> Uploading &amp; assessing…</> : <><Sparkles size={16} /> Assess with {modelOptions.find((item) => item.value === model)?.label}</>}</Button></div>
        </form>
      </Card>

      <div className="media-archive-layout">
        <section className="media-archive-section" aria-label="Assessment archive">
          <div className="media-archive-heading"><div><p className="section-kicker">YOUR SAVED RESULTS</p><h2>Assessment archive</h2></div><span>{filteredAssessments.length} {filteredAssessments.length === 1 ? 'assessment' : 'assessments'}</span></div>
          <div className="media-archive-filters" role="group" aria-label="Filter assessment archive">
            {([{ id: 'all', label: 'All' }, { id: 'audio', label: 'Audio' }, { id: 'youtube', label: 'Video' }] as const).map((filter) => <button key={filter.id} className={archiveFilter === filter.id ? 'media-archive-filter-active' : ''} aria-pressed={archiveFilter === filter.id} onClick={() => setArchiveFilter(filter.id)}>{filter.label}<span>{filter.id === 'all' ? assessments.length : assessments.filter((item) => item.source === filter.id).length}</span></button>)}
          </div>
          {filteredAssessments.length
            ? <div className="media-archive-list">{filteredAssessments.map((item) => <button key={item.id} className={`media-archive-item ${selectedAssessment?.id === item.id ? 'media-archive-item-active' : ''}`} aria-pressed={selectedAssessment?.id === item.id} onClick={() => setSelectedAssessmentId(item.id)}>
              <span className={`media-archive-icon media-archive-icon-${item.source}`}>{item.source === 'audio' ? <AudioLines size={17} /> : <Video size={17} />}</span>
              <span className="media-archive-item-copy"><strong>{item.sourceName}</strong><small>{item.source === 'audio' ? 'Audio' : 'YouTube video'} · {formatDate(item.completedAt)}</small><small>{item.model === 'gemini-3.8-flash' ? 'Gemini 3.8 Flash' : 'Gemini 3.1 Pro Preview'}</small></span>
              <span className="media-archive-band">{item.overallBand.toFixed(1)}<small>/9</small></span>
            </button>)}</div>
            : <Card className="media-archive-empty"><Clock3 size={20} /><strong>No {archiveFilter === 'all' ? '' : `${archiveFilter === 'youtube' ? 'video' : 'audio'} `}assessments yet</strong><p>Complete an assessment to save it here for review.</p></Card>}
        </section>

        <section className="media-assessment-detail" aria-label="Selected media assessment">
          {selectedAssessment
            ? <AssessmentDetails key={selectedAssessment.id} assessment={selectedAssessment} />
            : <Card className="media-detail-empty"><span className="evaluation-empty-icon"><Target size={22} /></span><h2>Assessment details</h2><p>Select an archived result or submit media to see its scores, evidence, transcript, and practice suggestions.</p></Card>}
        </section>
      </div>
    </div>
  )
}

function youtubeEmbedUrl(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl)
    const host = url.hostname.toLocaleLowerCase()
    const path = url.pathname.split('/').filter(Boolean)
    const videoId = host === 'youtu.be'
      ? path[0]
      : url.searchParams.get('v') ?? (['shorts', 'live', 'embed'].includes(path[0] ?? '') ? path[1] : undefined)
    return videoId && /^[\w-]{11}$/.test(videoId)
      ? `https://www.youtube-nocookie.com/embed/${videoId}`
      : null
  } catch {
    return null
  }
}

function AssessmentMediaPlayer({ assessment }: { assessment: MediaAssessment }) {
  const [audioUrl, setAudioUrl] = useState('')
  const [loading, setLoading] = useState(assessment.source === 'audio' && assessment.audioAvailable === true)
  const [error, setError] = useState('')
  const [sharing, setSharing] = useState(false)
  const embedUrl = assessment.source === 'youtube' && assessment.sourceUrl
    ? youtubeEmbedUrl(assessment.sourceUrl)
    : null

  useEffect(() => {
    if (assessment.source !== 'audio') return
    let current = true
    let objectUrl: string | null = null
    if (!assessment.audioAvailable) {
      return () => { current = false }
    }

    void loadMediaSource(assessment.id).then((source) => {
      if (!current) return
      if (!source) {
        setError('The saved source audio is unavailable in this browser.')
        return
      }
      objectUrl = URL.createObjectURL(source)
      setAudioUrl(objectUrl)
    }).catch((caughtError: unknown) => {
      console.error('Unable to load media assessment audio for replay.', caughtError)
      if (current) setError(caughtError instanceof Error ? caughtError.message : 'Unable to load the source audio for replay.')
    }).finally(() => {
      if (current) setLoading(false)
    })

    return () => {
      current = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [assessment.audioAvailable, assessment.id, assessment.source])

  async function discussWithCoach() {
    if (assessment.source === 'youtube' && assessment.sourceUrl) {
      shareYoutubeWithCoach(assessment.sourceUrl, assessment.sourceName)
      return
    }
    setSharing(true)
    setError('')
    try {
      const audio = await loadMediaSource(assessment.id)
      if (!audio) throw new Error('The original audio is not saved in this browser and cannot be shared.')
      shareAudioWithCoach(audio, assessment.sourceName)
    } catch (caughtError) {
      console.error('Unable to share the media-assessment source with Speakia Coach.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to share this media with Speakia Coach.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <Card className="media-source-player">
      <div className="media-source-player-heading">
        <div><span className="section-kicker">ASSESSMENT SOURCE</span><h3>Replay your {assessment.source === 'audio' ? 'recording' : 'video'}</h3></div>
        <div className="media-source-player-actions">
          <span>{assessment.source === 'audio' ? <FileAudio size={16} /> : <Video size={16} />}{assessment.sourceName}</span>
          <button type="button" className="media-discuss-coach" onClick={() => void discussWithCoach()} disabled={sharing || (assessment.source === 'audio' && !assessment.audioAvailable) || (assessment.source === 'youtube' && !assessment.sourceUrl)}><MessageCircle size={14} />{sharing ? 'Loading audio…' : 'Discuss with Coach'}</button>
        </div>
      </div>
      {assessment.source === 'youtube'
        ? embedUrl
          ? <div className="media-video-frame"><iframe src={embedUrl} title={`YouTube assessment source: ${assessment.sourceName}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
          : <p className="media-source-player-message" role="status">This YouTube link could not be embedded. <a href={assessment.sourceUrl} target="_blank" rel="noreferrer">Open the video on YouTube</a>.</p>
        : audioUrl
          ? <audio className="media-source-audio" controls preload="metadata" src={audioUrl} aria-label={`Replay source audio ${assessment.sourceName}`} />
          : <p className="media-source-player-message" role="status">{loading ? 'Loading your saved recording…' : 'The original audio is not saved for this archived assessment.'}</p>}
      {error && <p className="media-source-player-message" role="alert">{error}</p>}
    </Card>
  )
}

function AssessmentDetails({ assessment }: { assessment: MediaAssessment }) {
  const chartData = assessment.criteria.map((criterion) => ({
    id: criterion.id,
    name: criterion.id === 'fluency' ? 'Fluency'
      : criterion.id === 'lexical' ? 'Lexical'
        : criterion.id === 'grammar' ? 'Grammar'
          : 'Pronunciation',
    fullName: criterion.name,
    score: criterion.band,
  }))

  return <div className="media-assessment-results">
    <Card className="media-overall-card">
      <div><span className="section-kicker">OVERALL PRACTICE BAND</span><strong>{assessment.overallBand.toFixed(1)}<small> / 9</small></strong><Badge>Indicative only</Badge></div>
      <div className="media-overall-meta"><span>{assessment.source === 'audio' ? <FileAudio size={15} /> : <Video size={15} />}{assessment.source === 'audio' ? 'Audio assessment' : 'YouTube assessment'}</span><small>{formatDate(assessment.completedAt)}</small><small>{assessment.model === 'gemini-3.8-flash' ? 'Gemini 3.8 Flash' : 'Gemini 3.1 Pro Preview'}</small></div>
    </Card>

    <AssessmentMediaPlayer assessment={assessment} />

    <Card className="media-band-chart-card">
      <div className="media-band-chart-heading"><div><span className="section-kicker">RUBRIC BREAKDOWN</span><h3>Criterion band scores</h3></div><span>Band 0–9</span></div>
      <div className="media-band-chart" role="img" aria-label={`Criterion band scores: ${assessment.criteria.map((criterion) => `${criterion.name} ${criterion.band.toFixed(1)} out of 9`).join(', ')}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 18, right: 15, bottom: 6, left: 0 }}>
            <CartesianGrid stroke="#e8e6ed" vertical={false} />
            <XAxis dataKey="name" interval={0} tick={{ fill: '#686a7b', fontSize: 10 }} axisLine={false} tickLine={false} tickMargin={9} />
            <YAxis domain={[0, 9]} ticks={[0, 3, 6, 9]} tick={{ fill: '#77798a', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip formatter={(value) => [`${value} / 9`, 'Practice band']} labelFormatter={(_, payload) => payload[0]?.payload.fullName ?? ''} cursor={{ fill: '#7665cf', fillOpacity: 0.06 }} />
            <Bar dataKey="score" name="Practice band" radius={[6, 6, 0, 0]} maxBarSize={52} activeBar={{ stroke: '#5547a6', strokeWidth: 1.5 }} animationDuration={650} animationEasing="ease-out">
              {chartData.map((item) => <Cell key={item.id} fill={criterionColors[item.id]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>

    <div className="media-criteria-grid">{assessment.criteria.map((criterion) => <Card className="media-criterion-card" key={criterion.id}>
      <div className="media-criterion-heading"><span style={{ color: criterionColors[criterion.id] }}>{criterion.name}</span><strong>{criterion.band.toFixed(1)}<small>/9</small></strong></div>
      <div className="media-criterion-detail"><span>Evidence</span><p>{criterion.evidence}</p></div>
      <div className="media-criterion-detail"><span>Next improvement</span><p>{criterion.improvement}</p></div>
    </Card>)}</div>

    <div className="media-feedback-grid">
      <Card><div className="media-feedback-heading"><Check size={16} /><strong>Strengths</strong></div><ul>{assessment.strengths.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></Card>
      <Card><div className="media-feedback-heading"><Target size={16} /><strong>Practice next</strong></div><ul>{assessment.nextSteps.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></Card>
    </div>

    <section className="media-sentence-feedback" aria-labelledby="media-sentence-feedback-heading">
      <div className="media-sentence-feedback-heading"><div><span className="section-kicker">DETAILED LANGUAGE REVIEW</span><h3 id="media-sentence-feedback-heading">Sentence-by-sentence feedback</h3></div><span>{assessment.sentenceFeedback?.length ?? 0} sentences reviewed</span></div>
      <SentenceFeedbackList items={assessment.sentenceFeedback ?? []} />
    </section>

    <details className="media-transcript">
      <summary>Candidate transcript <span>{assessment.transcript.trim() ? 'View' : 'Not provided'}</span></summary>
      <p>{assessment.transcript.trim() || 'Gemini did not return a transcript for this assessment.'}</p>
    </details>
    <p className="evaluation-disclaimer">AI-generated speaking practice feedback, not an official IELTS score or a substitute for a certified examiner. The archive is saved in this browser and is not synced across devices.</p>
    {assessment.cleanupWarning && <p className="media-cleanup-warning" role="status">{assessment.cleanupWarning}</p>}
  </div>
}
