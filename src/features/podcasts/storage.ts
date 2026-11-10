import { PODCAST_LANGUAGES, PODCAST_SCRIPT_MODELS, PODCAST_TTS_MODELS, type PodcastProduct, type SpeakiaPodcast } from './types'

const STORAGE_KEY_PREFIX = 'speakia-podcasts-v1:'

function isPodcast(value: unknown): value is SpeakiaPodcast {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const podcast = value as Partial<SpeakiaPodcast>
  return typeof podcast.id === 'string'
    && typeof podcast.title === 'string'
    && typeof podcast.topic === 'string'
    && typeof podcast.createdAt === 'string'
    && Number.isFinite(Date.parse(podcast.createdAt))
    && typeof podcast.durationSeconds === 'number'
    && Number.isFinite(podcast.durationSeconds)
    && podcast.durationSeconds >= 0
    && typeof podcast.summary === 'string'
    && (podcast.scriptModel === undefined || PODCAST_SCRIPT_MODELS.some((model) => model.id === podcast.scriptModel))
    && (podcast.speechModel === undefined || PODCAST_TTS_MODELS.some((model) => model.id === podcast.speechModel))
    && (podcast.language === undefined || PODCAST_LANGUAGES.some((language) => language.id === podcast.language))
    && (podcast.streaming === undefined || typeof podcast.streaming === 'boolean')
    && (podcast.playbackMode === undefined || podcast.playbackMode === 'recorded' || podcast.playbackMode === 'live')
    && (podcast.audioAvailable === undefined || typeof podcast.audioAvailable === 'boolean')
    && (podcast.liveAudioAvailable === undefined || typeof podcast.liveAudioAvailable === 'boolean')
    && (podcast.hosts === undefined || (
      Array.isArray(podcast.hosts)
      && podcast.hosts.length === 2
      && podcast.hosts.every((host) => typeof host === 'object'
        && host !== null
        && typeof host.name === 'string'
        && host.name.trim().length > 0
        && host.name.length <= 40
        && (host.gender === 'female' || host.gender === 'male'))
    ))
    && Array.isArray(podcast.turns)
    && (podcast.turns.length >= 4 || (podcast.playbackMode === 'live' && podcast.turns.length === 0))
    && podcast.turns.every((turn) => typeof turn === 'object'
      && turn !== null
      && typeof turn.speaker === 'string'
      && turn.speaker.trim().length > 0
      && turn.speaker.length <= 40
      && typeof turn.text === 'string')
}

function storageKey(username: string, product: PodcastProduct): string {
  return `${product}-podcasts-v1:${username.trim().toLocaleLowerCase()}`
}

export function loadPodcasts(username: string, product: PodcastProduct = 'speakia'): SpeakiaPodcast[] {
  try {
    const stored = localStorage.getItem(product === 'speakia' ? `${STORAGE_KEY_PREFIX}${username.trim().toLocaleLowerCase()}` : storageKey(username, product))
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) throw new Error('Saved Speakia Podcasts archive is not a list.')
    const valid = parsed.filter(isPodcast)
    if (valid.length !== parsed.length) {
      console.warn(`${parsed.length - valid.length} invalid podcast archive item(s) were ignored.`)
    }
    return valid.sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
  } catch (error) {
    console.error('Unable to load the Speakia Podcasts archive.', error)
    return []
  }
}

export function savePodcasts(username: string, podcasts: SpeakiaPodcast[], product: PodcastProduct = 'speakia'): boolean {
  try {
    localStorage.setItem(product === 'speakia' ? `${STORAGE_KEY_PREFIX}${username.trim().toLocaleLowerCase()}` : storageKey(username, product), JSON.stringify(podcasts))
    return true
  } catch (error) {
    console.error('Unable to save the Speakia Podcasts archive.', error)
    return false
  }
}
