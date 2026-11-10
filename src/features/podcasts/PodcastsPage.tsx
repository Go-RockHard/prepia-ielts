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
import { generateSpeakiaPodcast, generateWritiaPodcast, synthesizePodcastAudio } from './podcastGeneration'
import { loadPodcasts, savePodcasts } from './storage'
import { useLivePodcast } from './useLivePodcast'
import {
  DEFAULT_PODCAST_TURN_COUNT,
  PODCAST_HOST_PRESETS,
  PODCAST_LANGUAGES,
  PODCAST_SCRIPT_MODELS,
  PODCAST_TURN_COUNTS,
  PODCAST_TTS_MODELS,
  type PodcastHost,
  type PodcastHostGender,
  type PodcastLanguage,
  type PodcastPlaybackMode,
  type PodcastProduct,
  type PodcastScriptModel,
  type PodcastTtsModel,
  type PodcastWritingAssessment,
  type SpeakiaPodcast,
} from './types'

interface PodcastHostChoice extends PodcastHost {
  customName: boolean
}

function randomHostPair(): [PodcastHostChoice, PodcastHostChoice] {
  const femaleNames = PODCAST_HOST_PRESETS.female
  const maleNames = PODCAST_HOST_PRESETS.male
  const firstGender: PodcastHostGender = Math.random() < 0.5 ? 'female' : 'male'
  const secondGender: PodcastHostGender = Math.random() < 0.5 ? 'female' : 'male'
  const firstOptions = PODCAST_HOST_PRESETS[firstGender]
  const secondOptions = PODCAST_HOST_PRESETS[secondGender]
  const firstName = firstOptions[Math.floor(Math.random() * firstOptions.length)]
  let secondName = secondOptions[Math.floor(Math.random() * secondOptions.length)]
  if (firstGender === secondGender && secondName === firstName) {
    const options = secondGender === 'female' ? femaleNames : maleNames
    secondName = options[(options.indexOf(secondName) + 1) % options.length]
  }
  return [
    { name: firstName, gender: firstGender, customName: false },
    { name: secondName, gender: secondGender, customName: false },
  ]
}

function loadPodcastHosts(username: string, product: PodcastProduct): [PodcastHostChoice, PodcastHostChoice] {
  const fallback = randomHostPair()
  try {
    const stored = localStorage.getItem(`${product}-podcasts-hosts-v1:${username.trim().toLocaleLowerCase()}`)
    if (!stored) return fallback
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || parsed.length !== 2 || !parsed.every((host) =>
      typeof host === 'object'
      && host !== null
      && 'name' in host && typeof host.name === 'string'
      && host.name.trim().length > 0 && host.name.length <= 40
      && 'gender' in host && (host.gender === 'female' || host.gender === 'male')
      && 'customName' in host && typeof host.customName === 'boolean')) {
      throw new Error('Saved podcast host preferences are invalid.')
    }
    return parsed as [PodcastHostChoice, PodcastHostChoice]
  } catch (error) {
    console.error('Unable to load saved podcast host preferences.', error)
    return fallback
  }
}

function podcastHosts(podcast: SpeakiaPodcast): [PodcastHost, PodcastHost] {
  return podcast.hosts ?? [
    { name: podcast.turns[0]?.speaker ?? 'Aisha', gender: 'female' },
    { name: podcast.turns[1]?.speaker ?? 'Noah', gender: 'male' },
  ]
}

const podcastTopics = [
  'My progress and what to practise next',
  'How to make the most of Speakia',
  'IELTS Speaking strategies that really help',
  'Vocabulary and grammar for natural answers',
  'Confidence, fluency, and handling difficult questions',
]

const writiaPodcastTopics = [
  'My writing strengths and next priorities',
  'How to make the most of Writia',
  'Build a weekly IELTS Writing improvement plan',
  'Task 1 overview and accurate data description',
  'Task 2 ideas, paragraph development, and argument',
  'Precise vocabulary and grammatical control',
  'From writing drills to independent task performance',
]

function loadPodcastModelPreference<T extends string>(
  username: string,
  product: PodcastProduct,
  key: 'script-model' | 'speech-model' | 'language',
  options: readonly { id: T; label: string }[],
  fallback: T,
): T {
  try {
    const saved = localStorage.getItem(`${product}-podcasts-${key}-v1:${username.trim().toLocaleLowerCase()}`)
    return options.find((option) => option.id === saved)?.id ?? fallback
  } catch (error) {
    console.error(`Unable to load the saved podcast ${key} preference.`, error)
    return fallback
  }
}

