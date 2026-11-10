export const GEMINI_TEXT_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Prodia Core', description: 'Balanced intelligence for everyday learning and feedback.' },
  { id: 'gemini-3.1-pro-preview', label: 'Prodia Reasoning', description: 'Higher-capability reasoning for complex tasks.' },
  { id: 'gemini-3.5-flash-lite', label: 'Prodia Swift', description: 'Fast, efficient responses for routine tasks.' },
  { id: 'gemini-3.1-flash-lite', label: 'Prodia Compact', description: 'Lightweight choice for concise, focused tasks.' },
] as const

export type GeminiTextModel = typeof GEMINI_TEXT_MODELS[number]['id']

export const PRODIA_TEXT_MODEL_PREFERENCE_KEY = 'prodia.default-text-model'
export const DEFAULT_LIGHTWEIGHT_TEXT_MODEL: GeminiTextModel = 'gemini-3.1-flash-lite'
export const DEFAULT_PRODIA_TEXT_MODEL: GeminiTextModel = 'gemini-3.8-flash'

export const GEMINI_LIVE_MODELS = [
  { id: 'gemini-3.8-live', label: 'Prodia Live', description: 'Realtime voice and multimodal conversations.' },
  { id: 'gemini-3.8-live-extended-thinking', label: 'Prodia Live Reasoning', description: 'Realtime conversations with extended reasoning.' },
] as const

export type ProdiaLiveModel = typeof GEMINI_LIVE_MODELS[number]['id']
export const PRODIA_LIVE_MODEL_PREFERENCE_KEY = 'prodia.default-live-model'
export const DEFAULT_PRODIA_LIVE_MODEL: ProdiaLiveModel = 'gemini-3.8-live'

export function getProdiaTextModel(): GeminiTextModel {
  try {
    const saved = localStorage.getItem(PRODIA_TEXT_MODEL_PREFERENCE_KEY)
    return GEMINI_TEXT_MODELS.find((model) => model.id === saved)?.id ?? DEFAULT_PRODIA_TEXT_MODEL
  } catch (error) {
    console.error('Unable to load the Prodia text model preference.', error)
    return DEFAULT_PRODIA_TEXT_MODEL
  }
}

export function getProdiaLiveModel(defaultModel: ProdiaLiveModel = DEFAULT_PRODIA_LIVE_MODEL): ProdiaLiveModel {
  try {
    const saved = localStorage.getItem(PRODIA_LIVE_MODEL_PREFERENCE_KEY)
    return GEMINI_LIVE_MODELS.find((model) => model.id === saved)?.id ?? defaultModel
  } catch (error) {
    console.error('Unable to load the Prodia Live model preference.', error)
    return defaultModel
  }
}

export function saveProdiaTextModel(model: GeminiTextModel): void {
  if (!GEMINI_TEXT_MODELS.some((candidate) => candidate.id === model)) {
    throw new Error('Choose a supported Prodia text model.')
  }
  try {
    localStorage.setItem(PRODIA_TEXT_MODEL_PREFERENCE_KEY, model)
  } catch (error) {
    console.error('Unable to save the Prodia text model preference.', error)
    throw new Error('The Prodia model preference could not be saved in this browser.')
  }
}

export function saveProdiaLiveModel(model: ProdiaLiveModel): void {
  if (!GEMINI_LIVE_MODELS.some((candidate) => candidate.id === model)) {
    throw new Error('Choose a supported Prodia Live model.')
  }
  try {
    localStorage.setItem(PRODIA_LIVE_MODEL_PREFERENCE_KEY, model)
  } catch (error) {
    console.error('Unable to save the Prodia Live model preference.', error)
    throw new Error('The Prodia Live model preference could not be saved in this browser.')
  }
}

export const GEMINI_TEXT_MODEL_FALLBACKS: Record<GeminiTextModel, readonly GeminiTextModel[]> = {
  'gemini-3.8-flash': ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
  'gemini-3.1-pro-preview': ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  'gemini-3.5-flash-lite': ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.1-pro-preview'],
  'gemini-3.1-flash-lite': ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.1-pro-preview'],
}

export const GEMINI_MODEL_FALLBACKS: Record<string, readonly string[]> = {
  ...GEMINI_TEXT_MODEL_FALLBACKS,
  'gemini-3.6-flash': ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  'gemini-3.8-flash-tts': ['gemini-3.8-flash-lite-tts'],
  'gemini-3.8-flash-lite-tts': ['gemini-3.8-flash-tts'],
}
