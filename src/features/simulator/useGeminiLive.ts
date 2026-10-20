import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleGenAI, Modality, ThinkingLevel, type FunctionCall, type FunctionResponse, type LiveServerMessage, type Session, type Tool } from '@google/genai'
import { mergeTranscriptText } from './transcript'
import type { TranscriptEntry } from './types'

interface UseGeminiLiveOptions {
  apiKey: string
  systemInstruction: string
  voiceName?: string
  thinkingLevel?: ThinkingLevel
  openingPrompt?: string
  tools?: Tool[]
  onToolCall?: (functionCalls: FunctionCall[]) => Promise<FunctionResponse[]>
}

interface UseGeminiLiveResult {
  connected: boolean
  connecting: boolean
  status: string
  error: string
  transcript: TranscriptEntry[]
  candidateDraft: string
  activeExaminerTurnId: string | null
  examinerSpeechElapsedSeconds: number
  sendText: (text: string) => void
  sendInstruction: (text: string) => void
  sendAudio: (audio: Blob, mediaInstruction: string) => Promise<void>
  start: () => Promise<boolean>
  stop: () => Promise<{ recording: Blob; transcript: TranscriptEntry[] }>
}

function float32ToPcmBase64(samples: Float32Array): string {
  const buffer = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buffer)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function float32ToPcmBytes(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  return bytes
}

function pcmToWavBlob(chunks: Uint8Array[], sampleRate: number): Blob {
  const dataLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  const pcm = new Uint8Array(dataLength)
  let offset = 0
  for (const chunk of chunks) {
    pcm.set(chunk, offset)
    offset += chunk.byteLength
  }

  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const writeString = (position: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(position + index, value.charCodeAt(index))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)
  return new Blob([header, pcm], { type: 'audio/wav' })
}

function resampleTo16k(samples: Float32Array, sampleRate: number): Float32Array {
  if (sampleRate === 16000) return samples
  const targetLength = Math.max(1, Math.round(samples.length * 16000 / sampleRate))
  const resampled = new Float32Array(targetLength)
  for (let index = 0; index < targetLength; index += 1) {
    const sourceIndex = index * sampleRate / 16000
    const left = Math.floor(sourceIndex)
    const right = Math.min(left + 1, samples.length - 1)
    const fraction = sourceIndex - left
    resampled[index] = samples[left] + (samples[right] - samples[left]) * fraction
  }
  return resampled
}

