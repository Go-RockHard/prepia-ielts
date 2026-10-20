export const ASSISTANT_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
] as const

export type AssistantModel = typeof ASSISTANT_MODELS[number]['id']

export const DEFAULT_ASSISTANT_CHAT_MODEL: AssistantModel = 'gemini-3.8-flash'
export const DEFAULT_ASSISTANT_TOOL_MODEL: AssistantModel = 'gemini-3.8-flash'

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
