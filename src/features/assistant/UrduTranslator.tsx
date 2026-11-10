import { useState } from 'react'
import { ArrowLeftRight, LoaderCircle, Mic, MicOff, Send } from 'lucide-react'
import type { AssistantModel } from './models'

export type TranslationMode = 'urdu-to-english' | 'reverse-practice'

export function UrduTranslator({
  mode,
  model,
  live,
  onModeChange,
  onTranslate,
  onStartVoice,
  onStopVoice,
}: {
  mode: TranslationMode
  model: AssistantModel
  live: boolean
  onModeChange: (mode: TranslationMode) => void
  onTranslate: (text: string, mode: TranslationMode) => Promise<string>
  onStartVoice: (mode: TranslationMode) => void
  onStopVoice: () => void
}) {
  const [draft, setDraft] = useState('')
  const [translation, setTranslation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [isChallenge, setIsChallenge] = useState(false)
  const reverse = mode === 'reverse-practice'

  async function requestTranslation(text: string, challenge = false) {
    if (!text.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      setTranslation(await onTranslate(text.trim(), mode))
      setIsChallenge(challenge)
      if (challenge) setDraft('')
    } catch (caughtError) {
      console.error('Unable to translate a Speakia IELTS practice sentence.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'The sentence could not be translated. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.trim()) return
    void requestTranslation(draft)
  }

  return (
    <section className="urdu-translator" aria-label="Pakistani Urdu and IELTS English translation practice">
      <div className="translator-mode-row">
        <button type="button" className={!reverse ? 'translator-mode-active' : ''} aria-pressed={!reverse} onClick={() => { setIsChallenge(false); onModeChange('urdu-to-english') }}>Pakistani Urdu → IELTS English</button>
        <button type="button" className={reverse ? 'translator-mode-active' : ''} aria-pressed={reverse} onClick={() => { setIsChallenge(false); onModeChange('reverse-practice') }}><ArrowLeftRight size={14} /> Reverse practice</button>
      </div>
      <p className="translator-instructions">{reverse
        ? 'Speakia gives you a natural Pakistani Urdu sentence. Translate it into clear, IELTS-appropriate English.'
        : 'Write a Pakistani Urdu sentence or speak it in live mode. Speakia will give you a natural, IELTS-appropriate English version.'}</p>
      <form className="translator-form" onSubmit={(event) => void submit(event)}>
        <label className="sr-only" htmlFor={`translator-input-${mode}`}>{reverse ? 'Your English translation' : 'Pakistani Urdu sentence'}</label>
        <textarea
          id={`translator-input-${mode}`}
          dir={reverse ? 'ltr' : 'auto'}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={reverse ? 'Write your English translation…' : 'Write a sentence in Pakistani Urdu…'}
          rows={3}
          disabled={busy}
        />
        <div className="translator-actions">
          {reverse && <button type="button" className="translator-voice-button" onClick={() => void requestTranslation('Give me one new Pakistani Urdu sentence for IELTS Speaking translation practice.', true)} disabled={busy}>New Urdu sentence</button>}
          <button type="button" className="translator-voice-button" onClick={() => live ? onStopVoice() : onStartVoice(mode)}>
            {live ? <MicOff size={15} /> : <Mic size={15} />}{live ? 'Stop live voice' : 'Practise by voice'}
          </button>
          <button type="submit" disabled={busy || !draft.trim()}>{busy ? <LoaderCircle className="assistant-spin" size={15} /> : <Send size={14} />} {busy ? 'Checking…' : reverse ? 'Check translation' : 'Translate'}</button>
        </div>
      </form>
      {translation && <div className="translator-result" aria-live="polite"><strong>{isChallenge ? 'Translate this Urdu sentence into English' : reverse ? 'Feedback and IELTS-ready English' : 'IELTS-ready English'}</strong><p dir={isChallenge ? 'auto' : 'ltr'}>{translation}</p></div>}
      {error && <p className="assistant-error" role="alert">{error}</p>}
      <p className="translator-model-note">Text practice · {model.replaceAll('-', ' ')}</p>
    </section>
  )
}
