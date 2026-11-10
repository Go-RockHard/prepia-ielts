import { useState } from 'react'
import { Eye, EyeOff, KeyRound, LockKeyhole, MessageCircle, Moon, PenLine, Plus, Save, Sparkles, Sun, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ASSESSMENT_MODELS, type AssessmentModel } from '@/features/simulator/gemini'
import { ASSISTANT_MODELS, GEMINI_LIVE_VOICES, type AssistantModel, type GeminiLiveVoice } from '@/features/assistant/models'
import { PromptEngineeringLibrary } from './PromptEngineeringLibrary'
import {
  DEFAULT_WRITIA_LIVE_VOICE,
  WRITIA_ASSESSMENT_MODEL_KEY,
  WRITIA_COACH_LANGUAGE_KEY,
  WRITIA_COACH_LANGUAGES,
  WRITIA_COACH_VOICE_KEY,
  WRITIA_REALTIME_SCAFFOLD_KEY,
  type WritiaCoachLanguage,
} from '@/features/writing/preferences'

function readSetting<T extends string>(key: string, choices: readonly T[], fallback: T): T {
  try {
    const saved = localStorage.getItem(key)
    return choices.find((choice) => choice === saved) ?? fallback
  } catch (error) {
    console.error(`Unable to load setting ${key}.`, error)
    return fallback
  }
}

