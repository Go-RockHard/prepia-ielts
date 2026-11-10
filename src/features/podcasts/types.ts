export interface PodcastTurn {
  speaker: string
  text: string
  audioStartSeconds?: number
  audioDurationSeconds?: number
}

export type PodcastHostGender = 'female' | 'male'

export interface PodcastHost {
  name: string
  gender: PodcastHostGender
}

export const PODCAST_HOST_PRESETS: Record<PodcastHostGender, string[]> = {
  female: ['Aisha', 'Zoya', 'Hania', 'Mahnoor', 'Sana', 'Maryam', 'Iqra', 'Fatima'],
  male: ['Hamza', 'Zain', 'Ahmed', 'Ali', 'Hassan', 'Umar', 'Bilal', 'Ibrahim'],
}

export const PODCAST_SCRIPT_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Prodia Core · balanced script generation' },
  { id: 'gemini-3.6-flash', label: 'Prodia Podcast Balanced · balanced script generation' },
  { id: 'gemini-3.5-flash-lite', label: 'Prodia Swift · efficient script generation' },
] as const

export type PodcastScriptModel = typeof PODCAST_SCRIPT_MODELS[number]['id']

export const PODCAST_TTS_MODELS = [
  { id: 'gemini-3.8-flash-tts', label: 'Prodia Voice' },
  { id: 'gemini-3.8-flash-lite-tts', label: 'Prodia Voice Compact' },
] as const

export type PodcastTtsModel = typeof PODCAST_TTS_MODELS[number]['id']

export const PODCAST_LANGUAGES = [
  { id: 'English', label: 'English', description: 'A complete episode in English.' },
  { id: 'Urdu', label: 'Urdu (Pakistan)', description: 'A complete episode in natural Pakistani Urdu.' },
  { id: 'Punjabi', label: 'Punjabi (Pakistan)', description: 'A complete episode in natural Pakistani Punjabi.' },
  { id: 'Code Switching', label: 'Code Switching (Pakistan)', description: 'Naturally blend English, Pakistani Urdu, and Pakistani Punjabi throughout.' },
] as const

export type PodcastLanguage = typeof PODCAST_LANGUAGES[number]['id']
export type PodcastPlaybackMode = 'recorded' | 'live'
export type PodcastProduct = 'speakia' | 'writia'
export const PODCAST_TURN_COUNTS = [8, 10, 12, 14, 16, 18] as const
export const DEFAULT_PODCAST_TURN_COUNT = 12

export interface PodcastWritingAssessment {
  id: string
  taskLabel: string
  overallBand: number
  createdAt: number
  summary: string
  priority: string
  mode?: 'guided' | 'exam'
  wordCount: number
  criteria: Array<{ label: string; band: number; evidence: string; nextStep: string }>
}

export interface SpeakiaPodcast {
  id: string
  title: string
  topic: string
  createdAt: string
  durationSeconds: number
  summary: string
  turns: PodcastTurn[]
  hosts?: [PodcastHost, PodcastHost]
  scriptModel?: PodcastScriptModel
  speechModel?: PodcastTtsModel
  language?: PodcastLanguage
  streaming?: boolean
  playbackMode?: PodcastPlaybackMode
  audioAvailable?: boolean
  liveAudioAvailable?: boolean
}
