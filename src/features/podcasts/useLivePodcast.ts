import { useEffect, useRef, useState } from 'react'
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai'
import { mergeTranscriptText } from '@/features/simulator/transcript'
import type { PodcastLanguage, PodcastTurn } from './types'

export type LivePodcastState = 'idle' | 'connecting' | 'live' | 'saving'
export type LivePodcastSpeaker = PodcastTurn['speaker'] | null

const MAX_LIVE_TURNS = 12

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

function pcmSamplesToAudioBuffer(context: AudioContext, pcm: ArrayBuffer, sampleRate: number): AudioBuffer {
  const samples = new Int16Array(pcm, 0, Math.floor(pcm.byteLength / 2))
  const buffer = context.createBuffer(1, samples.length, sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < samples.length; index += 1) channel[index] = samples[index] / 32768
  return buffer
}

function pcmChunksToWav(chunks: Uint8Array[], sampleRate = 24000): Blob | null {
  const dataLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  if (!dataLength) return null
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, dataLength, true)
  const pcm = new Uint8Array(dataLength)
  let offset = 0
  for (const chunk of chunks) {
    pcm.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new Blob([header, pcm], { type: 'audio/wav' })
}

function liveHostInstructions(speaker: PodcastTurn['speaker'], language: PodcastLanguage, topic: string): string {
  const languageInstruction = language === 'Code Switching'
    ? 'Speak naturally while blending English, Urdu, and Punjabi throughout the conversation.'
    : `Speak the entire conversation in ${language}.`
  const persona = speaker === 'Aisha'
    ? 'You are Aisha, the warm, encouraging, insightful host of Speakia Podcasts. Open the episode immediately with a lively welcome, introduce the topic, and share a useful first perspective. Invite Noah to add his perspective.'
    : 'You are Noah, the curious, energetic IELTS speaking strategist co-host. Build on Aisha’s opening with concrete examples, practical advice, and natural conversational warmth.'
  return `${persona}\nThis is a live, unscripted podcast conversation between two independent AI hosts for an IELTS Speaking learner. Focus the episode on: "${topic}". ${languageInstruction}\nSpeak only your own podcast turn, about 2–4 natural sentences. Do not say speaker labels, stage directions, or mention that you are an AI. Never claim learner results or personal activity you have not been given. Alternate naturally: respond to the previous host's actual point, add a distinct useful idea, and hand the conversation back to the other host with a relevant question or invitation. Keep the episode engaging, coherent, and useful.`
}

function hostTurnPrompt(
  speaker: PodcastTurn['speaker'],
  topic: string,
  previousTurn: PodcastTurn | undefined,
  turnNumber: number,
): string {
  if (!previousTurn) {
    return `Start speaking now. Welcome the listener to Speakia Podcasts and begin an unscripted episode about "${topic}". Open with a concise hook, then share your first useful insight and invite Noah to build on it.`
  }
  if (turnNumber >= MAX_LIVE_TURNS) {
    return `This is the final turn. Respond briefly and naturally to ${previousTurn.speaker}'s actual point, give one useful final takeaway about "${topic}", and warmly sign off the episode.`
  }
  return `Continue the live podcast about "${topic}". ${previousTurn.speaker} just said: "${previousTurn.text}" Respond directly to that point, add a fresh practical insight, and naturally invite ${speaker === 'Aisha' ? 'Noah' : 'Aisha'} to continue.`
}