export function SettingsPage({
  apiKey,
  fallbackApiKeys,
  onSaveApiKeys,
  assessmentModel,
  onAssessmentModelChange,
  assistantChatModel,
  assistantToolModel,
  onAssistantModelChange,
  theme,
  onThemeChange,
}: {
  apiKey: string
  fallbackApiKeys: string[]
  onSaveApiKeys: (primary: string, fallbacks: string[]) => Promise<void>
  assessmentModel: AssessmentModel
  onAssessmentModelChange: (value: AssessmentModel) => void
  assistantChatModel: AssistantModel
  assistantToolModel: AssistantModel
  onAssistantModelChange: (kind: 'chat' | 'tool', value: AssistantModel) => void
  theme: 'light' | 'dark'
  onThemeChange: () => void
}) {
  const [showPromptLibrary, setShowPromptLibrary] = useState(false)
  const [draftKey, setDraftKey] = useState(apiKey)
  const [draftFallbackKeys, setDraftFallbackKeys] = useState(fallbackApiKeys)
  const [fallbackKeysDirty, setFallbackKeysDirty] = useState(false)
  const [keyDirty, setKeyDirty] = useState(false)
  const [keyVisible, setKeyVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(true)
  const [saving, setSaving] = useState(false)
  const [writiaLanguage, setWritiaLanguage] = useState<WritiaCoachLanguage>(() => readSetting(WRITIA_COACH_LANGUAGE_KEY, WRITIA_COACH_LANGUAGES, 'English'))
  const [writiaVoice, setWritiaVoice] = useState<GeminiLiveVoice>(() => readSetting(WRITIA_COACH_VOICE_KEY, GEMINI_LIVE_VOICES.map((voice) => voice.id), DEFAULT_WRITIA_LIVE_VOICE))
  const [writiaAssessmentModel, setWritiaAssessmentModel] = useState<AssessmentModel>(() => readSetting(WRITIA_ASSESSMENT_MODEL_KEY, ASSESSMENT_MODELS.map((model) => model.id), 'gemini-3.8-flash'))
  const [writiaRealtimeScaffold, setWritiaRealtimeScaffold] = useState(() => {
    try { return localStorage.getItem(WRITIA_REALTIME_SCAFFOLD_KEY) === 'true' } catch (error) {
      console.error('Unable to load Writia scaffold setting.', error)
      return false
    }
  })
  const [writiaSettingsMessage, setWritiaSettingsMessage] = useState('')

  const currentDraftKey = keyDirty ? draftKey : apiKey
  const currentFallbackKeys = fallbackKeysDirty ? draftFallbackKeys : fallbackApiKeys
  const fallbackCount = currentFallbackKeys.filter((key) => key.trim() && key.trim() !== currentDraftKey.trim()).length

  function saveWritiaSetting(key: string, value: string, onSaved: () => void) {
    try {
      localStorage.setItem(key, value)
      onSaved()
      setWritiaSettingsMessage('Writia settings saved on this device.')
    } catch (error) {
      console.error('Unable to save Writia settings.', error)
      setWritiaSettingsMessage('Writia settings could not be saved in this browser.')
    }
  }

  async function saveKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const fallbacks = [...new Set(currentFallbackKeys.map((key) => key.trim()).filter((key) => key && key !== currentDraftKey.trim()))]
      if (!currentDraftKey.trim() && fallbacks.length) throw new Error('Add a primary shared AI service key before saving fallback keys.')
      await onSaveApiKeys(currentDraftKey, fallbacks)
      setSaved(true)
      setKeyDirty(false)
      setDraftFallbackKeys(fallbacks)
      setFallbackKeysDirty(false)
      setMessage(currentDraftKey.trim() || fallbacks.length ? 'Shared AI service keys saved in this browser’s database.' : 'All shared AI service keys removed from this browser’s database.')
    } catch (error) {
      console.error('Unable to save the Speakia AI API key from Settings.', error)
      setMessage(error instanceof Error ? error.message : 'Unable to save the Speakia AI API key.')
    } finally {
      setSaving(false)
    }
  }

  if (showPromptLibrary) return <PromptEngineeringLibrary onBack={() => setShowPromptLibrary(false)} />

  return (
    <div className="page-content inner-page settings-page">
      <div className="inner-page-heading">
        <div>
          <p className="eyebrow">SPEAKIA + WRITIA</p>
          <h1>Shared settings</h1>
          <p className="page-subtitle">One place for your connected productive-skills platforms: Speakia IELTS Speaking and Writia IELTS Writing.</p>
        </div>
        <Button variant="outline" onClick={() => setShowPromptLibrary(true)}><Sparkles size={15} /> Prompt Engineering / Library</Button>
      </div>

      <Card className="settings-card">
        <div className="settings-card-heading">
          <span className="settings-icon"><KeyRound size={19} /></span>
          <div><h2>Shared AI connection</h2><p>One primary key and optional fallbacks power coaching and assessment across Speakia and Writia. Prodia model names are friendly aliases for the Google Gemini models used by this connection.</p></div>
          <Badge className={currentDraftKey.trim() ? 'settings-status-connected' : 'settings-status-missing'}>{currentDraftKey.trim() ? `${1 + fallbackCount} KEY${fallbackCount ? 'S' : ''} AVAILABLE` : 'PRIMARY KEY REQUIRED'}</Badge>
        </div>
        <form className="settings-key-form" onSubmit={(event) => void saveKey(event)}>
          <label htmlFor="settings-api-key">AI service API key</label>
          <div className="settings-key-input">
            <input
              id="settings-api-key"
              type={keyVisible ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={currentDraftKey}
              onChange={(event) => { setDraftKey(event.target.value); setKeyDirty(true); setSaved(false); setMessage('') }}
              placeholder="Paste your AI service API key"
            />
            <button type="button" aria-label={keyVisible ? 'Hide API key' : 'Show API key'} onClick={() => setKeyVisible((visible) => !visible)}>
              {keyVisible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <div className="settings-form-footer">
            <p><LockKeyhole size={14} /> Shared by both platforms; saved in this browser’s IndexedDB until you remove it.</p>
            <div className="settings-key-actions">
              {currentDraftKey && <Button type="button" variant="outline" onClick={() => { setDraftKey(''); setKeyDirty(true); setSaved(false); setMessage('') }}><Trash2 size={15} /> Clear</Button>}
              <Button type="submit" disabled={saved || saving}>{saving ? 'Saving…' : <><Save size={15} /> Save key</>}</Button>
            </div>
          </div>
          <div className="settings-fallback-keys">
            <div className="settings-fallback-heading"><div><strong>Fallback API keys</strong><small>On quota or rate limits, requests retry with the next available key.</small></div><Button type="button" variant="outline" size="sm" onClick={() => { setDraftFallbackKeys([...currentFallbackKeys, '']); setFallbackKeysDirty(true); setSaved(false); setMessage('') }}><Plus size={14} /> Add fallback</Button></div>
            {currentFallbackKeys.map((key, index) => <div className="settings-fallback-row" key={`fallback-${index}`}>
              <label className="sr-only" htmlFor={`settings-fallback-api-key-${index}`}>Fallback API key {index + 1}</label>
              <input id={`settings-fallback-api-key-${index}`} type={keyVisible ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={key} onChange={(event) => { setDraftFallbackKeys(currentFallbackKeys.map((item, itemIndex) => itemIndex === index ? event.target.value : item)); setFallbackKeysDirty(true); setSaved(false); setMessage('') }} placeholder={`Fallback API key ${index + 1}`} />
              <button type="button" aria-label={keyVisible ? 'Hide API keys' : 'Show API keys'} onClick={() => setKeyVisible((visible) => !visible)}>{keyVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              <button type="button" aria-label={`Remove fallback API key ${index + 1}`} onClick={() => { setDraftFallbackKeys(currentFallbackKeys.filter((_, itemIndex) => itemIndex !== index)); setFallbackKeysDirty(true); setSaved(false); setMessage('') }}><X size={16} /></button>
            </div>)}
            {!currentFallbackKeys.length && <p className="settings-help">No fallback keys added. Both platforms will use only the primary key.</p>}
          </div>
          {message && <p className="settings-message" role="status">{message}</p>}
        </form>
        <div className="settings-security-note">
          <strong>Keep your key safe</strong>
          <p>Keys are stored in this browser’s IndexedDB and sent directly to the connected AI service. Use only keys you control; each key remains subject to the provider’s quota and billing. Don’t enter shared, production, or billing-sensitive keys. A production app should proxy AI requests through a secure backend.</p>
        </div>
      </Card>

      <Card className="settings-card">
        <div className="settings-card-heading">
          <span className="settings-icon settings-icon-mint"><Save size={19} /></span>
          <div><h2>Speakia practice defaults</h2><p>Choose which Prodia model evaluates IELTS Speaking practice.</p></div>
        </div>
        <label className="settings-select-label" htmlFor="settings-assessment-model">Prodia Speaking assessment model</label>
        <select id="settings-assessment-model" className="settings-select" value={assessmentModel} onChange={(event) => onAssessmentModelChange(event.target.value as AssessmentModel)}>
          {ASSESSMENT_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label} · {model.description}</option>)}
        </select>
        <p className="settings-help">Your selection is saved on this device and applied to your next speaking practice assessment.</p>
      </Card>

      <Card className="settings-card">
        <div className="settings-card-heading">
          <span className="settings-icon settings-icon-mint"><PenLine size={19} /></span>
          <div><h2>Writia writing &amp; Coach</h2><p>Set Prodia writing assessment defaults and how Writia Coach communicates with you.</p></div>
        </div>
        <label className="settings-select-label" htmlFor="settings-writia-assessment-model">Writing assessment model</label>
        <select id="settings-writia-assessment-model" className="settings-select" value={writiaAssessmentModel} onChange={(event) => {
          const value = ASSESSMENT_MODELS.find((model) => model.id === event.target.value)?.id
          if (value) saveWritiaSetting(WRITIA_ASSESSMENT_MODEL_KEY, value, () => setWritiaAssessmentModel(value))
        }}>
          {ASSESSMENT_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label} · {model.description}</option>)}
        </select>
        <p className="settings-help">Used for Writia writing assessments and focused drill feedback; saved on this device.</p>

        <label className="settings-select-label" htmlFor="settings-writia-language">Writia Coach language</label>
        <select id="settings-writia-language" className="settings-select" value={writiaLanguage} onChange={(event) => {
          const value = WRITIA_COACH_LANGUAGES.find((language) => language === event.target.value)
          if (value) saveWritiaSetting(WRITIA_COACH_LANGUAGE_KEY, value, () => setWritiaLanguage(value))
        }}>
          {WRITIA_COACH_LANGUAGES.map((language) => <option key={language} value={language}>{language === 'Urdu' ? 'Urdu (Pakistan)' : language}</option>)}
        </select>

        <label className="settings-select-label" htmlFor="settings-writia-voice">Writia Coach voice</label>
        <select id="settings-writia-voice" className="settings-select" value={writiaVoice} onChange={(event) => {
          const value = GEMINI_LIVE_VOICES.find((voice) => voice.id === event.target.value)?.id
          if (value) saveWritiaSetting(WRITIA_COACH_VOICE_KEY, value, () => setWritiaVoice(value))
        }}>
          {GEMINI_LIVE_VOICES.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
        </select>

        <label className="settings-writia-toggle"><input type="checkbox" checked={writiaRealtimeScaffold} onChange={(event) => saveWritiaSetting(WRITIA_REALTIME_SCAFFOLD_KEY, String(event.target.checked), () => setWritiaRealtimeScaffold(event.target.checked))} /><span><strong>Real-time Scaffolded Coaching</strong><small>Share writing-pad updates with Writia Coach after a short pause. Off by default.</small></span><Sparkles size={17} /></label>
        <p className="settings-help">Voice replies and spoken typed-prompt responses stay enabled. Microphone input remains an optional control in the Writia Coach panel.</p>
        {writiaSettingsMessage && <p className="settings-message" role="status">{writiaSettingsMessage}</p>}
      </Card>

      <Card className="settings-card">
        <div className="settings-card-heading">
          <span className="settings-icon"><MessageCircle size={19} /></span>
          <div><h2>Prodia text models</h2><p>Choose the Prodia model for assistant conversations and interactive learning tools.</p></div>
        </div>
        <label className="settings-select-label" htmlFor="settings-assistant-chat-model">Standard text chat model</label>
        <select id="settings-assistant-chat-model" className="settings-select" value={assistantChatModel} onChange={(event) => onAssistantModelChange('chat', event.target.value as AssistantModel)}>
          {ASSISTANT_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label} · {model.description}{model.id === 'gemini-3.8-flash' ? ' (default)' : ''}</option>)}
        </select>
        <p className="settings-help">Used for regular typed conversation and assistant replies. Default: Prodia Core.</p>
        <label className="settings-select-label" htmlFor="settings-assistant-tool-model">Learning tool and fallback model</label>
        <select id="settings-assistant-tool-model" className="settings-select" value={assistantToolModel} onChange={(event) => onAssistantModelChange('tool', event.target.value as AssistantModel)}>
          {ASSISTANT_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label} · {model.description}{model.id === 'gemini-3.8-flash' ? ' (default fallback)' : ''}</option>)}
        </select>
        <p className="settings-help">Used to build flashcards, slides, and interactive HTML5 lessons. If the chat model does not return the requested tool call, Speakia retries with this model.</p>
        <div className="settings-security-note">
          <strong><Sparkles size={13} /> Learning tools</strong>
          <p>The fallback is used only for requests that need an interactive learning tool; regular chat stays on your selected standard model.</p>
        </div>
      </Card>

      <Card className="settings-card settings-appearance">
        <div className="settings-card-heading">
          <span className="settings-icon settings-icon-peach">{theme === 'light' ? <Sun size={19} /> : <Moon size={19} />}</span>
          <div><h2>Shared appearance</h2><p>Your appearance preference applies to both Speakia and Writia.</p></div>
        </div>
        <div className="settings-theme-row">
          <div><strong>{theme === 'light' ? 'Light appearance' : 'Dark appearance'}</strong><span>Also available from the theme button in the top bar.</span></div>
          <Button variant="outline" onClick={onThemeChange}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />} Switch to {theme === 'light' ? 'dark' : 'light'}</Button>
        </div>
      </Card>
    </div>
  )
}
