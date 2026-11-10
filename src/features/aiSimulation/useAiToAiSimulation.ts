import { useEffect, useRef, useState } from 'react'
import { Modality, type LiveServerMessage, type Session } from '@google/genai'
import { GoogleGenAI } from '@/lib/geminiClient'
import { getProdiaLiveModel } from '@/lib/geminiModels'
import { mergeTranscriptText } from '@/features/simulator/transcript'
import { loadAiSimulations, saveAiSimulationAudio, saveAiSimulations } from './storage'
import type { AiSimulationPart, AiSimulationRecord, AiSimulationTurn } from './types'

export type AiSimulationState = 'idle' | 'connecting' | 'live' | 'saving'
export type AiSimulationSpeaker = 'examiner' | 'candidate' | null

type SimulationPhase = 'part1' | 'part2-long' | 'part2-followup' | 'part3' | 'full-part1' | 'full-part2' | 'full-part2-followup' | 'full-part3' | 'ending'
type Turn = AiSimulationTurn

interface SimulationCueCard {
  title: string
  prompt: string
}

function partLabel(part: AiSimulationPart): string {
  if (part === 'full') return 'Full IELTS Speaking test'
  return `IELTS Speaking Part ${part.slice(-1)}`
}

function examinerInstructions(part: AiSimulationPart, topic: string, cueCard: SimulationCueCard | undefined, transcriptGuide?: string): string {
  const transcriptDirection = transcriptGuide
    ? `Use this supplied sample transcript as the exact question sequence and topic reference. Ask the sample questions in order, adapting only minor wording so the speech remains natural. Do not skip a test part or add extra questions.\n${transcriptGuide}\n`
    : ''
  const cueCardDirection = cueCard
    ? `Use this exact selected Part 2 cue card. Read its task and prompts faithfully; do not invent a replacement card:\nTitle: ${cueCard.title}\n${cueCard.prompt}\n`
    : 'For Part 2, randomly choose a fresh, realistic IELTS cue-card topic yourself and present three or four clear prompts. '
  return `You are a professional IELTS Speaking examiner running a practice simulation with an AI candidate. Speak naturally and neutrally at a measured, unhurried conversational pace, with brief natural pauses between thoughts. Ask one question at a time, and do not coach, score, praise, or correct the candidate. The selected test is ${partLabel(part)} and the focus topic is ${topic}. Follow controller instructions precisely: they specify the next stage and number of questions. ${transcriptDirection}${cueCardDirection}For Part 2, allow a brief preparation pause and invite a long turn. In Part 3, ask concise abstract discussion questions. At the end, thank the candidate and say the practice test is complete. Never claim to be an official examiner. Output spoken words only, with no labels or stage directions.`
}

function candidateInstructions(part: AiSimulationPart, topic: string, cueCard: SimulationCueCard | undefined, transcriptGuide?: string): string {
  const transcriptDirection = transcriptGuide
    ? `Use the supplied candidate responses as a model for the matching questions. Preserve the main details and ideas while speaking naturally; do not recite labels or examiner text.\n${transcriptGuide}\n`
    : ''
  const cueCardDirection = cueCard ? `The examiner will use this selected card; answer its prompts: ${cueCard.title}. ${cueCard.prompt}\n` : ''
  return `You are an IELTS Speaking candidate in a practice simulation, responding to a separate AI examiner. The selected format is ${partLabel(part)} and the focus topic is ${topic}. Answer only the examiner's latest question, naturally and directly, at a measured conversational pace with brief natural pauses. ${transcriptDirection}${cueCardDirection}For Part 1 or Part 3, speak for roughly 15–30 seconds with a clear point and a supporting detail or example. For a Part 2 cue card, give one coherent first-person long turn with a beginning, development, and clear ending, as if speaking for up to two minutes. Do not ask the examiner questions, give feedback, mention AI, or use labels, bullet points, or stage directions. Use realistic intermediate-to-advanced English without sounding memorized.`
}

