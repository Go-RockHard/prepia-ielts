import { useEffect, useId, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { loadTranscriptAudio } from './recordingStorage'
import { SpeechHighlight } from './SpeechHighlight'
import { wordIndexAtElapsed } from './speechTiming'
import type { TranscriptEntry } from './types'

const playbackController = (() => {
  let activeTurnId: string | null = null
  let activePlayback: HTMLAudioElement | null = null
  let activePlaybackUrl: string | null = null
  let activePlaybackTime = 0
  let activePlaybackDuration = 0
  const events = new EventTarget()

  return {
    get activeTurnId() {
      return activeTurnId
    },
    get activePlaybackTime() {
      return activePlaybackTime
    },
    get activePlaybackDuration() {
      return activePlaybackDuration
    },
    subscribe(listener: EventListener) {
      events.addEventListener('change', listener)
      return () => events.removeEventListener('change', listener)
    },
    updateTurn(id: string | null) {
      activeTurnId = id
      if (!id) {
        activePlaybackTime = 0
        activePlaybackDuration = 0
      }
      events.dispatchEvent(new Event('change'))
    },
    setPlayback(playback: HTMLAudioElement, url: string) {
      activePlayback = playback
      activePlaybackUrl = url
      const updateProgress = () => {
        activePlaybackTime = playback.currentTime
        activePlaybackDuration = playback.duration
        events.dispatchEvent(new Event('change'))
      }
      playback.ontimeupdate = updateProgress
      playback.ondurationchange = updateProgress
    },
    isPlayback(playback: HTMLAudioElement) {
      return activePlayback === playback
    },
    cancel() {
      activePlayback?.pause()
      activePlayback = null
      if (activePlaybackUrl) URL.revokeObjectURL(activePlaybackUrl)
      activePlaybackUrl = null
      this.updateTurn(null)
    },
  }
})()

interface TranscriptAudioListProps {
  turns: TranscriptEntry[]
  variant: 'history' | 'evaluation' | 'live'
  testId?: string
  activeTurnId?: string | null
  activeWordIndex?: number
}

export function TranscriptAudioList({ turns, variant, testId, activeTurnId, activeWordIndex = -1 }: TranscriptAudioListProps) {
  const listId = useId()
  const [playingTurnId, setPlayingTurnId] = useState<string | null>(null)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [playbackDuration, setPlaybackDuration] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const syncActiveTurn = () => {
      const activeTurnId = playbackController.activeTurnId
      setPlayingTurnId(activeTurnId?.startsWith(`${listId}:`) ? activeTurnId : null)
      setPlaybackTime(playbackController.activePlaybackTime)
      setPlaybackDuration(playbackController.activePlaybackDuration)
    }
    const unsubscribe = playbackController.subscribe(syncActiveTurn)
    syncActiveTurn()
    return () => {
      unsubscribe()
      if (playbackController.activeTurnId?.startsWith(`${listId}:`)) playbackController.cancel()
    }
  }, [listId])

  async function togglePlayback(turn: TranscriptEntry, index: number) {
    const turnId = `${listId}:${index}`
    if (playbackController.activeTurnId === turnId) {
      playbackController.cancel()
      return
    }

    playbackController.cancel()
    setError('')
    playbackController.updateTurn(turnId)
    try {
      const audio = turn.audio ?? (testId && turn.id ? await loadTranscriptAudio(testId, turn.id) : null)
      if (playbackController.activeTurnId !== turnId) return
      if (!audio) {
        setError('Original audio is not available for this transcript turn.')
        playbackController.updateTurn(null)
        return
      }

      const url = URL.createObjectURL(audio)
      const playback = new Audio(url)
      playbackController.setPlayback(playback, url)
      const finishPlayback = () => {
        if (playbackController.isPlayback(playback)) playbackController.cancel()
      }
      playback.onended = finishPlayback
      playback.onerror = () => {
        if (playbackController.isPlayback(playback)) {
          setError('Unable to play the original audio for this transcript turn.')
          playbackController.cancel()
        }
      }
      await playback.play()
    } catch (caughtError) {
      console.error('Unable to play original transcript audio.', caughtError)
      if (playbackController.activeTurnId === turnId) {
        setError('Unable to load or play the original audio for this transcript turn.')
        playbackController.cancel()
      }
    }
  }

  return <>
    <p className="transcript-audio-note">New sessions use original microphone and examiner audio. Older sessions may not have saved turn audio.</p>
    {turns.map((turn, index) => {
      const turnId = `${listId}:${index}`
      const isPlaying = playingTurnId === turnId
      const liveActive = variant === 'live' && turn.id === activeTurnId
      const playbackWordIndex = isPlaying
        ? wordIndexAtElapsed(turn.text, playbackTime, playbackDuration)
        : liveActive ? activeWordIndex : -1
      const label = turn.role === 'examiner' ? 'EXAMINER' : turn.role === 'assessment' ? 'GEMINI AUDIO TRANSCRIPT' : 'YOU'
      return (
        <div
          className={variant === 'history'
            ? `history-transcript-entry history-transcript-${turn.role}`
            : variant === 'evaluation'
              ? 'transcript-item'
              : `live-transcript-line ${turn.role === 'candidate' ? 'candidate-line' : ''}`}
          key={`${index}-${turn.role}`}
        >
          <div className="transcript-turn-heading">
            <span>{label}</span>
            {turn.role !== 'assessment' && <button
              type="button"
              className="transcript-turn-audio"
              onClick={() => void togglePlayback(turn, index)}
              disabled={variant === 'live' && !turn.audio}
              aria-label={`${isPlaying ? 'Stop' : 'Listen to'} ${turn.role === 'examiner' ? 'examiner' : 'your'} transcript turn`}
              title={isPlaying ? 'Stop transcript playback' : turn.audio ? 'Play this original audio turn' : 'Audio is still being captured'}
            >
              {isPlaying ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>}
          </div>
          <p><SpeechHighlight text={turn.text} wordIndex={playbackWordIndex} /></p>
        </div>
      )
    })}
    {error && <p className="transcript-audio-error" role="status">{error}</p>}
  </>
}
