import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateModelAnswerAudio, loadModelAnswerAudio, saveModelAnswerAudio } from './modelAnswerAudio'

export function ModelAnswerAudioPlayer({ promptId, answer, apiKey }: { promptId: string; answer: string; apiKey: string }) {
  const [audioUrl, setAudioUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const audioUrlRef = useRef('')
  const audioRef = useRef<HTMLAudioElement>(null)
  const autoPlayRef = useRef(false)

  useEffect(() => () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
  }, [])

  useEffect(() => {
    if (!audioUrl || !autoPlayRef.current) return
    autoPlayRef.current = false
    void audioRef.current?.play().catch((caughtError: unknown) => {
      console.info('Automatic model-answer playback was blocked; use the audio player controls.', caughtError)
      setNotice('Audio is ready. Press play in the player if it did not start automatically.')
    })
  }, [audioUrl])

  async function prepareAudio() {
    if (audioUrl && audioRef.current) {
      setError('')
      setNotice('')
      void audioRef.current.play().catch((caughtError: unknown) => {
        console.error('Unable to play saved model-answer audio.', caughtError)
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to play model-answer audio.')
      })
      return
    }
    setLoading(true)
    setError('')
    setNotice('')
    try {
      let audio = await loadModelAnswerAudio(promptId, answer)
      if (!audio) {
        audio = await generateModelAnswerAudio(apiKey, answer)
        await saveModelAnswerAudio(promptId, answer, audio)
      }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      const nextUrl = URL.createObjectURL(audio)
      audioUrlRef.current = nextUrl
      autoPlayRef.current = true
      setAudioUrl(nextUrl)
    } catch (caughtError) {
      console.error('Unable to prepare model-answer audio.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load model-answer audio.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="topic-model-answer-audio">
    <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void prepareAudio()}>
      {loading ? <LoaderCircle size={14} className="spin-icon" /> : <Volume2 size={14} />}
      {loading ? 'Preparing audio…' : audioUrl ? 'Play saved audio' : 'Listen to model answer'}
    </Button>
    {audioUrl && <audio ref={audioRef} controls preload="metadata" src={audioUrl} aria-label="Listen to the model answer" />}
    {error && <small role="alert">{error}</small>}
    {notice && <small role="status">{notice}</small>}
  </div>
}
