import { useEffect, useState } from 'react'
import { AudioLines, Headphones, LoaderCircle } from 'lucide-react'
import type { AudioLesson } from './audioLesson'
import { loadAudioLessonAudio } from './audioLessonStorage'

export function InlineAudioLesson({ lesson }: { lesson: AudioLesson }) {
  const [audioUrl, setAudioUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let objectUrl = ''
    setLoading(true)
    setError('')
    setAudioUrl('')
    void loadAudioLessonAudio(lesson.id).then((audio) => {
      if (!active) return
      if (!audio) {
        setError('The saved audio is unavailable on this device.')
        return
      }
      objectUrl = URL.createObjectURL(audio)
      setAudioUrl(objectUrl)
    }).catch((caughtError: unknown) => {
      if (active) setError(caughtError instanceof Error ? caughtError.message : 'The audio lesson could not be loaded.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [lesson.id])

  return (
    <section className="inline-audio-lesson" aria-label={`Audio lesson: ${lesson.title}`}>
      <header className="inline-audio-lesson-header">
        <span className="inline-audio-lesson-icon"><Headphones size={17} /></span>
        <div><strong>{lesson.title}</strong><span>{lesson.topic} · Spoken IELTS lesson</span></div>
      </header>
      <p className="inline-audio-lesson-summary">{lesson.summary}</p>
      {loading
        ? <p className="inline-audio-lesson-status"><LoaderCircle size={14} className="inline-audio-lesson-spin" /> Loading audio…</p>
        : audioUrl
          ? <audio className="inline-audio-lesson-player" controls preload="metadata" src={audioUrl} aria-label={`${lesson.title} audio player`} />
          : <p className="inline-audio-lesson-error" role="alert">{error}</p>}
      <details className="inline-audio-lesson-transcript">
        <summary><AudioLines size={14} /> Read transcript</summary>
        <p>{lesson.transcript}</p>
      </details>
    </section>
  )
}
