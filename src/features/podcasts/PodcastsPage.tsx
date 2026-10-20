import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioLines,
  BookOpen,
  CheckCircle2,
  Clock3,
  Headphones,
  LoaderCircle,
  MessageCircle,
  Pause,
  Play,
  Radio,
  Search,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { CoachAssignment } from '@/features/assignments/types'
import type { UserProfile } from '@/features/profile/localAccount'
import type { TestResult } from '@/features/simulator/types'
import type { LexicalEntry } from '@/features/vault/lexicalEntries'
import { shareAudioWithCoach } from '@/features/assistant/audioSharing'
import { SpeechHighlight } from '@/features/simulator/SpeechHighlight'
import { transcriptPositionAtTime, wordIndexAtElapsed } from '@/features/simulator/speechTiming'
import { deletePodcastAudio, loadPodcastAudio, savePodcastAudio } from './audioStorage'
import { generateSpeakiaPodcast, synthesizePodcastAudio } from './podcastGeneration'
import { loadPodcasts, savePodcasts } from './storage'
import { useLivePodcast } from './useLivePodcast'
import {
  PODCAST_SCRIPT_MODELS,
  PODCAST_LANGUAGES,
  PODCAST_TTS_MODELS,
  type PodcastLanguage,
  type PodcastPlaybackMode,
  type PodcastScriptModel,
  type PodcastTtsModel,
  type SpeakiaPodcast,
} from './types'

const podcastTopics = [
  'My progress and what to practise next',
  'How to make the most of Speakia',
  'IELTS Speaking strategies that really help',
  'Vocabulary and grammar for natural answers',
  'Confidence, fluency, and handling difficult questions',
]

function loadPodcastModelPreference<T extends string>(
  username: string,
  key: 'script-model' | 'speech-model' | 'language',
  options: readonly { id: T; label: string }[],
  fallback: T,
): T {
  try {
    const saved = localStorage.getItem(`speakia-podcasts-${key}-v1:${username.trim().toLocaleLowerCase()}`)
    return options.find((option) => option.id === saved)?.id ?? fallback
  } catch (error) {
    console.error(`Unable to load the saved podcast ${key} preference.`, error)
    return fallback
  }
}

function loadPodcastStreamingPreference(username: string): boolean {
  try {
    return localStorage.getItem(`speakia-podcasts-streaming-v1:${username.trim().toLocaleLowerCase()}`) === 'true'
  } catch (error) {
    console.error('Unable to load the saved podcast streaming preference.', error)
    return false
  }
}

function loadPodcastPlaybackMode(username: string): PodcastPlaybackMode {
  try {
    return localStorage.getItem(`speakia-podcasts-playback-mode-v1:${username.trim().toLocaleLowerCase()}`) === 'live'
      ? 'live'
      : 'recorded'
  } catch (error) {
    console.error('Unable to load the saved podcast playback mode.', error)
    return 'recorded'
  }
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60))
  return `${minutes} min`
}

function formatEpisodeDate(value: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function readCoachActivity(): {
  recentLearnerRequests: string[]
  modules: { kind: string; title: string; topic: string; summary: string; interactions: string[] }[]
  learnerMessageCount: number
} {
  try {
    const stored = localStorage.getItem('speakia-coach-conversation-v1')
    if (!stored) return { recentLearnerRequests: [], modules: [], learnerMessageCount: 0 }
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) throw new Error('Saved Speakia coach activity is not a list.')
    const messages = parsed.filter((message): message is Record<string, unknown> =>
      typeof message === 'object' && message !== null && !Array.isArray(message))
    const recentLearnerRequests = messages
      .filter((message) => message.role === 'user' && typeof message.text === 'string')
      .slice(-6)
      .map((message) => (message.text as string).trim().slice(0, 180))
      .filter(Boolean)
    const modules = messages.flatMap((message) => {
      const module = typeof message.lesson === 'object' && message.lesson !== null
        ? message.lesson
        : typeof message.embeddedModule === 'object' && message.embeddedModule !== null
          ? message.embeddedModule
          : null
      if (!module || Array.isArray(module)) return []
      const record = module as Record<string, unknown>
      if (typeof record.title !== 'string' || typeof record.topic !== 'string' || typeof record.summary !== 'string') return []
      const interactions = Array.isArray(record.interactions)
        ? record.interactions.filter((item): item is string => typeof item === 'string').slice(-8)
        : []
      return [{
        kind: typeof record.kind === 'string' ? record.kind : 'lesson',
        title: record.title.slice(0, 100),
        topic: record.topic.slice(0, 100),
        summary: record.summary.slice(0, 250),
        interactions,
      }]
    }).slice(-8)
    return {
      recentLearnerRequests,
      modules,
      learnerMessageCount: messages.filter((message) => message.role === 'user').length,
    }
  } catch (error) {
    console.error('Unable to read recent Speakia coach activity for podcast personalization.', error)
    return { recentLearnerRequests: [], modules: [], learnerMessageCount: 0 }
  }
}