function decodeBase64(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

function audioSampleRate(mimeType: string | undefined): number {
  const rate = mimeType?.match(/rate=(\d+)/)?.[1]
  return rate ? Number(rate) : 24000
}

export function useGeminiLive({ apiKey, systemInstruction, openingPrompt = 'Please begin the IELTS Speaking practice test now.', voiceName = 'Aoede', thinkingLevel, tools, onToolCall }: UseGeminiLiveOptions): UseGeminiLiveResult {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [candidateDraft, setCandidateDraft] = useState('')
  const [activeExaminerTurnId, setActiveExaminerTurnId] = useState<string | null>(null)
  const [examinerSpeechElapsedSeconds, setExaminerSpeechElapsedSeconds] = useState(0)
  const transcriptRef = useRef<TranscriptEntry[]>([])
  const candidateDraftRef = useRef('')
  const suppressInputTranscriptionRef = useRef(false)
  const transcriptCanMergeRef = useRef(false)
  const sessionRef = useRef<Session | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const inputContextRef = useRef<AudioContext | null>(null)
  const outputContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const workletRef = useRef<AudioWorkletNode | null>(null)
  const silentGainRef = useRef<GainNode | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const nextAudioTimeRef = useRef(0)
  const examinerSpeechStartRef = useRef<number | null>(null)
  const candidateAudioChunksRef = useRef<Uint8Array[]>([])
  const candidateSilenceSamplesRef = useRef(0)
  const pendingCandidateAudioRef = useRef<Blob[]>([])
  const pendingCandidateTranscriptIdsRef = useRef<string[]>([])
  const examinerAudioChunksRef = useRef<Uint8Array[]>([])
  const examinerAudioSampleRateRef = useRef(24000)
  const examinerTranscriptIdRef = useRef<string | null>(null)
  const pendingExaminerAudioRef = useRef<Blob[]>([])
  const examinerAudioCompleteRef = useRef(false)
  const examinerTranscriptCompleteRef = useRef(false)
  const audioContextCtor = window.AudioContext

  const attachAudio = useCallback((turnId: string, audio: Blob) => {
    const updated = transcriptRef.current.map((turn) => (
      turn.id === turnId ? { ...turn, audio } : turn
    ))
    transcriptRef.current = updated
    setTranscript(updated)
  }, [])

  const pairCandidateAudio = useCallback(() => {
    while (pendingCandidateAudioRef.current.length && pendingCandidateTranscriptIdsRef.current.length) {
      const audio = pendingCandidateAudioRef.current.shift()
      const turnId = pendingCandidateTranscriptIdsRef.current.shift()
      if (audio && turnId) attachAudio(turnId, audio)
    }
  }, [attachAudio])

  const finishCandidateAudio = useCallback(() => {
    if (!candidateAudioChunksRef.current.length) return
    pendingCandidateAudioRef.current.push(pcmToWavBlob(candidateAudioChunksRef.current, 16000))
    candidateAudioChunksRef.current = []
    candidateSilenceSamplesRef.current = 0
    pairCandidateAudio()
  }, [pairCandidateAudio])

  const finishExaminerAudio = useCallback(() => {
    if (examinerAudioChunksRef.current.length) {
      const audio = pcmToWavBlob(examinerAudioChunksRef.current, examinerAudioSampleRateRef.current)
      examinerAudioChunksRef.current = []
      if (examinerTranscriptIdRef.current) attachAudio(examinerTranscriptIdRef.current, audio)
      else pendingExaminerAudioRef.current.push(audio)
    }
    examinerAudioCompleteRef.current = true
  }, [attachAudio])

  const pairPendingExaminerAudio = useCallback(() => {
    const turnId = examinerTranscriptIdRef.current
    if (!turnId) return
    const audio = pendingExaminerAudioRef.current.shift()
    if (audio) attachAudio(turnId, audio)
  }, [attachAudio])

  const appendTranscript = useCallback((role: TranscriptEntry['role'], text: string, source?: TranscriptEntry['source']) => {
    const trimmed = text.trim()
    if (!trimmed) return null
    const current = transcriptRef.current
    const last = current[current.length - 1]
    let updated: TranscriptEntry[]
    if (transcriptCanMergeRef.current && last?.role === role && last.source === source) {
      const mergedText = mergeTranscriptText(last.text, trimmed)
      if (mergedText === last.text) return last.id ?? null
      updated = [...current]
      updated[updated.length - 1] = { ...last, text: mergedText }
    } else {
      updated = [...current, { id: crypto.randomUUID(), role, text: trimmed, ...(source ? { source } : {}) }]
    }
    transcriptCanMergeRef.current = true
    transcriptRef.current = updated
    setTranscript(updated)
    return updated[updated.length - 1].id ?? null
  }, [])

  const appendExaminerTranscript = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const currentId = examinerTranscriptIdRef.current
    const existingTurn = currentId
      ? transcriptRef.current.find((turn) => turn.id === currentId)
      : undefined
    if (existingTurn) {
      const mergedText = mergeTranscriptText(existingTurn.text, trimmed)
      if (mergedText !== existingTurn.text) {
        const updated = transcriptRef.current.map((turn) => (
          turn.id === currentId ? { ...turn, text: mergedText } : turn
        ))
        transcriptRef.current = updated
        setTranscript(updated)
      }
      return
    }

    transcriptCanMergeRef.current = false
    examinerTranscriptIdRef.current = appendTranscript('examiner', trimmed)
    setActiveExaminerTurnId(examinerTranscriptIdRef.current)
    setExaminerSpeechElapsedSeconds(0)
    examinerTranscriptCompleteRef.current = false
    pairPendingExaminerAudio()
  }, [appendTranscript, pairPendingExaminerAudio])

  const playAudioPart = useCallback((base64: string, mimeType?: string) => {
    const context = outputContextRef.current
    if (!context) return
    const pcm = decodeBase64(base64)
    const sampleRate = audioSampleRate(mimeType)
    examinerAudioCompleteRef.current = false
    examinerAudioSampleRateRef.current = sampleRate
    examinerAudioChunksRef.current.push(new Uint8Array(pcm).slice())
    const samples = new Int16Array(pcm)
    const audioBuffer = context.createBuffer(1, samples.length, sampleRate)
    const channel = audioBuffer.getChannelData(0)
    for (let index = 0; index < samples.length; index += 1) channel[index] = samples[index] / 32768

    const source = context.createBufferSource()
    source.buffer = audioBuffer
    source.connect(context.destination)
    const startAt = Math.max(context.currentTime + 0.025, nextAudioTimeRef.current)
    nextAudioTimeRef.current = startAt + audioBuffer.duration
    if (examinerSpeechStartRef.current === null) examinerSpeechStartRef.current = startAt
    scheduledSourcesRef.current.push(source)
    source.onended = () => {
      scheduledSourcesRef.current = scheduledSourcesRef.current.filter((item) => item !== source)
    }
    source.start(startAt)
  }, [])

  useEffect(() => {
    if (!connected) return
    const timer = window.setInterval(() => {
      const context = outputContextRef.current
      const startAt = examinerSpeechStartRef.current
      setExaminerSpeechElapsedSeconds(context && startAt !== null
        ? Math.max(0, context.currentTime - startAt)
        : 0)
    }, 60)
    return () => window.clearInterval(timer)
  }, [connected])

  const handleMessage = useCallback((message: LiveServerMessage) => {
    const functionCalls = message.toolCall?.functionCalls
    if (functionCalls?.length) {
      setStatus('Speakia is building your interactive lesson…')
      void (async () => {
        try {
          if (!onToolCall) throw new Error('This live conversation does not support that assistant tool.')
          const functionResponses = await onToolCall(functionCalls)
          const session = sessionRef.current
          if (!session) throw new Error('The live conversation ended before the assistant tool finished.')
          session.sendToolResponse({ functionResponses })
          setStatus('Your lesson is ready · continue speaking or type')
        } catch (caughtError) {
          console.error('Unable to complete a Speakia Live assistant tool call.', caughtError)
          setError(caughtError instanceof Error ? caughtError.message : 'The live assistant tool could not be completed.')
          const session = sessionRef.current
          if (!session) return
          try {
            session.sendToolResponse({
              functionResponses: functionCalls.map((call) => ({
                id: call.id,
                name: call.name,
                response: { error: caughtError instanceof Error ? caughtError.message : 'The assistant tool could not be completed.' },
              })),
            })
          } catch (responseError) {
            console.error('Unable to return the Speakia tool error to Gemini Live.', responseError)
            setError('The live assistant could not receive the lesson tool result. Please reconnect and try again.')
          }
        }
      })()
      return
    }
    if (message.setupComplete) {
      setStatus('Live examiner connected')
      return
    }
    const content = message.serverContent
    if (!content) return

    if (content.interrupted) {
      finishExaminerAudio()
      examinerTranscriptCompleteRef.current = true
      examinerSpeechStartRef.current = null
      setActiveExaminerTurnId(null)
      for (const source of scheduledSourcesRef.current) {
        try {
          source.stop()
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'InvalidStateError')) {
            console.error('Unable to stop interrupted Gemini audio.', error)
          }
        }
      }
      scheduledSourcesRef.current = []
      nextAudioTimeRef.current = outputContextRef.current?.currentTime ?? 0
    }

    if (suppressInputTranscriptionRef.current) {
      candidateDraftRef.current = ''
      setCandidateDraft('')
    } else if (content.inputTranscription?.text) {
      if (content.inputTranscription.finished === false) {
        candidateDraftRef.current = mergeTranscriptText(candidateDraftRef.current, content.inputTranscription.text)
        setCandidateDraft(candidateDraftRef.current)
      } else {
        const finalText = mergeTranscriptText(candidateDraftRef.current, content.inputTranscription.text)
        const candidateId = appendTranscript('candidate', finalText)
        if (candidateId) {
          pendingCandidateTranscriptIdsRef.current.push(candidateId)
          pairCandidateAudio()
        }
        transcriptCanMergeRef.current = false
        candidateDraftRef.current = ''
        setCandidateDraft('')
      }
    } else if (content.interimInputTranscription?.text) {
      setCandidateDraft(content.interimInputTranscription.text)
    }
    if (content.outputTranscription?.text) {
      appendExaminerTranscript(content.outputTranscription.text)
      if (content.outputTranscription.finished) examinerTranscriptCompleteRef.current = true
    }
    const parts = content.modelTurn?.parts ?? []
    for (const part of parts) {
      if (part.inlineData?.data) playAudioPart(part.inlineData.data, part.inlineData.mimeType)
      if (part.text && !content.outputTranscription?.text) {
        appendExaminerTranscript(part.text)
      }
    }
    if (content.turnComplete) {
      finishCandidateAudio()
      finishExaminerAudio()
      suppressInputTranscriptionRef.current = false
      if (content.outputTranscription?.finished !== false) examinerTranscriptCompleteRef.current = true
      transcriptCanMergeRef.current = false
      setStatus('Your examiner is listening')
    }
    if (examinerAudioCompleteRef.current && examinerTranscriptCompleteRef.current) {
      examinerTranscriptIdRef.current = null
      examinerAudioCompleteRef.current = false
      examinerTranscriptCompleteRef.current = false
      examinerSpeechStartRef.current = null
      setActiveExaminerTurnId(null)
      setExaminerSpeechElapsedSeconds(0)
    }
  }, [appendExaminerTranscript, appendTranscript, finishCandidateAudio, finishExaminerAudio, onToolCall, pairCandidateAudio, playAudioPart])

  const cleanupAudio = useCallback(async () => {
    suppressInputTranscriptionRef.current = false
    workletRef.current?.port.close()
    workletRef.current?.disconnect()
    sourceRef.current?.disconnect()
    silentGainRef.current?.disconnect()
    workletRef.current = null
    sourceRef.current = null
    silentGainRef.current = null
    micStreamRef.current?.getTracks().forEach((track) => track.stop())
    micStreamRef.current = null
    for (const source of scheduledSourcesRef.current) {
      try {
        source.stop()
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'InvalidStateError')) {
          console.error('Unable to stop Gemini audio during cleanup.', error)
        }
      }
    }
    scheduledSourcesRef.current = []
    const contexts = [inputContextRef.current, outputContextRef.current]
    inputContextRef.current = null
    outputContextRef.current = null
    await Promise.all(contexts.map(async (context) => {
      if (context && context.state !== 'closed') await context.close()
    }))
  }, [])

  const stop = useCallback(async () => {
    finishCandidateAudio()
    finishExaminerAudio()
    const recorder = mediaRecorderRef.current
    const recordingComplete = recorder?.state === 'recording'
      ? new Promise<void>((resolve) => {
          recorder.addEventListener('stop', () => resolve(), { once: true })
          recorder.stop()
        })
      : Promise.resolve()
    mediaRecorderRef.current = null
    sessionRef.current?.close()
    sessionRef.current = null
    setConnected(false)
    setConnecting(false)
    setActiveExaminerTurnId(null)
    setExaminerSpeechElapsedSeconds(0)
    examinerSpeechStartRef.current = null
    setStatus('Live session ended')
    await recordingComplete
    await cleanupAudio()
    const mimeType = recorder?.mimeType || recordingChunksRef.current[0]?.type || 'audio/webm'
    const recording = new Blob(recordingChunksRef.current, { type: mimeType })
    recordingChunksRef.current = []
    return { recording, transcript: transcriptRef.current }
  }, [cleanupAudio, finishCandidateAudio, finishExaminerAudio])

  const sendText = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const session = sessionRef.current
    if (!session || !connected) throw new Error('The live conversation is not connected. Please reconnect and try again.')
    session.sendClientContent({
      turns: [{
        role: 'user',
        parts: [{ text: trimmed }],
      }],
      turnComplete: true,
    })
    transcriptCanMergeRef.current = false
    appendTranscript('candidate', trimmed, 'text')
    setStatus('Text sent · waiting for your live reply')
  }, [appendTranscript, connected])

  const sendInstruction = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const session = sessionRef.current
    if (!session) throw new Error('The live conversation is not connected. Please reconnect and try again.')
    session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text: trimmed }] }],
      turnComplete: true,
    })
    setStatus('Moving to the next test question…')
  }, [])

  const sendAudio = useCallback(async (audio: Blob, mediaInstruction: string) => {
    const session = sessionRef.current
    if (!session) throw new Error('Connect to Speakia Coach before sharing audio.')
    if (!audio.size) throw new Error('The selected audio recording is empty.')
    const context = new audioContextCtor()
    try {
      const decoded = await context.decodeAudioData(await audio.arrayBuffer())
      const mono = new Float32Array(decoded.length)
      for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
        const samples = decoded.getChannelData(channel)
        for (let index = 0; index < samples.length; index += 1) mono[index] += samples[index] / decoded.numberOfChannels
      }
      const samples = resampleTo16k(mono, decoded.sampleRate)
      const samplesPerChunk = 1600
      suppressInputTranscriptionRef.current = true
      session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: mediaInstruction }] }],
        turnComplete: false,
      })
      setStatus('Sending recording to Speakia Coach…')
      for (let offset = 0; offset < samples.length; offset += samplesPerChunk) {
        if (sessionRef.current !== session) throw new Error('The live conversation ended before the audio finished sending.')
        session.sendRealtimeInput({
          audio: {
            data: float32ToPcmBase64(samples.subarray(offset, Math.min(offset + samplesPerChunk, samples.length))),
            mimeType: 'audio/pcm;rate=16000',
          },
        })
        if (offset + samplesPerChunk < samples.length) await new Promise((resolve) => window.setTimeout(resolve, 100))
      }
      if (sessionRef.current !== session) throw new Error('The live conversation ended before the audio finished sending.')
      session.sendRealtimeInput({ audioStreamEnd: true })
      setStatus('Recording shared · Speakia is listening')
    } catch (caughtError) {
      suppressInputTranscriptionRef.current = false
      console.error('Unable to decode or stream the shared audio recording to Gemini Live.', caughtError)
      throw new Error(caughtError instanceof Error
        ? `Speakia could not process this audio recording: ${caughtError.message}`
        : 'Speakia could not process this audio recording. Try another audio format.')
    } finally {
      await context.close()
    }
  }, [audioContextCtor])

  const start = useCallback(async () => {
    if (!apiKey.trim()) {
      setError('Enter your Gemini API key before connecting to the live examiner.')
      return false
    }
    if (sessionRef.current || connecting) return false
    setConnecting(true)
    setError('')
    setStatus('Requesting microphone permission…')
    transcriptRef.current = []
    setTranscript([])
    candidateDraftRef.current = ''
    setCandidateDraft('')
    transcriptCanMergeRef.current = false
    recordingChunksRef.current = []
    candidateAudioChunksRef.current = []
    candidateSilenceSamplesRef.current = 0
    pendingCandidateAudioRef.current = []
    pendingCandidateTranscriptIdsRef.current = []
    examinerAudioChunksRef.current = []
    examinerTranscriptIdRef.current = null
    examinerSpeechStartRef.current = null
    setActiveExaminerTurnId(null)
    setExaminerSpeechElapsedSeconds(0)
    pendingExaminerAudioRef.current = []
    examinerAudioCompleteRef.current = false
    examinerTranscriptCompleteRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      micStreamRef.current = stream
      const supportedMimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
        .find((mimeType) => MediaRecorder.isTypeSupported(mimeType))
      const recorder = new MediaRecorder(stream, supportedMimeType ? { mimeType: supportedMimeType } : undefined)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data)
      }
      recorder.start(1000)

      const inputContext = new audioContextCtor()
      const outputContext = new audioContextCtor()
      inputContextRef.current = inputContext
      outputContextRef.current = outputContext
      await Promise.all([inputContext.resume(), outputContext.resume()])
      await inputContext.audioWorklet.addModule('/pcm-capture-processor.js')

      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      setStatus('Connecting to Gemini Live…')
      const session = await client.live.connect({
        model: thinkingLevel ? 'gemini-3.8-live-extended-thinking' : 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
          ...(tools?.length ? { tools } : {}),
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          realtimeInputConfig: { automaticActivityDetection: { disabled: false } },
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
        callbacks: {
          onopen: () => setStatus('Connected · introducing the examiner…'),
          onmessage: handleMessage,
          onerror: (event) => {
            console.error('Gemini Live connection error.', event)
            setError('Gemini Live connection failed. Check the API key, model access, and network, then try again.')
          },
          onclose: () => {
            sessionRef.current = null
            setConnected(false)
            setConnecting(false)
            setStatus('Live session closed')
          },
        },
      })
      sessionRef.current = session

      const microphone = inputContext.createMediaStreamSource(stream)
      const capture = new AudioWorkletNode(inputContext, 'speakia-pcm-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'discrete',
      })
      const silentGain = inputContext.createGain()
      silentGain.gain.value = 0
      microphone.connect(capture)
      capture.connect(silentGain)
      silentGain.connect(inputContext.destination)
      capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (sessionRef.current !== session) return
        const samples = event.data
        let sum = 0
        for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index]
        const rms = Math.sqrt(sum / samples.length)
        if (rms > 0.018) {
          candidateAudioChunksRef.current.push(float32ToPcmBytes(resampleTo16k(samples, inputContext.sampleRate)))
          candidateSilenceSamplesRef.current = 0
        } else if (candidateAudioChunksRef.current.length
          && candidateSilenceSamplesRef.current < inputContext.sampleRate * 0.55) {
          candidateAudioChunksRef.current.push(float32ToPcmBytes(resampleTo16k(samples, inputContext.sampleRate)))
          candidateSilenceSamplesRef.current += samples.length
        }
        const pcm = resampleTo16k(samples, inputContext.sampleRate)
        session.sendRealtimeInput({
          audio: {
            data: float32ToPcmBase64(pcm),
            mimeType: 'audio/pcm;rate=16000',
          },
        })
      }
      sourceRef.current = microphone
      workletRef.current = capture
      silentGainRef.current = silentGain
      setConnected(true)
      setConnecting(false)
      setStatus('Live examiner connected · speak naturally')
      if (openingPrompt.trim()) {
        session.sendClientContent({
          turns: [{
            role: 'user',
            parts: [{ text: openingPrompt }],
          }],
          turnComplete: true,
        })
      }
      return true
    } catch (caughtError) {
      console.error('Unable to start the Gemini Live IELTS session.', caughtError)
      const message = caughtError instanceof Error ? caughtError.message : 'Unknown connection error.'
      setError(`Unable to start the live examiner: ${message}`)
      setConnecting(false)
      setConnected(false)
      sessionRef.current?.close()
      sessionRef.current = null
      const recorder = mediaRecorderRef.current
      if (recorder?.state === 'recording') recorder.stop()
      mediaRecorderRef.current = null
      void cleanupAudio().catch((cleanupError: unknown) => {
        console.error('Unable to release microphone after connection failure.', cleanupError)
      })
      return false
    }
  }, [apiKey, audioContextCtor, cleanupAudio, connecting, handleMessage, openingPrompt, systemInstruction, thinkingLevel, tools, voiceName])

  useEffect(() => () => {
    sessionRef.current?.close()
    const recorder = mediaRecorderRef.current
    if (recorder?.state === 'recording') recorder.stop()
    void cleanupAudio().catch((error: unknown) => {
      console.error('Unable to release audio resources when leaving the live practice.', error)
    })
  }, [cleanupAudio])

  return {
    connected,
    connecting,
    status,
    error,
    transcript,
    candidateDraft,
    activeExaminerTurnId,
    examinerSpeechElapsedSeconds,
    sendText,
    sendInstruction,
    sendAudio,
    start,
    stop,
  }
}