export function useLivePodcast(onEpisodeComplete: (podcastId: string, audio: Blob, turns: PodcastTurn[], durationSeconds: number) => Promise<void>) {
  const [state, setState] = useState<LivePodcastState>('idle')
  const [activeSpeaker, setActiveSpeaker] = useState<LivePodcastSpeaker>(null)
  const [turnIndex, setTurnIndex] = useState(-1)
  const [totalTurns, setTotalTurns] = useState(0)
  const [turns, setTurns] = useState<PodcastTurn[]>([])
  const [podcastId, setPodcastId] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [speechElapsedSeconds, setSpeechElapsedSeconds] = useState(0)
  const [error, setError] = useState('')
  const stateRef = useRef<LivePodcastState>('idle')
  const sessionsRef = useRef<Record<PodcastTurn['speaker'], Session | null>>({ Aisha: null, Noah: null })
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourcesRef = useRef<AudioBufferSourceNode[]>([])
  const chunksRef = useRef<Uint8Array[]>([])
  const nextAudioTimeRef = useRef(0)
  const activeAudioStartRef = useRef<number | null>(null)
  const turnAudioStartSecondsRef = useRef(0)
  const turnAudioDurationSecondsRef = useRef(0)
  const pendingAudioRef = useRef(0)
  const turnCompleteRef = useRef(false)
  const advancingRef = useRef(false)
  const advanceTimerRef = useRef<number | null>(null)
  const activeRef = useRef(false)
  const turnsRef = useRef<PodcastTurn[]>([])
  const podcastIdRef = useRef('')
  const turnIndexRef = useRef(-1)
  const turnTextRef = useRef('')
  const startedAtRef = useRef(0)
  const topicRef = useRef('')
  const languageRef = useRef<PodcastLanguage>('English')
  const onEpisodeCompleteRef = useRef(onEpisodeComplete)
  const finishRef = useRef<(save: boolean) => Promise<void>>(async () => {})

  useEffect(() => { onEpisodeCompleteRef.current = onEpisodeComplete }, [onEpisodeComplete])
  useEffect(() => {
    if (state !== 'live' && state !== 'connecting') return
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [state])
  useEffect(() => {
    if (state !== 'live') return
    const timer = window.setInterval(() => {
      const context = audioContextRef.current
      const startAt = activeAudioStartRef.current
      setSpeechElapsedSeconds(context && startAt !== null
        ? Math.max(0, context.currentTime - startAt)
        : 0)
    }, 60)
    return () => window.clearInterval(timer)
  }, [state])
  useEffect(() => () => { void finishRef.current(false) }, [])

  function setCurrentState(next: LivePodcastState) {
    stateRef.current = next
    setState(next)
  }

  function beginTurn(speaker: PodcastTurn['speaker']) {
    const index = turnIndexRef.current
    if (turnsRef.current[index]?.speaker === speaker) return
    const turn = {
      speaker,
      text: '',
      audioStartSeconds: chunksRef.current.reduce((total, chunk) => total + chunk.byteLength, 0) / 48000,
    }
    turnsRef.current = [...turnsRef.current, turn]
    turnAudioStartSecondsRef.current = turn.audioStartSeconds
    turnAudioDurationSecondsRef.current = 0
    activeAudioStartRef.current = null
    setSpeechElapsedSeconds(0)
    turnTextRef.current = ''
    setTurns(turnsRef.current)
  }

  function updateCurrentTurn(text: string) {
    if (text) turnTextRef.current = mergeTranscriptText(turnTextRef.current, text)
    if (!turnTextRef.current && turnAudioDurationSecondsRef.current === 0) return
    turnsRef.current = turnsRef.current.map((turn, index) => (
      index === turnsRef.current.length - 1 ? {
        ...turn,
        text: turnTextRef.current,
        ...(turnAudioDurationSecondsRef.current > 0 ? { audioStartSeconds: turnAudioStartSecondsRef.current, audioDurationSeconds: turnAudioDurationSecondsRef.current } : {}),
      } : turn
    ))
    setTurns(turnsRef.current)
  }

  function sendTurn(index: number) {
    if (!activeRef.current) return
    if (index >= MAX_LIVE_TURNS) {
      void finishRef.current(true)
      return
    }
    const speaker: PodcastTurn['speaker'] = index % 2 === 0 ? 'Aisha' : 'Noah'
    const previousTurn = turnsRef.current[turnsRef.current.length - 1]
    turnIndexRef.current = index
    setTurnIndex(index)
    setActiveSpeaker(speaker)
    pendingAudioRef.current = 0
    turnCompleteRef.current = false
    advancingRef.current = false
    turnTextRef.current = ''
    const session = sessionsRef.current[speaker]
    if (!session) {
      setError(`The live ${speaker} host is not connected.`)
      void finishRef.current(false)
      return
    }
    session.sendClientContent({
      turns: [{
        role: 'user',
        parts: [{ text: hostTurnPrompt(speaker, topicRef.current, previousTurn, index + 1) }],
      }],
      turnComplete: true,
    })
  }

  function advanceTurnIfReady() {
    if (!activeRef.current || !turnCompleteRef.current || pendingAudioRef.current > 0 || advancingRef.current) return
    advancingRef.current = true
    const completedText = turnTextRef.current.trim()
    const completedTurnIndex = turnIndexRef.current
    const completedPodcastId = podcastIdRef.current
    if (!completedText) {
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null
        if (!activeRef.current || turnIndexRef.current !== completedTurnIndex || podcastIdRef.current !== completedPodcastId) return
        if (!turnTextRef.current.trim()) {
          setError('A live podcast host returned no transcript. The episode was stopped.')
          void finishRef.current(false)
          return
        }
        sendTurn(completedTurnIndex + 1)
      }, 1200)
      return
    }
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null
      if (activeRef.current && turnIndexRef.current === completedTurnIndex && podcastIdRef.current === completedPodcastId) {
        sendTurn(completedTurnIndex + 1)
      }
    }, 180)
  }

  function handleMessage(speaker: PodcastTurn['speaker'], message: LiveServerMessage) {
    if (!activeRef.current || speaker !== (turnIndexRef.current % 2 === 0 ? 'Aisha' : 'Noah')) return
    const content = message.serverContent
    if (!content) return
    if (content.outputTranscription?.text) {
      beginTurn(speaker)
      updateCurrentTurn(content.outputTranscription.text)
    }
    for (const part of content.modelTurn?.parts ?? []) {
      if (!part.inlineData?.data) continue
      const context = audioContextRef.current
      if (!context) continue
      try {
        const pcm = base64ToArrayBuffer(part.inlineData.data)
        const sampleRate = Number(part.inlineData.mimeType?.match(/rate=(\d+)/i)?.[1]) || 24000
        const buffer = pcmSamplesToAudioBuffer(context, pcm, sampleRate)
        const source = context.createBufferSource()
        source.buffer = buffer
        source.connect(context.destination)
        const startAt = Math.max(context.currentTime + 0.025, nextAudioTimeRef.current)
        nextAudioTimeRef.current = startAt + buffer.duration
        if (activeAudioStartRef.current === null) activeAudioStartRef.current = startAt
        pendingAudioRef.current += 1
        chunksRef.current.push(new Uint8Array(pcm).slice())
        turnAudioDurationSecondsRef.current += pcm.byteLength / 48000
        sourcesRef.current.push(source)
        source.onended = () => {
          sourcesRef.current = sourcesRef.current.filter((item) => item !== source)
          pendingAudioRef.current = Math.max(0, pendingAudioRef.current - 1)
          updateCurrentTurn('')
          advanceTurnIfReady()
        }
        source.start(startAt)
      } catch (caughtError) {
        console.error(`Unable to play the live ${speaker} podcast voice.`, caughtError)
        setError('Live podcast audio could not be played. Check your audio output and try again.')
        void finishRef.current(false)
        return
      }
    }
    if (content.turnComplete) {
      turnCompleteRef.current = true
      advanceTurnIfReady()
    }
  }

  async function finishPodcast(save: boolean): Promise<void> {
    if (!activeRef.current) return
    updateCurrentTurn('')
    activeRef.current = false
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
    const audio = save ? pcmChunksToWav(chunksRef.current) : null
    if (save) setCurrentState('saving')
    for (const source of sourcesRef.current) {
      try { source.stop() } catch (caughtError) {
        if (!(caughtError instanceof DOMException && caughtError.name === 'InvalidStateError')) console.error('Unable to stop live podcast playback.', caughtError)
      }
    }
    sourcesRef.current = []
    Object.values(sessionsRef.current).forEach((session) => session?.close())
    sessionsRef.current = { Aisha: null, Noah: null }
    const context = audioContextRef.current
    audioContextRef.current = null
    if (context && context.state !== 'closed') {
      try { await context.close() } catch (caughtError) { console.error('Unable to close live podcast audio.', caughtError) }
    }
    chunksRef.current = []
    if (audio) {
      try {
        await onEpisodeCompleteRef.current(
          podcastIdRef.current,
          audio,
          turnsRef.current.filter((turn) => turn.text.trim()),
          Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)),
        )
      } catch (caughtError) {
        console.error('Unable to save the live podcast episode.', caughtError)
        setError(caughtError instanceof Error ? caughtError.message : 'The live podcast finished, but its audio could not be saved.')
      }
    } else if (save) {
      setError('The live podcast ended without any audio to save. Check Gemini Live model access and try again.')
    }
    pendingAudioRef.current = 0
    turnCompleteRef.current = false
    advancingRef.current = false
    setActiveSpeaker(null)
    turnIndexRef.current = -1
    setTurnIndex(-1)
    setCurrentState('idle')
  }
  useEffect(() => { finishRef.current = finishPodcast })

  async function start(topic: string, language: PodcastLanguage, podcastId: string, apiKey: string): Promise<void> {
    if (stateRef.current !== 'idle' || activeRef.current) return
    if (!apiKey.trim()) {
      setError('Add your Gemini API key in Settings before starting a live podcast.')
      return
    }
    if (topic.trim().length < 3) {
      setError('Choose a podcast topic before starting a live episode.')
      return
    }
    setError('')
    turnsRef.current = []
    setTurns([])
    setTotalTurns(MAX_LIVE_TURNS)
    topicRef.current = topic.trim().slice(0, 180)
    languageRef.current = language
    podcastIdRef.current = podcastId
    setPodcastId(podcastId)
    turnIndexRef.current = -1
    setTurnIndex(-1)
    setElapsedSeconds(0)
    setSpeechElapsedSeconds(0)
    startedAtRef.current = Date.now()
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
    chunksRef.current = []
    activeRef.current = true
    setCurrentState('connecting')
    try {
      const context = new AudioContext()
      audioContextRef.current = context
      await context.resume()
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const connectHost = (speaker: PodcastTurn['speaker'], voiceName: string) => client.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          systemInstruction: liveHostInstructions(speaker, languageRef.current, topicRef.current),
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
        callbacks: {
          onmessage: (message) => handleMessage(speaker, message),
          onerror: (event) => {
            console.error(`Gemini Live ${speaker} podcast session failed.`, event)
            setError(`The live ${speaker} host encountered an error. Check your API key, model access, and network.`)
            void finishRef.current(false)
          },
          onclose: () => {
            if (activeRef.current) {
              setError(`The live ${speaker} podcast connection closed unexpectedly.`)
              void finishRef.current(false)
            }
          },
        },
      })
      const aishaPromise = connectHost('Aisha', 'Kore').then((session) => {
        if (activeRef.current) sessionsRef.current.Aisha = session
        else session.close()
        return session
      })
      const noahPromise = connectHost('Noah', 'Puck').then((session) => {
        if (activeRef.current) sessionsRef.current.Noah = session
        else session.close()
        return session
      })
      const [aisha, noah] = await Promise.all([aishaPromise, noahPromise])
      if (!activeRef.current) {
        aisha.close()
        noah.close()
        return
      }
      nextAudioTimeRef.current = context.currentTime
      setCurrentState('live')
      sendTurn(0)
    } catch (caughtError) {
      console.error('Unable to start the live Speakia podcast.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'The live podcast could not be started.')
      await finishRef.current(false)
    }
  }

  return {
    state,
    activeSpeaker,
    turnIndex,
    totalTurns,
    turns,
    podcastId,
    elapsedSeconds,
    speechElapsedSeconds,
    error,
    start,
    stop: () => { void finishRef.current(true) },
  }
}