function loadPodcastTurnPreference(username: string, product: PodcastProduct): number {
  try {
    const saved = Number(localStorage.getItem(`${product}-podcasts-turn-count-v1:${username.trim().toLocaleLowerCase()}`))
    return PODCAST_TURN_COUNTS.find((option) => option === saved) ?? DEFAULT_PODCAST_TURN_COUNT
  } catch (error) {
    console.error('Unable to load the saved podcast turn-count preference.', error)
    return DEFAULT_PODCAST_TURN_COUNT
  }
}

function loadPodcastStreamingPreference(username: string, product: PodcastProduct): boolean {
  try {
    return localStorage.getItem(`${product}-podcasts-streaming-v1:${username.trim().toLocaleLowerCase()}`) === 'true'
  } catch (error) {
    console.error('Unable to load the saved podcast streaming preference.', error)
    return false
  }
}

function loadPodcastPlaybackMode(username: string, product: PodcastProduct): PodcastPlaybackMode {
  try {
    return localStorage.getItem(`${product}-podcasts-playback-mode-v1:${username.trim().toLocaleLowerCase()}`) === 'live'
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
  product = 'speakia',
  writingAssessments = [],
  writingAssignments = [],
}: {
  username: string
  profile: UserProfile
  apiKey: string
  results: TestResult[]
  lexicalEntries: LexicalEntry[]
  assignments: CoachAssignment[]
  product?: PodcastProduct
  writingAssessments?: PodcastWritingAssessment[]
  writingAssignments?: Array<{ title: string; focus: string; status: string }>
}) {
  const brandName = product === 'writia' ? 'Writia' : 'Speakia'
  const topics = product === 'writia' ? writiaPodcastTopics : podcastTopics
  const [podcasts, setPodcasts] = useState(() => loadPodcasts(username, product))
  const [selectedId, setSelectedId] = useState<string | null>(() => loadPodcasts(username, product)[0]?.id ?? null)
  const [topic, setTopic] = useState(topics[0])
  const [customTopic, setCustomTopic] = useState('')
  const [scriptModel, setScriptModel] = useState<PodcastScriptModel>(() =>
    loadPodcastModelPreference(username, product, 'script-model', PODCAST_SCRIPT_MODELS, PODCAST_SCRIPT_MODELS[0].id))
  const [speechModel, setSpeechModel] = useState<PodcastTtsModel>(() =>
    loadPodcastModelPreference(username, product, 'speech-model', PODCAST_TTS_MODELS, PODCAST_TTS_MODELS[0].id))
  const [language, setLanguage] = useState<PodcastLanguage>(() =>
    loadPodcastModelPreference(username, product, 'language', PODCAST_LANGUAGES, PODCAST_LANGUAGES[0].id))
  const [hosts, setHosts] = useState<[PodcastHostChoice, PodcastHostChoice]>(() => loadPodcastHosts(username, product))
  const [streaming, setStreaming] = useState(() => loadPodcastStreamingPreference(username, product))
  const [playbackMode, setPlaybackMode] = useState<PodcastPlaybackMode>(() => loadPodcastPlaybackMode(username, product))
  const [turnCount, setTurnCount] = useState(() => loadPodcastTurnPreference(username, product))
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
  const podcastTranscriptRef = useRef<HTMLDivElement>(null)
  const podcastsRef = useRef(podcasts)
  const selectedPodcast = podcasts.find((podcast) => podcast.id === selectedId) ?? null
  const saveLivePodcastAudio = useCallback(async (podcastId: string, audio: Blob, turns: SpeakiaPodcast['turns'], durationSeconds: number) => {
    await savePodcastAudio(podcastId, audio, 'live')
    const nextPodcasts = podcastsRef.current.map((podcast) => podcast.id === podcastId
      ? { ...podcast, turns, durationSeconds, liveAudioAvailable: true }
      : podcast)
    if (!savePodcasts(username, nextPodcasts, product)) {
      throw new Error('The live podcast audio was generated but its archive could not be updated.')
    }
    podcastsRef.current = nextPodcasts
    setPodcasts(nextPodcasts)
    setNotice('Your live podcast is complete. Its audio is saved for replay.')
  }, [product, username])
  const livePodcast = useLivePodcast(saveLivePodcastAudio)
  const selectedPodcastTurns = selectedPodcast
    ? selectedPodcast.playbackMode === 'live' && livePodcast.podcastId === selectedPodcast.id
      ? livePodcast.turns
      : selectedPodcast.turns
    : []
  const selectedPodcastHosts = selectedPodcast ? podcastHosts(selectedPodcast) : [
    { name: 'Aisha', gender: 'female' as const },
    { name: 'Hamza', gender: 'male' as const },
  ]
  const filteredPodcasts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return podcasts.filter((podcast) => (
      (archiveModeFilter === 'all' || (podcast.playbackMode ?? 'recorded') === archiveModeFilter)
      && (!normalizedQuery || `${podcast.title} ${podcast.topic} ${podcast.summary} ${podcast.turns.map((turn) => turn.text).join(' ')}`.toLocaleLowerCase().includes(normalizedQuery)
        || normalizedQuery.split(/\s+/).every((term) => `${podcast.title} ${podcast.topic} ${podcast.summary} ${podcast.turns.map((turn) => turn.text).join(' ')}`.toLocaleLowerCase().includes(term)))
    ))
  }, [archiveModeFilter, podcasts, query])
  const transcriptSearchTerms = useMemo(() => query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean), [query])
  const transcriptMatchPodcast = useMemo(() => {
    if (!transcriptSearchTerms.length) return null
    return filteredPodcasts.find((podcast) => {
      const transcript = podcast.turns.map((turn) => turn.text).join(' ').toLocaleLowerCase()
      return transcriptSearchTerms.every((term) => transcript.includes(term))
    }) ?? null
  }, [filteredPodcasts, transcriptSearchTerms])

  useEffect(() => {
    podcastsRef.current = podcasts
  }, [podcasts])

  useEffect(() => {
    if (!transcriptMatchPodcast || selectedId !== transcriptMatchPodcast.id) return
    const frameId = window.requestAnimationFrame(() => {
      podcastTranscriptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.requestAnimationFrame(() => {
        podcastTranscriptRef.current?.querySelector<HTMLElement>('.speech-word-search-match[tabindex="-1"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [selectedId, transcriptMatchPodcast])

  useEffect(() => {
    const audioElement = audioRef.current
    return () => {
      audioElement?.pause()
      if (audioSource?.url) URL.revokeObjectURL(audioSource.url)
    }
  }, [audioSource?.url])

  useEffect(() => {
    try {
      localStorage.setItem(`${product}-podcasts-script-model-v1:${username.trim().toLocaleLowerCase()}`, scriptModel)
      localStorage.setItem(`${product}-podcasts-speech-model-v1:${username.trim().toLocaleLowerCase()}`, speechModel)
      localStorage.setItem(`${product}-podcasts-language-v1:${username.trim().toLocaleLowerCase()}`, language)
      localStorage.setItem(`${product}-podcasts-streaming-v1:${username.trim().toLocaleLowerCase()}`, String(streaming))
      localStorage.setItem(`${product}-podcasts-playback-mode-v1:${username.trim().toLocaleLowerCase()}`, playbackMode)
      localStorage.setItem(`${product}-podcasts-turn-count-v1:${username.trim().toLocaleLowerCase()}`, String(turnCount))
      localStorage.setItem(`${product}-podcasts-hosts-v1:${username.trim().toLocaleLowerCase()}`, JSON.stringify(hosts))
    } catch (error) {
      console.error('Unable to save the podcast model preferences.', error)
    }
  }, [hosts, language, playbackMode, product, scriptModel, speechModel, streaming, turnCount, username])

  function updateHost(index: 0 | 1, update: Partial<PodcastHostChoice>) {
    setHosts((current) => current.map((host, hostIndex) => hostIndex === index
      ? { ...host, ...update }
      : host) as [PodcastHostChoice, PodcastHostChoice])
  }

  function selectHostPreset(index: 0 | 1, value: string) {
    if (value === 'custom') {
      updateHost(index, { name: '', customName: true })
      return
    }
    updateHost(index, { name: value, customName: false })
  }

  function selectHostGender(index: 0 | 1, gender: PodcastHostGender) {
    const host = hosts[index]
    updateHost(index, {
      gender,
      ...(!host.customName ? { name: PODCAST_HOST_PRESETS[gender][0] } : {}),
    })
  }

  async function playPodcast(podcast: SpeakiaPodcast) {
    setError('')
    setNotice('')
    setSelectedId(podcast.id)
    const mode = podcast.playbackMode ?? 'recorded'
    if (livePodcast.state !== 'idle') {
      if (livePodcast.podcastId === podcast.id && livePodcast.state !== 'saving') {
        livePodcast.stop()
        return
      }
      setError('Finish the live podcast that is currently in progress before opening another episode.')
      return
    }
    if (loadingAudio) return
    if (mode === 'live' && !podcast.liveAudioAvailable) {
      setError('This live episode does not have a saved audio recording yet.')
      return
    }
    if (playingId === podcast.id) {
      const player = audioRef.current
      if (!player) return
      if (player.paused) {
        try {
          await player.play()
        } catch (caughtError) {
          console.error('Unable to resume Speakia AI-generated podcast audio.', caughtError)
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
    if (audioSource?.podcastId === podcast.id && audioSource.mode === mode && audioRef.current) {
      const player = audioRef.current
      if (player.ended) player.currentTime = 0
      try {
        await player.play()
        setPlayingId(podcast.id)
        setIsPaused(false)
      } catch (caughtError) {
        console.error('Unable to play saved Speakia AI podcast audio.', caughtError)
        setError('Unable to start playback. Use the audio player controls or try again.')
      }
      return
    }
    setLoadingAudio(true)
    audioRef.current?.pause()
    setPlayingId(null)
    setIsPaused(false)
    try {
      let audio = await loadPodcastAudio(podcast.id, mode)
      if (!audio && mode === 'recorded') {
        setNotice('Generating Speakia AI podcast audio for this archived episode…')
        const playbackModel = podcast.speechModel ?? speechModel
        const useStreaming = podcast.streaming ?? streaming
        audio = await synthesizePodcastAudio(apiKey, podcast.turns, playbackModel, useStreaming, podcastHosts(podcast), podcast.language ?? 'English', brandName)
        await savePodcastAudio(podcast.id, audio)
        const nextPodcasts = podcasts.map((episode) => episode.id === podcast.id
          ? { ...episode, audioAvailable: true, speechModel: playbackModel, streaming: useStreaming }
          : episode)
        setPodcasts(nextPodcasts)
        podcastsRef.current = nextPodcasts
        if (!savePodcasts(username, nextPodcasts, product)) {
          setNotice(`${brandName} audio was generated, but the archive metadata could not be updated.`)
        } else {
          setNotice(`${brandName} audio is ready and saved for future playback.`)
        }
      }
      if (!audio) throw new Error('The saved podcast audio is not available for this episode.')
      if (audioSource?.url) URL.revokeObjectURL(audioSource.url)
      const url = URL.createObjectURL(audio)
      setAudioSource({ podcastId: podcast.id, url, mode })
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
          console.error('Unable to play saved Speakia podcast audio.', caughtError)
          setNotice('Audio is ready. Press Play in the audio player to listen.')
        })
      })
    } catch (caughtError) {
      console.error('Unable to load or generate archived Speakia podcast audio.', caughtError)
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

  function selectPodcast(podcast: SpeakiaPodcast) {
    if (playingId && playingId !== podcast.id) {
      audioRef.current?.pause()
      if (audioRef.current) audioRef.current.currentTime = 0
      setPlayingId(null)
      setIsPaused(false)
    }
    setSelectedId(podcast.id)
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
    const selectedHosts = hosts.map(({ name, gender }) => ({ name: name.trim().slice(0, 40), gender })) as [PodcastHost, PodcastHost]
    if (selectedHosts.some((host) => !host.name)) {
      setError('Enter a name for both podcast hosts or choose a preset name.')
      return
    }
    if (selectedHosts[0].name.toLocaleLowerCase() === selectedHosts[1].name.toLocaleLowerCase()) {
      setError('Choose two different names for your podcast hosts.')
      return
    }
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
        summary: `An unscripted, real-time ${brandName} podcast between ${selectedHosts[0].name} and ${selectedHosts[1].name} about ${normalizedTopic}.`,
        turns: [],
        hosts: selectedHosts,
        language,
        playbackMode: 'live',
        liveAudioAvailable: false,
      }
      const nextPodcasts = [liveEpisode, ...podcastsRef.current]
      if (!savePodcasts(username, nextPodcasts, product)) {
        setError('The live episode could not be added to your archive. Check browser storage space and permissions.')
        return
      }
      podcastsRef.current = nextPodcasts
      setPodcasts(nextPodcasts)
      setSelectedId(liveEpisode.id)
      setCustomTopic('')
      setNotice(`Connecting ${selectedHosts[0].name} and ${selectedHosts[1].name} now. Your unscripted live episode will begin as soon as both hosts are ready.`)
      const liveLearnerContext = product === 'writia'
        ? JSON.stringify({
          learner: { writingTargetBand: profile.writingTargetBand || null, writingTestDate: profile.writingTestDate || null, writingStudyGoal: profile.writingStudyGoal || null },
          recentWritingAssessments: writingAssessments.slice(0, 5).map(({ taskLabel, overallBand, summary, priority, criteria }) => ({ taskLabel, overallBand, summary, priority, criteria })),
        })
        : JSON.stringify({ recentSpeakingAssessments: results.slice(0, 5).map(({ title, overallBand, nextSteps }) => ({ title, overallBand, nextSteps })) })
      await livePodcast.start(normalizedTopic, language, liveEpisode.id, apiKey, selectedHosts, product, liveLearnerContext, turnCount)
      return
    }
    setGenerating(true)
    try {
      const generated = product === 'writia'
        ? await generateWritiaPodcast(
          apiKey,
          selectedTopic,
          {
            profile,
            assessments: writingAssessments,
            assignments: writingAssignments,
          },
          scriptModel,
          speechModel,
          language,
          streaming,
          selectedHosts,
          turnCount,
        )
        : await generateSpeakiaPodcast(
          apiKey,
          selectedTopic,
          { profile, results, lexicalEntries, assignments, coachActivity: readCoachActivity() },
          scriptModel,
          speechModel,
          language,
          streaming,
          selectedHosts,
          turnCount,
        )
      const { audio, ...podcast } = generated
      let audioAvailable = false
      if (audio) {
        try {
          await savePodcastAudio(podcast.id, audio, 'recorded')
          audioAvailable = true
        } catch (caughtError) {
          console.error(`${brandName} podcast script generated, but audio could not be archived.`, caughtError)
        }
      }
      const savedPodcast = { ...podcast, audioAvailable }
      const nextPodcasts = [savedPodcast, ...podcasts]
      if (!savePodcasts(username, nextPodcasts, product)) {
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
        ? `Your ${brandName} AI-voiced episode is ready and saved in your archive.`
        : `Your transcript is archived; ${brandName} AI audio could not be saved and can be retried from the archive.`)
      setCustomTopic('')
    } catch (caughtError) {
      console.error(`Unable to create a ${brandName} podcast episode.`, caughtError)
      setError(caughtError instanceof Error ? caughtError.message : `${brandName} could not create this episode. Please try again.`)
    } finally {
      setGenerating(false)
    }
  }

  async function removeEpisode(podcastId: string) {
    const nextPodcasts = podcasts.filter((podcast) => podcast.id !== podcastId)
    if (!savePodcasts(username, nextPodcasts, product)) {
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
          <h1>{brandName} Podcasts</h1>
          <p className="page-subtitle">{product === 'writia'
            ? 'Personalized audio lessons turn your writing evidence and goals into a practical coaching conversation and improvement plan.'
            : 'Two AI co-hosts turn your learning progress and IELTS goals into a helpful, listenable conversation.'}</p>
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
              <p>Choose a topic, two co-hosts, and how you would like to hear your episode.</p>
            </div>
          </summary>
          <div className="podcast-create-content">
          <form className="podcast-create-form" onSubmit={(event) => void createEpisode(event)}>
            <label htmlFor="podcast-topic">Choose a starting point</label>
            <div className="podcast-topic-row">
              <select id="podcast-topic" value={topic} onChange={(event) => setTopic(event.target.value)}>
                {topics.map((item) => <option key={item}>{item}</option>)}
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
                <span><strong>Live podcast</strong><small>Two {brandName} hosts start an unscripted conversation immediately. No script generation and no microphone.</small></span>
              </label>
              <label className={playbackMode === 'recorded' ? 'podcast-playback-choice-active' : ''}>
                <input type="radio" name="podcast-playback-mode" value="recorded" checked={playbackMode === 'recorded'} onChange={() => setPlaybackMode('recorded')} disabled={livePodcast.state !== 'idle'} />
                <span className="podcast-playback-choice-icon"><Headphones size={17} /></span>
                <span><strong>Recorded podcast</strong><small>Generate a ready-to-replay, two-voice recording with {brandName} voice.</small></span>
              </label>
            </fieldset>
            <fieldset className="podcast-host-settings" disabled={generating || livePodcast.state !== 'idle'}>
              <legend>Choose your podcast hosts</legend>
              <p>Pick from Pakistani women’s and men’s names, or enter a custom name for either host.</p>
              <div className="podcast-host-settings-grid">
                {hosts.map((host, index) => {
                  const hostIndex = index as 0 | 1
                  const hostNumber = index + 1
                  const presets = PODCAST_HOST_PRESETS[host.gender]
                  const isPreset = presets.includes(host.name)
                  return <div className="podcast-host-settings-card" key={`podcast-host-${hostNumber}`}>
                    <strong>Host {hostNumber}</strong>
                    <label htmlFor={`podcast-host-${hostNumber}-gender`}>Voice
                      <select id={`podcast-host-${hostNumber}-gender`} value={host.gender} onChange={(event) => {
                        if (event.target.value === 'female' || event.target.value === 'male') selectHostGender(hostIndex, event.target.value)
                      }}>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                      </select>
                    </label>
                    <label htmlFor={`podcast-host-${hostNumber}-preset`}>Name
                      <select id={`podcast-host-${hostNumber}-preset`} value={host.customName || !isPreset ? 'custom' : host.name} onChange={(event) => selectHostPreset(hostIndex, event.target.value)}>
                        {presets.map((name) => <option key={name} value={name}>{name}</option>)}
                        <option value="custom">Custom name…</option>
                      </select>
                    </label>
                    {(host.customName || !isPreset) && <label htmlFor={`podcast-host-${hostNumber}-custom`} className="podcast-host-custom-label">Custom host name
                      <input id={`podcast-host-${hostNumber}-custom`} value={host.name} onChange={(event) => updateHost(hostIndex, { name: event.target.value.slice(0, 40), customName: true })} maxLength={40} placeholder={`Enter Host ${hostNumber}'s name`} required />
                    </label>}
                  </div>
                })}
              </div>
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
              <label htmlFor="podcast-turn-count">
                Number of host turns
                <select
                  id="podcast-turn-count"
                  value={turnCount}
                  onChange={(event) => {
                    const selected = PODCAST_TURN_COUNTS.find((count) => count === Number(event.target.value))
                    if (selected !== undefined) setTurnCount(selected)
                  }}
                  disabled={generating}
                >
                  {PODCAST_TURN_COUNTS.map((count) => <option key={count} value={count}>{count} turns{count === DEFAULT_PODCAST_TURN_COUNT ? ' · default' : ''}</option>)}
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
                  {PODCAST_SCRIPT_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label.replace(/^Speakia/, brandName)}</option>)}
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
                  {PODCAST_TTS_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label.replace(/^Speakia/, brandName)}</option>)}
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
            <p className="podcast-form-hint">{PODCAST_LANGUAGES.find((option) => option.id === language)?.description} {playbackMode === 'live' ? `${hosts[0].name || 'Host 1'} and ${hosts[1].name || 'Host 2'} connect directly to ${brandName} Live and start talking about your topic without a generated script. No microphone is needed.` : streaming ? 'Streaming mode requests headerless 24 kHz PCM chunks and packages them as WAV for playback and archiving.' : `${brandName} voice generates a complete two-voice WAV recording for playback and archiving.`} {playbackMode === 'recorded' ? 'A podcast script is generated before recording.' : 'The topic, host names, language, and relevant learner context are sent to the live hosts.'} The selected episode will contain {turnCount} host turns. Podcasts are archived in this browser.</p>
            {!apiKey.trim() && <p className="podcast-form-hint">Add your shared AI key in Settings to create a personalized episode.</p>}
            {product === 'writia' && writingAssessments.length === 0 && <p className="podcast-form-hint">No saved writing assessments yet. Your first episode will focus on your writing goals, useful Writia workflows, and general IELTS Writing guidance.</p>}
            {product === 'speakia' && results.length === 0 && <p className="podcast-form-hint">No saved practice assessments yet. Your first episode will focus on Speakia resources and general IELTS guidance.</p>}
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
              <span className={`podcast-host-avatar podcast-host-aisha ${livePodcast.activeSpeaker === selectedPodcastHosts[0].name ? 'podcast-host-speaking' : ''}`} title={selectedPodcastHosts[0].name}>{selectedPodcastHosts[0].name.slice(0, 1).toLocaleUpperCase()}</span>
              <span className={`podcast-host-avatar podcast-host-noah ${livePodcast.activeSpeaker === selectedPodcastHosts[1].name ? 'podcast-host-speaking' : ''}`} title={selectedPodcastHosts[1].name}>{selectedPodcastHosts[1].name.slice(0, 1).toLocaleUpperCase()}</span>
              <div className="podcast-player-description"><span>{selectedPodcastHosts[0].name.toLocaleUpperCase()} &amp; {selectedPodcastHosts[1].name.toLocaleUpperCase()} · YOUR {brandName.toLocaleUpperCase()} CO-HOSTS</span><strong>{selectedPodcast.topic}</strong><p>{selectedPodcast.summary}</p></div>
              <div className="podcast-player-controls">
                <button className="podcast-play-button" aria-label={loadingAudio || livePodcast.state === 'connecting' ? 'Preparing podcast playback' : livePodcast.state === 'live' ? 'Stop live podcast' : playingId === selectedPodcast.id ? (isPaused ? 'Resume podcast' : 'Pause podcast') : selectedPodcast.playbackMode === 'live' ? (selectedPodcast.liveAudioAvailable ? 'Play saved live podcast' : 'Start live podcast') : 'Play recorded podcast'} title={loadingAudio || livePodcast.state === 'connecting' ? 'Preparing podcast playback' : livePodcast.state === 'live' ? 'Stop live podcast' : playingId === selectedPodcast.id ? (isPaused ? 'Resume podcast' : 'Pause podcast') : selectedPodcast.playbackMode === 'live' ? (selectedPodcast.liveAudioAvailable ? 'Play saved live podcast' : 'Start live podcast') : 'Play recorded podcast'} disabled={loadingAudio || livePodcast.state === 'saving'} onClick={() => void playPodcast(selectedPodcast)}>
                  {loadingAudio || livePodcast.state === 'connecting' || livePodcast.state === 'saving' ? <LoaderCircle className="podcast-spin" size={18} /> : livePodcast.state === 'live' ? <Square size={16} fill="currentColor" /> : playingId === selectedPodcast.id && !isPaused ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                {playingId === selectedPodcast.id && <button className="podcast-stop-button" aria-label="Stop podcast" title="Stop episode" onClick={stopPlayback}><Square size={15} fill="currentColor" /></button>}
              </div>
            </div>
            {(selectedPodcast.playbackMode ?? 'recorded') === 'live' && (
              <div className="podcast-live-controls">
                <span className={`podcast-live-badge ${livePodcast.state === 'live' ? 'podcast-live-badge-active' : ''}`}><i />{livePodcast.state === 'connecting' ? 'CONNECTING LIVE HOSTS' : livePodcast.state === 'saving' ? 'SAVING LIVE CAPTURE' : livePodcast.state === 'live' ? 'LIVE ON AIR' : `${brandName.toLocaleUpperCase()} LIVE PODCAST`}</span>
                {livePodcast.state !== 'idle' && <span className="podcast-live-meta"><Clock3 size={13} /> {Math.floor(livePodcast.elapsedSeconds / 60)}:{String(livePodcast.elapsedSeconds % 60).padStart(2, '0')} · {livePodcast.activeSpeaker ? `${livePodcast.activeSpeaker} speaking` : 'Next host preparing'} · {Math.max(0, livePodcast.turnIndex + 1)} / {livePodcast.totalTurns} turns</span>}
                {livePodcast.error && <p className="podcast-alert podcast-alert-error" role="alert">{livePodcast.error}</p>}
              </div>
            )}
            <audio
              ref={audioRef}
              className={`podcast-audio ${selectedPodcast.playbackMode === 'live' && (audioSource?.podcastId !== selectedPodcast.id || audioSource.mode !== 'live') ? 'podcast-audio-hidden' : ''}`}
              controls
              preload="metadata"
              src={audioSource?.podcastId === selectedPodcast.id && audioSource.mode === (selectedPodcast.playbackMode ?? 'recorded') ? audioSource.url : undefined}
              aria-label={`${audioSource?.podcastId === selectedPodcast.id && audioSource.mode === 'live' ? 'Saved live' : 'Speakia AI-generated'} podcast audio: ${selectedPodcast.title}`}
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
                  setError(`The archived ${brandName} audio could not be played. Try generating audio again from this episode.`)
                  setPlayingId(null)
                  setIsPaused(false)
                }
              }}
            />
            {(selectedPodcast.playbackMode ?? 'recorded') === 'recorded'
              ? <p className="podcast-playback-note"><Volume2 size={13} />Speech: {PODCAST_TTS_MODELS.find((model) => model.id === selectedPodcast.speechModel)?.label.replace(/^Speakia/, brandName) ?? 'model not recorded for this older episode'} · Script: {PODCAST_SCRIPT_MODELS.find((model) => model.id === selectedPodcast.scriptModel)?.label.replace(/^Speakia/, brandName) ?? 'model not recorded'} · Two distinct voices. Audio is archived for replay.</p>
              : <p className="podcast-playback-note"><Radio size={13} />Unscripted live conversation · {brandName} Live · {selectedPodcast.language ?? 'English'} · No microphone needed.</p>}
            {selectedPodcast.playbackMode !== 'live' && !selectedPodcast.audioAvailable && <p className="podcast-form-hint">{brandName} audio is not yet saved for this episode. Press Play to generate and archive it now.</p>}
            {((selectedPodcast.playbackMode ?? 'recorded') === 'live' ? selectedPodcast.liveAudioAvailable : selectedPodcast.audioAvailable) && <div className="podcast-coach-share"><Button type="button" variant="outline" size="sm" disabled={sharingPodcastAudio} onClick={() => void sharePodcastWithCoach(selectedPodcast)}>{sharingPodcastAudio ? <LoaderCircle className="podcast-spin" size={14} /> : <MessageCircle size={14} />} {sharingPodcastAudio ? 'Preparing audio…' : `Ask ${brandName}`}</Button><span>{brandName} Coach will listen to this episode in a live conversation.</span></div>}
            {playingId === selectedPodcast.id && <div className="podcast-progress" role="status"><span style={{ width: `${Math.min(100, Math.round(playbackTime / Math.max(playbackDuration, 1) * 100))}%` }} /><small>{formatDuration(Math.max(0, playbackDuration - playbackTime))} remaining</small></div>}
          </Card>
          <div className="podcast-transcript" ref={podcastTranscriptRef}>
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
                  ? wordIndexAtElapsed(turn.text, livePodcast.speechElapsedSeconds, turn.audioDurationSeconds)
                  : playbackPosition?.turnIndex === index ? playbackPosition.wordIndex : -1
                return (
                  <article className={`podcast-turn podcast-turn-${index % 2 === 0 ? 'host-one' : 'host-two'} ${liveActive || playbackPosition?.turnIndex === index ? 'podcast-turn-active' : ''}`} key={`${selectedPodcast.id}-${index}`}>
                    <span className="podcast-turn-avatar">{turn.speaker.slice(0, 1).toLocaleUpperCase()}</span>
                    <div><strong>{turn.speaker}</strong><p><SpeechHighlight text={turn.text} wordIndex={activeWordIndex} search={transcriptMatchPodcast?.id === selectedPodcast.id ? query : ''} focusSearchMatch={transcriptMatchPodcast?.id === selectedPodcast.id} /></p></div>
                  </article>
                )
              })
              : <p className="podcast-form-hint">{livePodcast.state === 'connecting' ? 'The hosts will speak here when the live connection is ready.' : `Start the live episode to listen to ${selectedPodcastHosts[0].name} and ${selectedPodcastHosts[1].name} improvise a conversation around this topic.`}</p>}
          </div>
        </section>
      )}

      <section className="podcast-archive-section" aria-label="Podcast archive">
        <div className="podcast-section-heading">
          <div><p className="eyebrow">YOUR LISTENING LIBRARY</p><h2>Podcast archive</h2></div>
          {podcasts.length > 0 && <label className="podcast-search"><Search size={15} /><input value={query} onChange={(event) => {
            const nextQuery = event.target.value
            const terms = nextQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
            setQuery(nextQuery)
            if (!terms.length) return
            const match = podcasts.find((podcast) => {
              const transcript = podcast.turns.map((turn) => turn.text).join(' ').toLocaleLowerCase()
              return (archiveModeFilter === 'all' || (podcast.playbackMode ?? 'recorded') === archiveModeFilter)
                && terms.every((term) => transcript.includes(term))
            })
            if (match) setSelectedId(match.id)
          }} placeholder="Search episodes" aria-label="Search podcast archive" /></label>}
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
                <button className="podcast-archive-copy" disabled={livePodcast.state !== 'idle'} onClick={() => selectPodcast(podcast)}>
                  <strong>{podcast.title}</strong><span>{podcast.topic}</span><small><i className={`podcast-archive-mode-icon ${podcast.playbackMode === 'live' ? 'podcast-archive-mode-live' : ''}`}>{podcast.playbackMode === 'live' ? 'LIVE' : 'RECORDED'}</i> · {formatEpisodeDate(podcast.createdAt)} · {podcast.durationSeconds ? `${formatDuration(podcast.durationSeconds)} · ` : ''}{podcast.turns.length} dialogue turns</small>
                </button>
                <button className="podcast-archive-play" aria-label={`Play ${podcast.playbackMode === 'live' ? 'saved live recording of ' : ''}${podcast.title}`} title={`Play ${podcast.playbackMode === 'live' ? 'saved live recording' : 'recorded episode'}`} disabled={livePodcast.state !== 'idle' && (livePodcast.state === 'saving' || podcast.id !== selectedPodcast?.id)} onClick={() => { setSelectedId(podcast.id); void playPodcast(podcast) }}>
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