function initialExaminerPrompt(part: AiSimulationPart, topic: string, cueCard: SimulationCueCard | undefined): string {
  const selectedCard = cueCard
    ? `Present this exact Part 2 cue card titled "${cueCard.title}":\n${cueCard.prompt}`
    : `Randomly choose a fresh IELTS Part 2 cue-card topic about ${topic} and create three or four clear prompts.`
  if (part === 'part2') return `Begin Part 2. ${selectedCard} Give the candidate one minute to prepare and up to two minutes to speak, then invite them to begin their long turn.`
  if (part === 'part3') return `Begin Part 3 with a concise transition and ask one abstract discussion question connected to ${topic}.`
  return `Begin ${part === 'full' ? 'the full test with Part 1' : 'Part 1'}. Briefly introduce the speaking test, then ask one familiar-topic question about ${topic}. Ask only one question and wait for the candidate's answer.`
}

function wavFromPcmChunks(chunks: Uint8Array[]): Blob | null {
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
  view.setUint32(24, 24000, true)
  view.setUint32(28, 48000, true)
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

function pcmSamplesToAudioBuffer(context: AudioContext, pcm: ArrayBuffer, sampleRate: number): AudioBuffer {
  const samples = new Int16Array(pcm, 0, Math.floor(pcm.byteLength / 2))
  const buffer = context.createBuffer(1, samples.length, sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < samples.length; index += 1) channel[index] = samples[index] / 32768
  return buffer
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

export function useAiToAiSimulation(username: string, apiKey: string) {
  const [records, setRecords] = useState<AiSimulationRecord[]>(() => loadAiSimulations(username))
  const [turns, setTurns] = useState<Turn[]>([])
  const [state, setState] = useState<AiSimulationState>('idle')
  const [activeSpeaker, setActiveSpeaker] = useState<AiSimulationSpeaker>(null)
  const [part, setPart] = useState<AiSimulationPart | null>(null)
  const [topic, setTopic] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [speechElapsedSeconds, setSpeechElapsedSeconds] = useState(0)
  const [error, setError] = useState('')
  const recordsRef = useRef(records)
  const turnsRef = useRef<Turn[]>([])
  const sessionsRef = useRef<{ examiner: Session | null; candidate: Session | null }>({ examiner: null, candidate: null })
  const activeRef = useRef(false)
  const finishingRef = useRef(false)
  const phaseRef = useRef<SimulationPhase>('part1')
  const candidateAnswersRef = useRef(0)
  const turnRoleRef = useRef<AiSimulationSpeaker>(null)
  const turnIdRef = useRef<string | null>(null)
  const turnTextRef = useRef('')
  const turnCompleteRef = useRef(false)
  const pendingAudioRef = useRef(0)
  const finishAfterAudioRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const nextAudioTimeRef = useRef(0)
  const activeAudioStartRef = useRef<number | null>(null)
  const turnAudioStartSecondsRef = useRef(0)
  const turnAudioDurationSecondsRef = useRef(0)
  const pcmChunksRef = useRef<Uint8Array[]>([])
  const startedAtRef = useRef('')
  const startedTimeRef = useRef(0)
  const sessionIdRef = useRef('')
  const templateIdRef = useRef('')
  const templateTitleRef = useRef('')
  const partRef = useRef<AiSimulationPart | null>(null)
  const topicRef = useRef('')
  const cueCardRef = useRef<SimulationCueCard | undefined>(undefined)
  const stateRef = useRef<AiSimulationState>('idle')
  const finishRef = useRef<(status: 'completed' | 'stopped') => Promise<void>>(async () => {})

  useEffect(() => { recordsRef.current = records }, [records])
  useEffect(() => {
    if (state !== 'live' && state !== 'connecting') return
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedTimeRef.current) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [state])
  useEffect(() => {
    if (state !== 'live') return
    let frame = 0
    const updateClock = () => {
      const context = audioContextRef.current
      const startAt = activeAudioStartRef.current
      setSpeechElapsedSeconds(context && startAt !== null
        ? Math.max(0, context.currentTime - startAt)
        : 0)
      frame = window.requestAnimationFrame(updateClock)
    }
    frame = window.requestAnimationFrame(updateClock)
    return () => window.cancelAnimationFrame(frame)
  }, [state])
  useEffect(() => () => {
    void finishRef.current('stopped')
  }, [])

  function setCurrentState(next: AiSimulationState) {
    stateRef.current = next
    setState(next)
  }

  async function finishSimulation(finalStatus: 'completed' | 'stopped'): Promise<void> {
    if (finishingRef.current || !activeRef.current) return
    finishingRef.current = true
    activeRef.current = false
    finishAfterAudioRef.current = false
    setCurrentState('saving')
    setActiveSpeaker(null)

    for (const source of scheduledSourcesRef.current) {
      try { source.stop() } catch (caughtError) {
        if (!(caughtError instanceof DOMException && caughtError.name === 'InvalidStateError')) console.error('Unable to stop AI simulation playback.', caughtError)
      }
    }
    scheduledSourcesRef.current = []
    for (const session of Object.values(sessionsRef.current)) session?.close()
    sessionsRef.current = { examiner: null, candidate: null }
    const audioContext = audioContextRef.current
    audioContextRef.current = null
    if (audioContext && audioContext.state !== 'closed') {
      try { await audioContext.close() } catch (caughtError) { console.error('Unable to close AI simulation audio.', caughtError) }
    }

    const partValue = partRef.current
    const simulationTurns = turnsRef.current.filter((turn) => turn.text.trim())
    if (partValue && simulationTurns.length) {
      const id = sessionIdRef.current
      const audio = wavFromPcmChunks(pcmChunksRef.current)
      let audioAvailable = false
      if (audio) {
        try {
          await saveAiSimulationAudio(username, id, audio)
          audioAvailable = true
        } catch (caughtError) {
          console.error('Unable to save AI simulation audio.', caughtError)
          setError('The transcript was saved, but the audio recording could not be saved in this browser.')
        }
      }
      const record: AiSimulationRecord = {
        id,
        ...(templateIdRef.current ? { templateId: templateIdRef.current } : {}),
        ...(templateTitleRef.current ? { templateTitle: templateTitleRef.current } : {}),
        mode: 'ai-to-ai',
        part: partValue,
        topic: topicRef.current,
        startedAt: startedAtRef.current,
        completedAt: new Date().toISOString(),
        durationSeconds: Math.max(0, Math.round((Date.now() - startedTimeRef.current) / 1000)),
        status: finalStatus,
        turns: simulationTurns,
        audioAvailable,
        model: getProdiaLiveModel(),
      }
      const updated = [record, ...recordsRef.current.filter((item) => item.id !== id)]
      if (saveAiSimulations(username, updated)) {
        recordsRef.current = updated
        setRecords(updated)
      } else {
        setError('The simulation finished, but its transcript could not be saved on this device.')
      }
    }
    pcmChunksRef.current = []
    turnRoleRef.current = null
    turnIdRef.current = null
    turnTextRef.current = ''
    turnCompleteRef.current = false
    pendingAudioRef.current = 0
    finishAfterAudioRef.current = false
    setCurrentState('idle')
    setPart(null)
    partRef.current = null
    finishingRef.current = false
  }

  useEffect(() => { finishRef.current = finishSimulation })

  function beginTurn(role: 'examiner' | 'candidate') {
    if (turnRoleRef.current === role) return
    turnRoleRef.current = role
    turnIdRef.current = crypto.randomUUID()
    turnTextRef.current = ''
    turnCompleteRef.current = false
    activeAudioStartRef.current = null
    turnAudioStartSecondsRef.current = pcmChunksRef.current.reduce((total, chunk) => total + chunk.byteLength, 0) / 48000
    turnAudioDurationSecondsRef.current = 0
    setSpeechElapsedSeconds(0)
    setActiveSpeaker(role)
    const nextTurn: Turn = { id: turnIdRef.current, role, text: '', completedAt: '' }
    turnsRef.current = [...turnsRef.current, nextTurn]
    setTurns(turnsRef.current)
  }

  function updateCurrentTurn(text: string, complete = false) {
    const id = turnIdRef.current
    if (!id) return
    if (text) turnTextRef.current = mergeTranscriptText(turnTextRef.current, text)
    turnsRef.current = turnsRef.current.map((turn) => turn.id === id
      ? {
        ...turn,
        text: turnTextRef.current,
        ...(turnAudioDurationSecondsRef.current > 0 ? {
          audioStartSeconds: turnAudioStartSecondsRef.current,
          audioDurationSeconds: turnAudioDurationSecondsRef.current,
        } : {}),
        ...(complete ? { completedAt: new Date().toISOString() } : {}),
      }
      : turn)
    setTurns(turnsRef.current)
  }

  function sendPrompt(role: 'examiner' | 'candidate', text: string) {
    const session = sessionsRef.current[role]
    if (!session || !activeRef.current) return
    session.sendRealtimeInput({ text })
  }

  async function handleTurnComplete() {
    if (!turnCompleteRef.current || !turnRoleRef.current || !activeRef.current) return
    const role = turnRoleRef.current
    const text = turnTextRef.current.trim()
    updateCurrentTurn('', true)
    turnRoleRef.current = null
    turnIdRef.current = null
    turnTextRef.current = ''
    turnCompleteRef.current = false
    setActiveSpeaker(null)
    if (!text) {
      setError('One AI speaker returned no transcript. The simulation was stopped and saved if possible.')
      await finishRef.current('stopped')
      return
    }

    if (role === 'examiner') {
      if (phaseRef.current === 'ending') {
        if (pendingAudioRef.current > 0) finishAfterAudioRef.current = true
        else await finishRef.current('completed')
      } else {
        sendPrompt('candidate', `The examiner has just said: ${text}\nRespond as the IELTS candidate to the question or cue card. Speak only your answer.`)
      }
      return
    }

    candidateAnswersRef.current += 1
    const phase = phaseRef.current
    const selectedPart = partRef.current
    let examinerCue = ''
    if (phase === 'part1') {
      if (candidateAnswersRef.current >= 5) {
        phaseRef.current = 'ending'
        examinerCue = 'That completes the five Part 1 questions. Briefly thank the candidate and say the practice test is complete.'
      } else examinerCue = `The candidate answered: ${text}\nAsk the next distinct Part 1 question about ${topicRef.current}. Ask one question only.`
    } else if (phase === 'part2-long') {
      phaseRef.current = 'part2-followup'
      examinerCue = `The candidate has completed the Part 2 long turn. Ask one brief, relevant follow-up question about ${cueCardRef.current?.title ?? topicRef.current}.`
    } else if (phase === 'part2-followup') {
      phaseRef.current = 'ending'
      examinerCue = `The candidate answered: ${text}\nThank them and clearly close this Part 2 practice.`
    } else if (phase === 'part3') {
      if (candidateAnswersRef.current >= 5) {
        phaseRef.current = 'ending'
        examinerCue = 'That completes the five Part 3 discussion questions. Briefly thank the candidate and say the practice test is complete.'
      } else examinerCue = `The candidate answered: ${text}\nAsk the next distinct Part 3 discussion question related to ${topicRef.current}. Ask one question only.`
    } else if (phase === 'full-part1') {
      if (candidateAnswersRef.current >= 5) {
        phaseRef.current = 'full-part2'
        examinerCue = cueCardRef.current
          ? `The candidate has completed five Part 1 questions. Transition naturally to Part 2 and present this exact selected cue card titled "${cueCardRef.current.title}":\n${cueCardRef.current.prompt}\nGive one minute to prepare and invite a long turn.`
          : `The candidate has completed five Part 1 questions. Transition naturally to Part 2, randomly choose a fresh IELTS cue-card topic about ${topicRef.current}, and present it with three or four prompts. Give one minute to prepare and invite a long turn.`
      } else examinerCue = `The candidate answered: ${text}\nAsk the next distinct Part 1 question related to ${topicRef.current}. Ask one question only.`
    } else if (phase === 'full-part2') {
      phaseRef.current = 'full-part2-followup'
      examinerCue = `The candidate has completed the Part 2 long turn. Ask one brief, relevant follow-up question about ${cueCardRef.current?.title ?? topicRef.current}.`
    } else if (phase === 'full-part2-followup') {
      phaseRef.current = 'full-part3'
      candidateAnswersRef.current = 0
      examinerCue = `Transition naturally to Part 3. Ask the first abstract discussion question connected to ${topicRef.current}. Ask one question only.`
    } else if (phase === 'full-part3') {
      if (candidateAnswersRef.current >= 5) {
        phaseRef.current = 'ending'
        examinerCue = 'That completes the Part 3 discussion and the full test. Thank the candidate and say the practice test is complete.'
      } else examinerCue = `The candidate answered: ${text}\nAsk the next distinct Part 3 discussion question related to ${topicRef.current}. Ask one question only.`
    }
    if (!selectedPart || !examinerCue) {
      await finishRef.current('stopped')
      return
    }
    sendPrompt('examiner', examinerCue)
  }

  function handleServerMessage(role: 'examiner' | 'candidate', message: LiveServerMessage) {
    const content = message.serverContent
    if (!content || !activeRef.current) return
    const hasAudio = content.modelTurn?.parts?.some((item) => Boolean(item.inlineData?.data)) ?? false
    if (content.outputTranscription?.text || hasAudio) beginTurn(role)
    if (content.outputTranscription?.text) updateCurrentTurn(content.outputTranscription.text)

    for (const item of content.modelTurn?.parts ?? []) {
      if (!item.inlineData?.data) continue
      const audioContext = audioContextRef.current
      if (!audioContext) continue
      try {
        const pcm = base64ToArrayBuffer(item.inlineData.data)
        const mimeType = item.inlineData.mimeType ?? ''
        const sampleRate = Number(mimeType.match(/rate=(\d+)/i)?.[1]) || 24000
        const buffer = pcmSamplesToAudioBuffer(audioContext, pcm, sampleRate)
        const source = audioContext.createBufferSource()
        source.buffer = buffer
        source.connect(audioContext.destination)
        const startAt = Math.max(audioContext.currentTime + 0.025, nextAudioTimeRef.current)
        nextAudioTimeRef.current = startAt + buffer.duration
        if (activeAudioStartRef.current === null) activeAudioStartRef.current = startAt
        pendingAudioRef.current += 1
        pcmChunksRef.current.push(new Uint8Array(pcm).slice())
        turnAudioDurationSecondsRef.current += buffer.duration
        updateCurrentTurn('')
        scheduledSourcesRef.current.push(source)
        source.onended = () => {
          scheduledSourcesRef.current = scheduledSourcesRef.current.filter((scheduled) => scheduled !== source)
          pendingAudioRef.current = Math.max(0, pendingAudioRef.current - 1)
          if (finishAfterAudioRef.current && pendingAudioRef.current === 0 && activeRef.current) {
            finishAfterAudioRef.current = false
            void finishRef.current('completed')
          }
        }
        source.start(startAt)
      } catch (caughtError) {
        console.error('Unable to play Speakia AI Live simulation audio.', caughtError)
        setError('Audio playback failed. The simulation will continue with its transcript.')
      }
    }

    if (content.turnComplete) {
      turnCompleteRef.current = true
      // Start the next response while this turn's scheduled audio plays; nextAudioTimeRef preserves playback order.
      void handleTurnComplete()
    }
  }

  async function startSimulation(selectedPart: AiSimulationPart, selectedTopic: string, openingPrompt?: string, transcriptGuide?: string, selectedCueCard?: SimulationCueCard, templateId?: string, templateTitle?: string) {
    if (stateRef.current !== 'idle' || activeRef.current) return
    setError('')
    if (!apiKey.trim()) {
      setError('Add your Speakia AI key in Settings before starting an AI simulation.')
      return
    }
    const normalizedTopic = selectedTopic.trim().slice(0, 120)
      || selectedCueCard?.title.slice(0, 120)
      || 'everyday life and personal experiences'
    const simulationId = crypto.randomUUID()
    const startDate = new Date()
    sessionIdRef.current = simulationId
    templateIdRef.current = templateId ?? ''
    templateTitleRef.current = templateTitle ?? ''
    startedAtRef.current = startDate.toISOString()
    startedTimeRef.current = startDate.getTime()
    partRef.current = selectedPart
    topicRef.current = normalizedTopic
    cueCardRef.current = selectedCueCard
    phaseRef.current = selectedPart === 'full'
      ? 'full-part1'
      : selectedPart === 'part2'
        ? 'part2-long'
        : selectedPart
    candidateAnswersRef.current = 0
    turnsRef.current = []
    setTurns([])
    setElapsedSeconds(0)
    setSpeechElapsedSeconds(0)
    setPart(selectedPart)
    setTopic(normalizedTopic)
    pcmChunksRef.current = []
    activeRef.current = true
    finishingRef.current = false
    setCurrentState('connecting')

    try {
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      await audioContext.resume()
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const model = getProdiaLiveModel()
      const connect = (role: 'examiner' | 'candidate', voiceName: string) => client.live.connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          systemInstruction: role === 'examiner'
            ? examinerInstructions(selectedPart, normalizedTopic, selectedCueCard, transcriptGuide)
            : candidateInstructions(selectedPart, normalizedTopic, selectedCueCard, transcriptGuide),
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
        callbacks: {
          onmessage: (message) => handleServerMessage(role, message),
          onerror: (event) => {
            console.error(`Speakia AI Live ${role} simulation failed.`, event)
            setError(`The AI ${role} connection failed. Check the API key, model access, and network.`)
            void finishRef.current('stopped')
          },
          onclose: () => {
            if (activeRef.current) {
              setError(`The AI ${role} connection closed unexpectedly.`)
              void finishRef.current('stopped')
            }
          },
        },
      })
      const examinerConnection = connect('examiner', 'Aoede').then((session) => {
        if (activeRef.current) sessionsRef.current.examiner = session
        else session.close()
        return session
      })
      const candidateConnection = connect('candidate', 'Puck').then((session) => {
        if (activeRef.current) sessionsRef.current.candidate = session
        else session.close()
        return session
      })
      const [examinerSession, candidateSession] = await Promise.all([examinerConnection, candidateConnection])
      if (!activeRef.current) {
        examinerSession.close()
        candidateSession.close()
        sessionsRef.current = { examiner: null, candidate: null }
        return
      }
      nextAudioTimeRef.current = audioContext.currentTime
      setCurrentState('live')
      examinerSession.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: openingPrompt?.trim() || initialExaminerPrompt(selectedPart, normalizedTopic, selectedCueCard) }] }],
        turnComplete: true,
      })
    } catch (caughtError) {
      console.error('Unable to start the AI-to-AI IELTS simulation.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'The AI-to-AI simulation could not be started.')
      await finishRef.current('stopped')
    }
  }

  function savePracticeRecord(record: AiSimulationRecord): boolean {
    const updated = [record, ...recordsRef.current.filter((item) => item.id !== record.id)]
    if (!saveAiSimulations(username, updated)) return false
    recordsRef.current = updated
    setRecords(updated)
    return true
  }

  return {
    records,
    turns,
    state,
    activeSpeaker,
    part,
    topic,
    elapsedSeconds,
    speechElapsedSeconds,
    error,
    setError,
    startSimulation,
    savePracticeRecord,
    stopSimulation: () => void finishRef.current('stopped'),
  }
}
