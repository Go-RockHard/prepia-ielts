import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import {
  GEMINI_LIVE_MODELS,
  GEMINI_TEXT_MODELS,
  PRODIA_LIVE_MODEL_PREFERENCE_KEY,
  PRODIA_TEXT_MODEL_PREFERENCE_KEY,
  getProdiaLiveModel,
  getProdiaTextModel,
  saveProdiaLiveModel,
  saveProdiaTextModel,
  type GeminiTextModel,
  type ProdiaLiveModel,
} from '@/lib/geminiModels'

export function ProdiaModelPicker() {
  const [textModel, setTextModel] = useState<GeminiTextModel>(getProdiaTextModel)
  const [liveModel, setLiveModel] = useState<ProdiaLiveModel>(getProdiaLiveModel)
  const [error, setError] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const syncModel = (event: StorageEvent) => {
      if (event.key === PRODIA_TEXT_MODEL_PREFERENCE_KEY) setTextModel(getProdiaTextModel())
      if (event.key === PRODIA_LIVE_MODEL_PREFERENCE_KEY) setLiveModel(getProdiaLiveModel())
    }
    window.addEventListener('storage', syncModel)
    return () => {
      window.removeEventListener('storage', syncModel)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) setIsOpen(false)
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        pickerRef.current?.querySelector<HTMLButtonElement>('.prodia-model-picker-trigger')?.focus()
      }
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [isOpen])

  function changeTextModel(value: string) {
    const selected = GEMINI_TEXT_MODELS.find((candidate) => candidate.id === value)
    if (!selected) return
    try {
      saveProdiaTextModel(selected.id)
      setTextModel(selected.id)
      setError('')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save the Prodia text model preference.')
    }
  }

  function changeLiveModel(value: string) {
    const selected = GEMINI_LIVE_MODELS.find((candidate) => candidate.id === value)
    if (!selected) return
    try {
      saveProdiaLiveModel(selected.id)
      setLiveModel(selected.id)
      setError('')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save the Prodia Live model preference.')
    }
  }

  return (
    <div className="prodia-model-picker" ref={pickerRef}>
      <button type="button" className="prodia-model-picker-trigger" aria-expanded={isOpen} aria-haspopup="true" onClick={() => setIsOpen((open) => !open)}><Sparkles size={14} /><span>Prodia IELTS Intelligence</span></button>
      {isOpen && <div className="prodia-model-menu">
          <label htmlFor="prodia-text-model">Text and assessment intelligence<select id="prodia-text-model" aria-label="Default Prodia text intelligence for features without a dedicated selector" value={textModel} onChange={(event) => changeTextModel(event.target.value)}>
            {GEMINI_TEXT_MODELS.map((option) => <option key={option.id} value={option.id}>{option.label} · {option.description}</option>)}
          </select></label>
          <label htmlFor="prodia-live-model">Realtime voice intelligence<select id="prodia-live-model" aria-label="Default Prodia Live intelligence for realtime voice sessions" value={liveModel} onChange={(event) => changeLiveModel(event.target.value)}>
            {GEMINI_LIVE_MODELS.map((option) => <option key={option.id} value={option.id}>{option.label} · {option.description}</option>)}
          </select></label>
          <small>Defaults apply to workflows without their own selector. Prodia intelligence is powered by Google Gemini.</small>
          {error && <span className="prodia-model-error" role="status">{error}</span>}
        </div>}
    </div>
  )
}
