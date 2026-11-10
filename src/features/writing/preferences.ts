import { DEFAULT_GEMINI_LIVE_VOICE, type GeminiLiveVoice } from '@/features/assistant/models'

export type WritiaCoachLanguage = 'English' | 'Urdu' | 'Pakistani Punjabi' | 'Mixed Code'

export const WRITIA_COACH_LANGUAGES: WritiaCoachLanguage[] = ['English', 'Urdu', 'Pakistani Punjabi', 'Mixed Code']
export const WRITIA_COACH_LANGUAGE_KEY = 'writia-coach-language-v1'
export const WRITIA_COACH_VOICE_KEY = 'writia-coach-live-voice-v1'
export const WRITIA_COACH_TEXT_MODEL_KEY = 'writia-coach-text-model-v1'
export const WRITIA_REALTIME_SCAFFOLD_KEY = 'writia-realtime-scaffold-v1'
export const WRITIA_ASSESSMENT_MODEL_KEY = 'writia-assessment-model-v1'
export const DEFAULT_WRITIA_LIVE_VOICE: GeminiLiveVoice = DEFAULT_GEMINI_LIVE_VOICE
