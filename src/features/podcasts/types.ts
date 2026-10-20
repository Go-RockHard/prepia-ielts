export interface PodcastTurn {
  speaker: 'Aisha' | 'Noah'
  text: string
  audioStartSeconds?: number
  audioDurationSeconds?: number
}

export const PODCAST_SCRIPT_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },

  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
] as const

export type PodcastScriptModel = typeof PODCAST_SCRIPT_MODELS[number]['id']

export const PODCAST_TTS_MODELS = [
  { id: 'gemini-3.8-flash-tts', label: 'Gemini 3.8 Flash TTS' },
  { id: 'gemini-3.8-flash-lite-tts', label: 'Gemini 3.8 Flash TTS Lite' },
] as const

export type PodcastTtsModel = typeof PODCAST_TTS_MODELS[number]['id']

export const PODCAST_LANGUAGES = [
  { id: 'English', label: 'English', description: 'A complete episode in English.' },
  { id: 'Urdu', label: 'Urdu', description: 'A complete episode in Urdu.' },
  { id: 'Punjabi', label: 'Punjabi', description: 'A complete episode in Punjabi.' },
  { id: 'Code Switching', label: 'Code Switching', description: 'Naturally blend English, Urdu, and Punjabi throughout.' },
] as const

export type PodcastLanguage = typeof PODCAST_LANGUAGES[number]['id']
export type PodcastPlaybackMode = 'recorded' | 'live'

export interface SpeakiaPodcast {
  id: string
  title: string
  topic: string
  createdAt: string
  durationSeconds: number
  summary: string
  turns: PodcastTurn[]
  scriptModel?: PodcastScriptModel
  speechModel?: PodcastTtsModel
  language?: PodcastLanguage
  streaming?: boolean
  playbackMode?: PodcastPlaybackMode
  audioAvailable?: boolean
  liveAudioAvailable?: boolean
}
