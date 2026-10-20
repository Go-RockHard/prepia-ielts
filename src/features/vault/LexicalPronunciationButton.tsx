import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Volume2 } from 'lucide-react'
import { loadPronunciationAudio, savePronunciationAudio, synthesizePronunciation } from './pronunciationAudio'

export function LexicalPronunciationButton({ term, apiKey }: { term: string; apiKey: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  async function playPronunciation() {
    const audio = audioRef.current
    if (!audio || busy) return
    setError('')
    if (!audio.paused) {
      audio.pause()
      audio.currentTime = 0
      return
    }

    setBusy(true)
    try {
      let blob = await loadPronunciationAudio(term)
      if (!blob) {
        blob = await synthesizePronunciation(apiKey, term)
        try {
          await savePronunciationAudio(term, blob)
        } catch (storageError) {
          console.error(`Unable to cache pronunciation audio for "${term}".`, storageError)
          setError('Audio is ready, but could not be saved locally; the next play may use Gemini again.')
        }
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = URL.createObjectURL(blob)
      audio.src = objectUrlRef.current
      audio.currentTime = 0
      await audio.play()
    } catch (caughtError) {
      console.error(`Unable to play the pronunciation for "${term}".`, caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to play this pronunciation. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="lexical-pronunciation-control">
      <button type="button" className="lexical-pronunciation-button" aria-label={`Listen to the pronunciation of ${term}`} title={`Listen to ${term}`} disabled={busy} onClick={() => void playPronunciation()}>
        {busy ? <LoaderCircle size={14} className="spin-icon" /> : <Volume2 size={14} />}
        <span>{busy ? 'Loading' : 'Listen'}</span>
      </button>
      <audio ref={audioRef} preload="none" />
      {error && <span className="lexical-pronunciation-error" role="status">{error}</span>}
    </span>
  )
}