export function PodcastsPage({
  username,
  profile,
  apiKey,
  results,
  lexicalEntries,
  assignments,
}: {
  username: string
  profile: UserProfile
  apiKey: string
  results: TestResult[]
  lexicalEntries: LexicalEntry[]
  assignments: CoachAssignment[]
}) {
  const [podcasts, setPodcasts] = useState(() => loadPodcasts(username))
  const [selectedId, setSelectedId] = useState<string | null>(() => loadPodcasts(username)[0]?.id ?? null)
  const [topic, setTopic] = useState(podcastTopics[0])
  const [customTopic, setCustomTopic] = useState('')
  const [scriptModel, setScriptModel] = useState<PodcastScriptModel>(() =>
    loadPodcastModelPreference(username, 'script-model', PODCAST_SCRIPT_MODELS, PODCAST_SCRIPT_MODELS[0].id))
  const [speechModel, setSpeechModel] = useState<PodcastTtsModel>(() =>
    loadPodcastModelPreference(username, 'speech-model', PODCAST_TTS_MODELS, PODCAST_TTS_MODELS[0].id))
  const [language, setLanguage] = useState<PodcastLanguage>(() =>
    loadPodcastModelPreference(username, 'language', PODCAST_LANGUAGES, PODCAST_LANGUAGES[0].id))
  const [streaming, setStreaming] = useState(() => loadPodcastStreamingPreference(username))
  const [playbackMode, setPlaybackMode] = useState<PodcastPlaybackMode>(() => loadPodcastPlaybackMode(username))
  const [query, setQuery] = useState('')
  const [generating, setGenerating] = useState(false)
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [sharingPodcastAudio, setSharingPodcastAudio] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [playbackDuration, setPlaybackDuration] = useState(0)
  const [archiveModeFilter, setArchiveModeFilter] = useState<'all' | PodcastPlaybackMode>('all')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [audioSource, setAudioSource] = useState<{ podcastId: string; url: string; mode: 'recorded' | 'live' } | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const podcastsRef = useRef(podcasts)
  const selectedPodcast = podcasts.find((podcast) => podcast.id === selectedId) ?? null
  const saveLivePodcastAudio = useCallback(async (podcastId: string, audio: Blob, turns: SpeakiaPodcast['turns'], durationSeconds: number) => {
    await savePodcastAudio(podcastId, audio, 'live')
    const nextPodcasts = podcastsRef.current.map((podcast) => podcast.id === podcastId
      ? { ...podcast, turns, durationSeconds, liveAudioAvailable: true }
      : podcast)
    if (!savePodcasts(username, nextPodcasts)) {
      throw new Error('The live podcast audio was generated but its archive could not be updated.')
    }
    podcastsRef.current = nextPodcasts
    setPodcasts(nextPodcasts)
    setNotice('Your live podcast is complete. Its audio is saved for replay.')
  }, [username])
  const livePodcast = useLivePodcast(saveLivePodcastAudio)
  const selectedPodcastTurns = selectedPodcast
    ? selectedPodcast.playbackMode === 'live' && livePodcast.podcastId === selectedPodcast.id
      ? livePodcast.turns
      : selectedPodcast.turns
    : []
  const filteredPodcasts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return podcasts.filter((podcast) => (
      (archiveModeFilter === 'all' || (podcast.playbackMode ?? 'recorded') === archiveModeFilter)
      && (!normalizedQuery || `${podcast.title} ${podcast.topic} ${podcast.summary}`.toLocaleLowerCase().includes(normalizedQuery))
    ))
  }, [archiveModeFilter, podcasts, query])

  useEffect(() => {
    podcastsRef.current = podcasts
  }, [podcasts])

  useEffect(() => {
    const audioElement = audioRef.current
    return () => {
      audioElement?.pause()
      if (audioSource?.url) URL.revokeObjectURL(audioSource.url)
    }
  }, [audioSource?.url])

  useEffect(() => {
    try {
      localStorage.setItem(`speakia-podcasts-script-model-v1:${username.trim().toLocaleLowerCase()}`, scriptModel)
      localStorage.setItem(`speakia-podcasts-speech-model-v1:${username.trim().toLocaleLowerCase()}`, speechModel)
      localStorage.setItem(`speakia-podcasts-language-v1:${username.trim().toLocaleLowerCase()}`, language)
      localStorage.setItem(`speakia-podcasts-streaming-v1:${username.trim().toLocaleLowerCase()}`, String(streaming))
      localStorage.setItem(`speakia-podcasts-playback-mode-v1:${username.trim().toLocaleLowerCase()}`, playbackMode)
    } catch (error) {
      console.error('Unable to save the podcast model preferences.', error)
    }
  }, [language, playbackMode, scriptModel, speechModel, streaming, username])

  async function playPodcast(podcast: SpeakiaPodcast) {
    setError('')
    setNotice('')
    if ((podcast.playbackMode ?? 'recorded') === 'live') {
      if (livePodcast.state !== 'idle') {
        livePodcast.stop()
        return
      }
      audioRef.current?.pause()
      setPlayingId(null)
      setSelectedId(podcast.id)
      await livePodcast.start(podcast.topic, podcast.language ?? 'English', podcast.id, apiKey)
      return
    }
    if (loadingAudio) return
    if (playingId === podcast.id) {
      const player = audioRef.current
      if (!player) return
      if (player.paused) {
        try {
          await player.play()
        } catch (caughtError) {
          console.error('Unable to resume Gemini-generated podcast audio.', caughtError)
          setError('Unable to resume playback. Try using the audio player controls.')
        }
        setIsPaused(false)
        setNotice('Episode resumed.')
      } else {
        player.pause()
        setIsPaused(true)
        setNotice('Episode paused.')
      }
      return
    }
    if (audioSource?.podcastId === podcast.id && audioRef.current) {
      const player = audioRef.current
      if (player.ended) player.currentTime = 0
      try {
        await player.play()
        setPlayingId(podcast.id)
        setIsPaused(false)
      } catch (caughtError) {
        console.error('Unable to play saved Gemini podcast audio.', caughtError)
        setError('Unable to start playback. Use the audio player controls or try again.')
      }
      return
    }
    setLoadingAudio(true)
    audioRef.current?.pause()
    setPlayingId(null)
    setIsPaused(false)
    try {
      let audio = await loadPodcastAudio(podcast.id, 'recorded')
      if (!audio) {
        setNotice('Generating Gemini podcast audio for this archived episode…')
        const playbackModel = podcast.speechModel ?? speechModel
        const useStreaming = podcast.streaming ?? streaming
        audio = await synthesizePodcastAudio(apiKey, podcast.turns, playbackModel, useStreaming)
        await savePodcastAudio(podcast.id, audio)
        const nextPodcasts = podcasts.map((episode) => episode.id === podcast.id
          ? { ...episode, audioAvailable: true, speechModel: playbackModel, streaming: useStreaming }
          : episode)
        setPodcasts(nextPodcasts)
        podcastsRef.current = nextPodcasts
        if (!savePodcasts(username, nextPodcasts)) {
          setNotice('Gemini audio was generated, but the archive metadata could not be updated.')
        } else {
          setNotice('Gemini audio is ready and saved for future playback.')
        }
      }
      if (audioSource?.url) URL.revokeObjectURL(audioSource.url)
      const url = URL.createObjectURL(audio)
      setSelectedId(podcast.id)
      setAudioSource({ podcastId: podcast.id, url, mode: 'recorded' })
      requestAnimationFrame(() => {
        const player = audioRef.current
        if (!player) return
        player.src = url
        player.load()
        setPlaybackTime(0)
        setPlaybackDuration(podcast.durationSeconds)
        void player.play().then(() => {
          setPlayingId(podcast.id)
          setIsPaused(false)
        }).catch((caughtError: unknown) => {
          console.error('Unable to play Gemini-generated podcast audio.', caughtError)
          setNotice('Audio is ready. Press Play in the audio player to listen.')
        })
      })
    } catch (caughtError) {
      console.error('Unable to load or generate archived Gemini podcast audio.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load this podcast audio.')
    } finally {
      setLoadingAudio(false)
    }
  }

  function stopPlayback() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setPlayingId(null)
    setIsPaused(false)
    setNotice('Playback stopped.')
  }

  async function playSavedLiveCapture(podcast: SpeakiaPodcast) {
    setError('')
    try {
      const audio = await loadPodcastAudio(podcast.id, 'live')
      if (!audio) throw new Error('No live podcast capture has been saved for this episode yet.')
      if (audioSource?.url) URL.revokeObjectURL(audioSource.url)
      const url = URL.createObjectURL(audio)
      setSelectedId(podcast.id)
      setAudioSource({ podcastId: podcast.id, url, mode: 'live' })
      requestAnimationFrame(() => {
        const player = audioRef.current
        if (!player) return
        player.src = url
        player.load()
        void player.play().catch((caughtError: unknown) => {
          console.error('Unable to replay the saved live podcast capture.', caughtError)
          setError('The saved live podcast is ready. Press Play in the audio player to listen.')
        })
      })
    } catch (caughtError) {
      console.error('Unable to load the saved live podcast capture.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load the saved live podcast capture.')
    }
  }

  async function sharePodcastWithCoach(podcast: SpeakiaPodcast) {
    const mode = podcast.playbackMode ?? 'recorded'
    setSharingPodcastAudio(true)
    setError('')
    try {
      const audio = await loadPodcastAudio(podcast.id, mode)
      if (!audio) throw new Error('The saved audio recording is not available for this episode.')
      shareAudioWithCoach(audio, podcast.title)
    } catch (caughtError) {
      console.error('Unable to share saved podcast audio with Speakia Coach.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to share this podcast recording with Speakia Coach.')
    } finally {
      setSharingPodcastAudio(false)
    }
  }

  async function createEpisode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (generating || livePodcast.state !== 'idle') return
    setError('')
    setNotice('')
    const selectedTopic = customTopic.trim() || topic
    if (playbackMode === 'live') {
      const normalizedTopic = selectedTopic.trim().slice(0, 180)
      if (normalizedTopic.length < 3) {
        setError('Choose a podcast topic before starting a live episode.')
        return
      }
      const liveEpisode: SpeakiaPodcast = {
        id: crypto.randomUUID(),
        title: `Live conversation: ${normalizedTopic}`,
        topic: normalizedTopic,
        createdAt: new Date().toISOString(),
        durationSeconds: 0,
        summary: `An unscripted, real-time conversation between Aisha and Noah about ${normalizedTopic}.`,
        turns: [],
        language,
        playbackMode: 'live',
        liveAudioAvailable: false,
      }
      const nextPodcasts = [liveEpisode, ...podcastsRef.current]
      if (!savePodcasts(username, nextPodcasts)) {
        setError('The live episode could not be added to your archive. Check browser storage space and permissions.')
        return
      }
      podcastsRef.current = nextPodcasts
      setPodcasts(nextPodcasts)
      setSelectedId(liveEpisode.id)
      setCustomTopic('')
      setNotice('Connecting Aisha and Noah now. Your unscripted live episode will begin as soon as both hosts are ready.')
      await livePodcast.start(normalizedTopic, language, liveEpisode.id, apiKey)
      return
    }
    setGenerating(true)
    try {
      const generated = await generateSpeakiaPodcast(
        apiKey,
        selectedTopic,
        { profile, results, lexicalEntries, assignments, coachActivity: readCoachActivity() },
        scriptModel,
        speechModel,
        language,
        streaming,
      )
      const { audio, ...podcast } = generated
      let audioAvailable = false
      if (audio) {
        try {
          await savePodcastAudio(podcast.id, audio, 'recorded')
          audioAvailable = true
        } catch (caughtError) {
          console.error('Podcast script generated, but Gemini audio could not be archived.', caughtError)
        }
      }
      const savedPodcast = { ...podcast, audioAvailable }
      const nextPodcasts = [savedPodcast, ...podcasts]
      if (!savePodcasts(username, nextPodcasts)) {
        if (audioAvailable) {
          try {
            await deletePodcastAudio(savedPodcast.id)
          } catch (caughtError) {
            console.error('Unable to clean up podcast audio after archive save failed.', caughtError)
          }
        }
        setNotice('Episode generated, but this browser could not save it to the archive.')
        setError('The episode could not be saved. Check browser storage space and permissions.')
        return
      }
      podcastsRef.current = nextPodcasts
      setPodcasts(nextPodcasts)
      setSelectedId(savedPodcast.id)
      if (audioSource?.url) URL.revokeObjectURL(audioSource.url)
      setAudioSource(null)
      setNotice(audioAvailable
        ? 'Your Gemini-voiced episode is ready and saved in your archive.'
        : 'Your transcript is archived; Gemini audio could not be saved and can be retried from the archive.')
      setCustomTopic('')
    } catch (caughtError) {
      console.error('Unable to create a Speakia podcast episode.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Speakia could not create this episode. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function removeEpisode(podcastId: string) {
    const nextPodcasts = podcasts.filter((podcast) => podcast.id !== podcastId)
    if (!savePodcasts(username, nextPodcasts)) {
      setError('This episode could not be removed from the archive.')
      return
    }
    if (playingId === podcastId) stopPlayback()
    if (livePodcast.state !== 'idle' && selectedId === podcastId) livePodcast.stop()
    let audioCleanupWarning = ''
    try {
      await deletePodcastAudio(podcastId)
    } catch (caughtError) {
      console.error('Unable to delete archived podcast audio.', caughtError)
      audioCleanupWarning = ' The episode’s audio file could not be deleted.'
    }
    if (audioSource?.podcastId === podcastId) {
      URL.revokeObjectURL(audioSource.url)
      setAudioSource(null)
    }
    setPodcasts(nextPodcasts)
    podcastsRef.current = nextPodcasts
    if (selectedId === podcastId) setSelectedId(nextPodcasts[0]?.id ?? null)
    setError('')
    setNotice(`Episode removed from your archive.${audioCleanupWarning}`)
  }

  return (
    <div className="page-content inner-page podcasts-page">
      <div className="inner-page-heading">
        <div>
          <p className="eyebrow">YOUR PERSONAL IELTS AUDIO SHOW</p>
          <h1>Speakia Podcasts</h1>
          <p className="page-subtitle">Two AI co-hosts turn your learning progress and IELTS goals into a helpful, listenable conversation.</p>
        </div>
        <div className="podcast-heading-stat"><Headphones size={17} /><strong>{podcasts.length}</strong><span>episodes saved</span></div>
      </div>

      <Card className="podcast-create-card">
        <details className="podcast-create-accordion">
          <summary className="podcast-create-summary">
            <div className="podcast-create-art" aria-hidden="true">
              <span><Radio size={24} /></span>
              <i className="podcast-wave podcast-wave-one" /><i className="podcast-wave podcast-wave-two" /><i className="podcast-wave podcast-wave-three" />
            </div>
            <div className="podcast-create-copy">
              <span className="podcast-kicker"><Sparkles size={13} /> A CONVERSATION ABOUT YOUR LEARNING</span>
              <h2>Create a personalized podcast</h2>
              <p>Choose a starting point, language, script and speech models, and streaming preference for Aisha and Noah.</p>
            </div>
          </summary>
          <div className="podcast-create-content">
          <form className="podcast-create-form" onSubmit={(event) => void createEpisode(event)}>
            <label htmlFor="podcast-topic">Choose a starting point</label>
            <div className="podcast-topic-row">
              <select id="podcast-topic" value={topic} onChange={(event) => setTopic(event.target.value)}>
                {podcastTopics.map((item) => <option key={item}>{item}</option>)}
              </select>
              <span>or</span>
              <input aria-label="Custom podcast topic" value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="Suggest a topic…" maxLength={180} />
              <Button type="submit" disabled={generating || livePodcast.state !== 'idle' || !apiKey.trim()}>
                {generating ? <><LoaderCircle className="podcast-spin" size={16} /> Writing & voicing…</> : playbackMode === 'live' ? <><Radio size={15} /> Start live podcast</> : <><Sparkles size={15} /> Create recorded podcast</>}
              </Button>
            </div>
            <fieldset className="podcast-playback-choice" disabled={generating}>
              <legend>How would you like to hear this episode?</legend>
              <label className={playbackMode === 'live' ? 'podcast-playback-choice-active' : ''}>
                <input type="radio" name="podcast-playback-mode" value="live" checked={playbackMode === 'live'} onChange={() => setPlaybackMode('live')} disabled={livePodcast.state !== 'idle'} />
                <span className="podcast-playback-choice-icon"><Radio size={17} /></span>
                <span><strong>Live podcast</strong><small>Two Gemini Live hosts start an unscripted conversation immediately. No script generation and no microphone.</small></span>
              </label>
              <label className={playbackMode === 'recorded' ? 'podcast-playback-choice-active' : ''}>
                <input type="radio" name="podcast-playback-mode" value="recorded" checked={playbackMode === 'recorded'} onChange={() => setPlaybackMode('recorded')} disabled={livePodcast.state !== 'idle'} />
                <span className="podcast-playback-choice-icon"><Headphones size={17} /></span>
                <span><strong>Recorded podcast</strong><small>Generate a ready-to-replay, two-voice recording with Gemini TTS.</small></span>
              </label>
            </fieldset>
            <div className="podcast-model-row">
              <label htmlFor="podcast-language">
                Podcast language
                <select
                  id="podcast-language"
                  value={language}
                  onChange={(event) => {
                    const selected = PODCAST_LANGUAGES.find((option) => option.id === event.target.value)
                    if (selected) setLanguage(selected.id)
                  }}
                  disabled={generating}
                >
                  {PODCAST_LANGUAGES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
              {playbackMode === 'recorded' && <label htmlFor="podcast-script-model">
                Script model
                <select
                  id="podcast-script-model"
                  value={scriptModel}
                  onChange={(event) => {
                    const selected = PODCAST_SCRIPT_MODELS.find((model) => model.id === event.target.value)
                    if (selected) setScriptModel(selected.id)
                  }}
                  disabled={generating}
                >
                  {PODCAST_SCRIPT_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
                </select>
              </label>}
              {playbackMode === 'recorded' && <label htmlFor="podcast-speech-model">
                Text-to-speech model
                <select
                  id="podcast-speech-model"
                  value={speechModel}
                  onChange={(event) => {
                    const selected = PODCAST_TTS_MODELS.find((model) => model.id === event.target.value)
                    if (selected) setSpeechModel(selected.id)
                  }}
                  disabled={generating}
                >
                  {PODCAST_TTS_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
                </select>
              </label>}
              {playbackMode === 'recorded' && <label htmlFor="podcast-streaming">
                Streaming speech generation
                <select
                  id="podcast-streaming"
                  value={streaming ? 'on' : 'off'}
                  onChange={(event) => setStreaming(event.target.value === 'on')}
                  disabled={generating}
                >
                  <option value="off">Off · complete WAV response</option>
                  <option value="on">On · stream audio chunks</option>
                </select>
              </label>}
            </div>
            <p className="podcast-form-hint">{PODCAST_LANGUAGES.find((option) => option.id === language)?.description} {playbackMode === 'live' ? 'Aisha and Noah connect directly to Gemini Live and start talking about your topic without a generated script. No microphone is needed.' : streaming ? 'Streaming mode requests headerless 24 kHz PCM chunks and packages them as WAV for playback and archiving.' : 'Gemini TTS generates a complete two-voice WAV recording for playback and archiving.'} {playbackMode === 'recorded' ? 'A podcast script is generated before recording.' : 'Only the topic and selected language are sent as live-session context.'} Podcasts are archived in this browser.</p>
            {!apiKey.trim() && <p className="podcast-form-hint">Add your Gemini API key in Settings to create a personalized episode.</p>}
            {results.length === 0 && <p className="podcast-form-hint">No saved practice assessments yet. Your first episode will focus on Speakia resources and general IELTS guidance.</p>}
          </form>
          </div>
        </details>
      </Card>

      {(error || notice) && <p className={error ? 'podcast-alert podcast-alert-error' : 'podcast-alert'} role={error ? 'alert' : 'status'}>{error || notice}</p>}

      {selectedPodcast && (
        <section className="podcast-player-section" aria-label="Selected podcast episode">
          <div className="podcast-section-heading">
            <div><p className="eyebrow">NOW IN YOUR STUDIO</p><h2>{selectedPodcast.title}</h2></div>
            <span className="podcast-date"><Clock3 size={14} />{formatEpisodeDate(selectedPodcast.createdAt)} · {selectedPodcast.durationSeconds ? formatDuration(selectedPodcast.durationSeconds) : 'Live episode'}</span>
          </div>
          <Card className="podcast-player-card">
            <div className="podcast-player-top">
              <span className={`podcast-host-avatar podcast-host-aisha ${livePodcast.activeSpeaker === 'Aisha' ? 'podcast-host-speaking' : ''}`}>A</span>
              <span className={`podcast-host-avatar podcast-host-noah ${livePodcast.activeSpeaker === 'Noah' ? 'podcast-host-speaking' : ''}`}>N</span>
              <div className="podcast-player-description"><span>AISHA & NOAH · YOUR SPEAKIA CO-HOSTS</span><strong>{selectedPodcast.topic}</strong><p>{selectedPodcast.summary}</p></div>
              <div className="podcast-player-controls">
                <button className="podcast-play-button" aria-label={loadingAudio || livePodcast.state === 'connecting' ? 'Preparing podcast playback' : livePodcast.state === 'live' ? 'Stop live podcast' : playingId === selectedPodcast.id ? (isPaused ? 'Resume podcast' : 'Pause podcast') : selectedPodcast.playbackMode === 'live' ? 'Start live podcast' : 'Play recorded podcast'} title={loadingAudio || livePodcast.state === 'connecting' ? 'Preparing podcast playback' : livePodcast.state === 'live' ? 'Stop live podcast' : playingId === selectedPodcast.id ? (isPaused ? 'Resume podcast' : 'Pause podcast') : selectedPodcast.playbackMode === 'live' ? 'Start live podcast' : 'Play recorded podcast'} disabled={loadingAudio || livePodcast.state === 'saving'} onClick={() => void playPodcast(selectedPodcast)}>
                  {loadingAudio || livePodcast.state === 'connecting' || livePodcast.state === 'saving' ? <LoaderCircle className="podcast-spin" size={18} /> : livePodcast.state === 'live' ? <Square size={16} fill="currentColor" /> : playingId === selectedPodcast.id && !isPaused ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                {playingId === selectedPodcast.id && <button className="podcast-stop-button" aria-label="Stop podcast" title="Stop episode" onClick={stopPlayback}><Square size={15} fill="currentColor" /></button>}
              </div>
            </div>
            {(selectedPodcast.playbackMode ?? 'recorded') === 'live' && (
              <div className="podcast-live-controls">
                <span className={`podcast-live-badge ${livePodcast.state === 'live' ? 'podcast-live-badge-active' : ''}`}><i />{livePodcast.state === 'connecting' ? 'CONNECTING LIVE HOSTS' : livePodcast.state === 'saving' ? 'SAVING LIVE CAPTURE' : livePodcast.state === 'live' ? 'LIVE ON AIR' : 'GEMINI LIVE PODCAST'}</span>
                {livePodcast.state !== 'idle' && <span className="podcast-live-meta"><Clock3 size={13} /> {Math.floor(livePodcast.elapsedSeconds / 60)}:{String(livePodcast.elapsedSeconds % 60).padStart(2, '0')} · {livePodcast.activeSpeaker ? `${livePodcast.activeSpeaker} speaking` : 'Next host preparing'} · {Math.max(0, livePodcast.turnIndex + 1)} / {livePodcast.totalTurns} turns</span>}
                {selectedPodcast.liveAudioAvailable && <Button type="button" variant="outline" onClick={() => void playSavedLiveCapture(selectedPodcast)}><Play size={14} /> Replay saved live audio</Button>}
                {livePodcast.error && <p className="podcast-alert podcast-alert-error" role="alert">{livePodcast.error}</p>}
              </div>
            )}
            <audio
              ref={audioRef}
              className={`podcast-audio ${selectedPodcast.playbackMode === 'live' && (audioSource?.podcastId !== selectedPodcast.id || audioSource.mode !== 'live') ? 'podcast-audio-hidden' : ''}`}
              controls
              preload="metadata"
              src={audioSource?.podcastId === selectedPodcast.id && audioSource.mode === (selectedPodcast.playbackMode ?? 'recorded') ? audioSource.url : undefined}
              aria-label={`${audioSource?.podcastId === selectedPodcast.id && audioSource.mode === 'live' ? 'Saved live' : 'Gemini-generated'} podcast audio: ${selectedPodcast.title}`}
              onPlay={() => { setPlayingId(selectedPodcast.id); setIsPaused(false) }}
              onPause={() => {
                if (audioRef.current && !audioRef.current.ended && audioRef.current.currentTime > 0) setIsPaused(true)
              }}
              onEnded={() => { setPlayingId(null); setIsPaused(false) }}
              onTimeUpdate={() => {
                setPlaybackTime(audioRef.current?.currentTime ?? 0)
                setPlaybackDuration(audioRef.current?.duration || selectedPodcast.durationSeconds)
              }}
              onDurationChange={() => setPlaybackDuration(audioRef.current?.duration || selectedPodcast.durationSeconds)}
              onError={() => {
                if (audioSource?.podcastId === selectedPodcast.id) {
                  setError('The archived Gemini audio could not be played. Try generating audio again from this episode.')
                  setPlayingId(null)
                  setIsPaused(false)
                }
              }}
            />
            {(selectedPodcast.playbackMode ?? 'recorded') === 'recorded'
              ? <p className="podcast-playback-note"><Volume2 size={13} />Speech: {PODCAST_TTS_MODELS.find((model) => model.id === selectedPodcast.speechModel)?.label ?? 'model not recorded for this older episode'} · Script: {PODCAST_SCRIPT_MODELS.find((model) => model.id === selectedPodcast.scriptModel)?.label ?? 'model not recorded'} · Two distinct voices. Audio is archived for replay.</p>
              : <p className="podcast-playback-note"><Radio size={13} />Unscripted live conversation · Gemini Live · {selectedPodcast.language ?? 'English'} · No microphone needed.</p>}
            {selectedPodcast.playbackMode !== 'live' && !selectedPodcast.audioAvailable && <p className="podcast-form-hint">Gemini audio is not yet saved for this episode. Press Play to generate and archive it now.</p>}
            {((selectedPodcast.playbackMode ?? 'recorded') === 'live' ? selectedPodcast.liveAudioAvailable : selectedPodcast.audioAvailable) && <div className="podcast-coach-share"><Button type="button" variant="outline" size="sm" disabled={sharingPodcastAudio} onClick={() => void sharePodcastWithCoach(selectedPodcast)}>{sharingPodcastAudio ? <LoaderCircle className="podcast-spin" size={14} /> : <MessageCircle size={14} />} Discuss recording with Coach</Button><span>Speakia Coach will listen to this episode in a live conversation.</span></div>}
            {playingId === selectedPodcast.id && <div className="podcast-progress" role="status"><span style={{ width: `${Math.min(100, Math.round(playbackTime / Math.max(playbackDuration, 1) * 100))}%` }} /><small>{formatDuration(Math.max(0, playbackDuration - playbackTime))} remaining</small></div>}
          </Card>
          <div className="podcast-transcript">
            <div className="podcast-transcript-heading"><h3><AudioLines size={17} /> Live conversation transcript</h3><span>{selectedPodcastTurns.length} turns</span></div>
            {selectedPodcastTurns.length
              ? selectedPodcastTurns.map((turn, index) => {
                const liveActive = (selectedPodcast.playbackMode ?? 'recorded') === 'live'
                  && livePodcast.podcastId === selectedPodcast.id
                  && livePodcast.state === 'live'
                  && livePodcast.turnIndex === index
                  && livePodcast.activeSpeaker === turn.speaker
                const playbackPosition = playingId === selectedPodcast.id
                  ? transcriptPositionAtTime(selectedPodcastTurns, playbackTime, playbackDuration)
                  : null
                const activeWordIndex = liveActive
                  ? wordIndexAtElapsed(turn.text, livePodcast.speechElapsedSeconds)
                  : playbackPosition?.turnIndex === index ? playbackPosition.wordIndex : -1
                return (
                  <article className={`podcast-turn podcast-turn-${turn.speaker.toLocaleLowerCase()} ${liveActive || playbackPosition?.turnIndex === index ? 'podcast-turn-active' : ''}`} key={`${selectedPodcast.id}-${index}`}>
                    <span className="podcast-turn-avatar">{turn.speaker === 'Aisha' ? 'A' : 'N'}</span>
                    <div><strong>{turn.speaker}</strong><p><SpeechHighlight text={turn.text} wordIndex={activeWordIndex} /></p></div>
                  </article>
                )
              })
              : <p className="podcast-form-hint">{livePodcast.state === 'connecting' ? 'The hosts will speak here when the live connection is ready.' : 'Start the live episode to listen to Aisha and Noah improvise a conversation around this topic.'}</p>}
          </div>
        </section>
      )}

      <section className="podcast-archive-section" aria-label="Podcast archive">
        <div className="podcast-section-heading">
          <div><p className="eyebrow">YOUR LISTENING LIBRARY</p><h2>Podcast archive</h2></div>
          {podcasts.length > 0 && <label className="podcast-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search episodes" aria-label="Search podcast archive" /></label>}
        </div>
        {podcasts.length > 0 && <div className="podcast-archive-filters" role="group" aria-label="Filter podcast archive by playback mode">
          {([
            { id: 'all', label: 'All episodes', count: podcasts.length },
            { id: 'live', label: 'Live podcasts', count: podcasts.filter((episode) => episode.playbackMode === 'live').length },
            { id: 'recorded', label: 'Recorded podcasts', count: podcasts.filter((episode) => (episode.playbackMode ?? 'recorded') === 'recorded').length },
          ] as const).map((filter) => <button type="button" key={filter.id} className={archiveModeFilter === filter.id ? 'podcast-archive-filter-active' : ''} aria-pressed={archiveModeFilter === filter.id} onClick={() => setArchiveModeFilter(filter.id)}>{filter.label}<span>{filter.count}</span></button>)}
        </div>}
        {filteredPodcasts.length ? (
          <div className="podcast-archive-list">
            {filteredPodcasts.map((podcast) => (
              <Card className={`podcast-archive-item ${selectedId === podcast.id ? 'podcast-archive-item-active' : ''}`} key={podcast.id}>
                <span className="podcast-archive-icon"><BookOpen size={18} /></span>
                <button className="podcast-archive-copy" disabled={livePodcast.state !== 'idle'} onClick={() => { if (playingId && playingId !== podcast.id) stopPlayback(); setSelectedId(podcast.id); setError(''); setNotice('') }}>
                  <strong>{podcast.title}</strong><span>{podcast.topic}</span><small><i className={`podcast-archive-mode-icon ${podcast.playbackMode === 'live' ? 'podcast-archive-mode-live' : ''}`}>{podcast.playbackMode === 'live' ? 'LIVE' : 'RECORDED'}</i> · {formatEpisodeDate(podcast.createdAt)} · {podcast.durationSeconds ? `${formatDuration(podcast.durationSeconds)} · ` : ''}{podcast.turns.length} dialogue turns</small>
                </button>
                <button className="podcast-archive-play" aria-label={`${podcast.playbackMode === 'live' ? 'Start live' : 'Play'} ${podcast.title}`} title={`${podcast.playbackMode === 'live' ? 'Start live' : 'Play'} ${podcast.title}`} disabled={livePodcast.state !== 'idle' && (livePodcast.state === 'saving' || podcast.id !== selectedPodcast?.id)} onClick={() => { setSelectedId(podcast.id); void playPodcast(podcast) }}>
                  {playingId === podcast.id && !isPaused ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button className="podcast-archive-delete" aria-label={`Remove ${podcast.title}`} title="Remove from archive" disabled={livePodcast.state !== 'idle'} onClick={() => removeEpisode(podcast.id)}>×</button>
              </Card>
            ))}
          </div>
        ) : podcasts.length ? (
          <Card className="podcast-empty"><Search size={22} /><h3>No episodes match that search</h3><p>Try another title or topic.</p></Card>
        ) : (
          <Card className="podcast-empty"><Headphones size={25} /><h3>Your archive is ready for its first episode</h3><p>Create a personalized podcast above. Episodes stay saved in this browser for your local profile, so you can revisit the transcript and listen again.</p><span><CheckCircle2 size={14} /> Your saved episodes remain on this device</span></Card>
        )}
      </section>
    </div>
  )
}
