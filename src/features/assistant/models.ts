import { DEFAULT_LIGHTWEIGHT_TEXT_MODEL, GEMINI_TEXT_MODELS, type GeminiTextModel } from '@/lib/geminiModels'

export const ASSISTANT_MODELS = GEMINI_TEXT_MODELS

export type AssistantModel = GeminiTextModel

export const DEFAULT_ASSISTANT_CHAT_MODEL: AssistantModel = 'gemini-3.8-flash'
export const DEFAULT_ASSISTANT_TOOL_MODEL: AssistantModel = 'gemini-3.8-flash'
export const DEFAULT_TEMPLATE_GENERATION_MODEL = DEFAULT_LIGHTWEIGHT_TEXT_MODEL

export const GEMINI_LIVE_VOICES = [
  { id: 'Aoede', label: 'Aoede · expressive' },
  { id: 'Kore', label: 'Kore · warm' },
  { id: 'Leda', label: 'Leda · gentle' },
  { id: 'Puck', label: 'Puck · upbeat' },
  { id: 'Charon', label: 'Charon · informative' },
  { id: 'Fenrir', label: 'Fenrir · energetic' },
  { id: 'Orus', label: 'Orus · confident' },
  { id: 'Zephyr', label: 'Zephyr · bright' },
] as const

export type GeminiLiveVoice = typeof GEMINI_LIVE_VOICES[number]['id']
export const DEFAULT_GEMINI_LIVE_VOICE: GeminiLiveVoice = 'Aoede'
