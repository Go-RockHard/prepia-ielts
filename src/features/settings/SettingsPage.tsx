import { useState } from 'react'
import { Eye, EyeOff, KeyRound, LockKeyhole, MessageCircle, Moon, Save, Sparkles, Sun, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ASSESSMENT_MODELS, type AssessmentModel } from '@/features/simulator/gemini'
import { ASSISTANT_MODELS, type AssistantModel } from '@/features/assistant/models'
import { GeminiPromptLibrary } from './GeminiPromptLibrary'

export function SettingsPage({
  apiKey,
  onSaveApiKey,
  assessmentModel,
  onAssessmentModelChange,
  assistantChatModel,
  assistantToolModel,
  onAssistantModelChange,
  theme,
  onThemeChange,
}: {
  apiKey: string
  onSaveApiKey: (value: string) => Promise<void>
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
  const [keyDirty, setKeyDirty] = useState(false)
  const [keyVisible, setKeyVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(true)
  const [saving, setSaving] = useState(false)

  const currentDraftKey = keyDirty ? draftKey : apiKey

  async function saveKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      await onSaveApiKey(currentDraftKey)
      setSaved(true)
      setKeyDirty(false)
      setMessage(currentDraftKey.trim() ? 'Gemini API key saved in this browser’s database.' : 'Gemini API key removed from this browser’s database.')
    } catch (error) {
      console.error('Unable to save the Gemini API key from Settings.', error)
      setMessage(error instanceof Error ? error.message : 'Unable to save the Gemini API key.')
    } finally {
      setSaving(false)
    }
  }

  if (showPromptLibrary) return <GeminiPromptLibrary onBack={() => setShowPromptLibrary(false)} />

  return (
    <div className="page-content inner-page settings-page">
      <div className="inner-page-heading">
        <div>
          <p className="eyebrow">MAKE SPEAKIA YOUR OWN</p>
          <h1>Settings</h1>
          <p className="page-subtitle">Manage your AI connection, practice defaults, and app appearance.</p>
        </div>
        <Button variant="outline" onClick={() => setShowPromptLibrary(true)}><Sparkles size={15} /> Gemini prompt library</Button>
      </div>

      <Card className="settings-card">
        <div className="settings-card-heading">
          <span className="settings-icon"><KeyRound size={19} /></span>
          <div><h2>Gemini API connection</h2><p>One key for live speaking practice, media assessments, and your Speakia coach.</p></div>
          <Badge className={apiKey.trim() ? 'settings-status-connected' : 'settings-status-missing'}>{apiKey.trim() ? 'CONNECTED' : 'NOT SET'}</Badge>
        </div>
        <form className="settings-key-form" onSubmit={(event) => void saveKey(event)}>
          <label htmlFor="settings-api-key">Google AI Studio API key</label>
          <div className="settings-key-input">
            <input
              id="settings-api-key"
              type={keyVisible ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={currentDraftKey}
              onChange={(event) => { setDraftKey(event.target.value); setKeyDirty(true); setSaved(false); setMessage('') }}
              placeholder="Paste your Gemini API key"
            />
            <button type="button" aria-label={keyVisible ? 'Hide API key' : 'Show API key'} onClick={() => setKeyVisible((visible) => !visible)}>
              {keyVisible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <div className="settings-form-footer">
            <p><LockKeyhole size={14} /> Saved in this browser’s IndexedDB and retained between visits until you remove it.</p>
            <div className="settings-key-actions">
              {currentDraftKey && <Button type="button" variant="outline" onClick={() => { setDraftKey(''); setKeyDirty(true); setSaved(false); setMessage('') }}><Trash2 size={15} /> Clear</Button>}
              <Button type="submit" disabled={saved || saving}>{saving ? 'Saving…' : <><Save size={15} /> Save key</>}</Button>
            </div>
          </div>
          {message && <p className="settings-message" role="status">{message}</p>}
        </form>
        <div className="settings-security-note">
          <strong>Keep your key safe</strong>
          <p>The key is used directly from this browser to connect to Google Gemini. Don’t enter a shared, production, or billing-sensitive key. Restrict its permissions in Google AI Studio. A production app should proxy AI requests through a secure backend.</p>
        </div>
      </Card>

      <Card className="settings-card">
        <div className="settings-card-heading">
          <span className="settings-icon settings-icon-mint"><Save size={19} /></span>
          <div><h2>Practice defaults</h2><p>Choose which Gemini model Speakia uses to evaluate speaking practice.</p></div>
        </div>
        <label className="settings-select-label" htmlFor="settings-assessment-model">Speaking assessment model</label>
        <select id="settings-assessment-model" className="settings-select" value={assessmentModel} onChange={(event) => onAssessmentModelChange(event.target.value as AssessmentModel)}>
          {ASSESSMENT_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
        </select>
        <p className="settings-help">Your selection is saved on this device and applied to your next speaking practice assessment.</p>
      </Card>

      <Card className="settings-card">
        <div className="settings-card-heading">
          <span className="settings-icon"><MessageCircle size={19} /></span>
          <div><h2>Speakia assistant models</h2><p>Choose the model for assistant conversations and a dedicated model for interactive learning tools.</p></div>
        </div>
        <label className="settings-select-label" htmlFor="settings-assistant-chat-model">Standard text chat model</label>
        <select id="settings-assistant-chat-model" className="settings-select" value={assistantChatModel} onChange={(event) => onAssistantModelChange('chat', event.target.value as AssistantModel)}>
          {ASSISTANT_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}{model.id === 'gemini-3.8-flash' ? ' (default)' : ''}</option>)}
        </select>
        <p className="settings-help">Used for regular typed conversation and assistant replies. Default: Gemini 3.8 Flash.</p>
        <label className="settings-select-label" htmlFor="settings-assistant-tool-model">Learning tool and fallback model</label>
        <select id="settings-assistant-tool-model" className="settings-select" value={assistantToolModel} onChange={(event) => onAssistantModelChange('tool', event.target.value as AssistantModel)}>
          {ASSISTANT_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}{model.id === 'gemini-3.8-flash' ? ' (default fallback)' : ''}</option>)}
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
          <div><h2>Appearance</h2><p>Choose a comfortable look for your Speakia workspace.</p></div>
        </div>
        <div className="settings-theme-row">
          <div><strong>{theme === 'light' ? 'Light appearance' : 'Dark appearance'}</strong><span>Also available from the theme button in the top bar.</span></div>
          <Button variant="outline" onClick={onThemeChange}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />} Switch to {theme === 'light' ? 'dark' : 'light'}</Button>
        </div>
      </Card>
    </div>
  )
}
