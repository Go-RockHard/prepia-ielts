import type { AdaptiveQuiz } from './adaptiveQuiz'
import type { AudioLesson } from './audioLesson'
import type { EmbeddedLearningModule } from './learningModules'
import type { InteractiveLesson } from './interactiveLesson'
import { isInfographic, type Infographic } from './infographic'

const conversationKeys = (platform: 'speaking' | 'writing') => platform === 'writing'
  ? { legacy: 'writia-assistant-conversation-v1', sessions: 'writia-assistant-sessions-v1' }
  : { legacy: 'speakia-coach-conversation-v1', sessions: 'speakia-coach-sessions-v1' }
export const coachAssetsUpdatedEvent = 'speakia:coach-assets-updated'

export type CoachAsset =
  | { id: string; kind: 'lesson'; title: string; topic: string; summary: string; lesson: InteractiveLesson }
  | { id: string; kind: 'flashcards' | 'slides'; title: string; topic: string; summary: string; module: EmbeddedLearningModule }
  | { id: string; kind: 'audio-lesson'; title: string; topic: string; summary: string; audioLesson: AudioLesson }
  | { id: string; kind: 'quiz'; title: string; topic: string; summary: string; quiz: AdaptiveQuiz }
  | { id: string; kind: 'infographic'; title: string; topic: string; summary: string; infographic: Infographic }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isInteractiveLesson(value: unknown): value is InteractiveLesson {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.topic === 'string'
    && typeof value.summary === 'string'
    && typeof value.html === 'string'
    && Array.isArray(value.interactions)
    && value.interactions.every((interaction) => typeof interaction === 'string')
}

function isEmbeddedModule(value: unknown): value is EmbeddedLearningModule {
  return isRecord(value)
    && (value.kind === 'flashcards' || value.kind === 'slides')
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.topic === 'string'
    && typeof value.summary === 'string'
    && typeof value.html === 'string'
    && Array.isArray(value.items)
    && Array.isArray(value.interactions)
    && value.interactions.every((interaction) => typeof interaction === 'string')
}

function isAdaptiveQuiz(value: unknown): value is AdaptiveQuiz {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.topic === 'string'
    && Array.isArray(value.questions)
}

function isAudioLesson(value: unknown): value is AudioLesson {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.topic === 'string'
    && typeof value.summary === 'string'
    && typeof value.transcript === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.voice === 'string'
    && typeof value.model === 'string'
}

function assetFromMessage(message: unknown): CoachAsset | undefined {
  if (!isRecord(message) || message.role !== 'assistant') return undefined
  if (isInteractiveLesson(message.lesson)) {
    return {
      id: message.lesson.id,
      kind: 'lesson',
      title: message.lesson.title,
      topic: message.lesson.topic,
      summary: message.lesson.summary,
      lesson: message.lesson,
    }
  }
  if (isAudioLesson(message.audioLesson)) {
    return {
      id: message.audioLesson.id,
      kind: 'audio-lesson',
      title: message.audioLesson.title,
      topic: message.audioLesson.topic,
      summary: message.audioLesson.summary,
      audioLesson: message.audioLesson,
    }
  }
  if (isEmbeddedModule(message.embeddedModule)) {
    return {
      id: message.embeddedModule.id,
      kind: message.embeddedModule.kind,
      title: message.embeddedModule.title,
      topic: message.embeddedModule.topic,
      summary: message.embeddedModule.summary,
      module: message.embeddedModule,
    }
  }
  if (isAdaptiveQuiz(message.quiz)) {
    return {
      id: message.quiz.id,
      kind: 'quiz',
      title: message.quiz.title,
      topic: message.quiz.topic,
      summary: `${message.quiz.questions.length} interactive questions about ${message.quiz.topic}.`,
      quiz: message.quiz,
    }
  }
  if (isInfographic(message.infographic)) {
    return {
      id: message.infographic.id,
      kind: 'infographic',
      title: message.infographic.title,
      topic: message.infographic.topic,
      summary: message.infographic.summary,
      infographic: message.infographic,
    }
  }
  return undefined
}

export function loadCoachAssets(platform: 'speaking' | 'writing' = 'speaking'): CoachAsset[] {
  const keys = conversationKeys(platform)
  const assets = new Map<string, CoachAsset>()
  const addMessages = (messages: unknown[]) => {
    for (const message of [...messages].reverse()) {
      const asset = assetFromMessage(message)
      if (asset && !assets.has(asset.id)) assets.set(asset.id, asset)
    }
  }
  try {
    const storedSessions = localStorage.getItem(keys.sessions)
    if (storedSessions) {
      const parsed: unknown = JSON.parse(storedSessions)
      if (!isRecord(parsed) || !Array.isArray(parsed.conversations)) {
        throw new Error(`Saved ${platform === 'writing' ? 'Writia assistant' : 'Speakia coach'} sessions are not in a supported format.`)
      }
      const conversations = parsed.conversations.filter((conversation): conversation is Record<string, unknown> => (
        isRecord(conversation) && Array.isArray(conversation.messages)
      )).sort((left, right) => String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? '')))
      conversations.forEach((conversation) => addMessages(conversation.messages as unknown[]))
    }
  } catch (error) {
    console.error(`Unable to load ${platform === 'writing' ? 'Writia Assistant' : 'Speakia Coach'} session assets.`, error)
  }
  try {
    const storedConversation = localStorage.getItem(keys.legacy)
    if (storedConversation) {
      const parsed: unknown = JSON.parse(storedConversation)
      if (!Array.isArray(parsed)) throw new Error(`Saved ${platform === 'writing' ? 'Writia Assistant' : 'Speakia Coach'} conversation is not a list.`)
      addMessages(parsed)
    }
  } catch (error) {
    console.error(`Unable to load legacy ${platform === 'writing' ? 'Writia Assistant' : 'Speakia Coach'} assets.`, error)
  }
  return [...assets.values()]
}

export function saveCoachAssetInteraction(assetId: string, interaction: string, platform: 'speaking' | 'writing' = 'speaking'): void {
  const keys = conversationKeys(platform)
  let storedSessions: unknown
  let storedConversation: unknown
  try {
    const sessionsRaw = localStorage.getItem(keys.sessions)
    const conversationRaw = localStorage.getItem(keys.legacy)
    storedSessions = sessionsRaw ? JSON.parse(sessionsRaw) : null
    storedConversation = conversationRaw ? JSON.parse(conversationRaw) : null
  } catch (error) {
    console.error(`Unable to read saved ${platform === 'writing' ? 'Writia Assistant' : 'Speakia Coach'} sessions while saving asset progress.`, error)
    throw new Error('This asset’s progress could not be saved.')
  }

  let found = false
  let changed = false
  const updateMessages = (messages: unknown[]) => messages.map((message) => {
    if (!isRecord(message)) return message
    const asset = message.lesson ?? message.embeddedModule
    if (!isRecord(asset) || asset.id !== assetId || !Array.isArray(asset.interactions)) return message
    found = true
    if (asset.interactions.includes(interaction)) return message
    changed = true
    const interactions = [...asset.interactions.filter((item): item is string => typeof item === 'string').slice(-19), interaction]
    if (message.lesson === asset) return { ...message, lesson: { ...asset, interactions } }
    return { ...message, embeddedModule: { ...asset, interactions } }
  })

  let nextSessions: Record<string, unknown> | null = null
  if (storedSessions !== null) {
    if (!isRecord(storedSessions) || !Array.isArray(storedSessions.conversations)) {
      throw new Error('This asset’s progress could not be saved because coach sessions are invalid.')
    }
    nextSessions = {
      ...storedSessions,
      conversations: storedSessions.conversations.map((conversation) => {
        if (!isRecord(conversation) || !Array.isArray(conversation.messages)) return conversation
        return { ...conversation, messages: updateMessages(conversation.messages) }
      }),
    }
  }

  let nextConversation: unknown = storedConversation
  if (storedConversation !== null) {
    if (!Array.isArray(storedConversation)) {
      throw new Error('This asset’s progress could not be saved because the coach conversation is invalid.')
    }
    nextConversation = updateMessages(storedConversation)
  }
  if (!found) throw new Error('This asset is no longer available in the saved coach conversations.')
  if (!changed) return

  try {
    if (nextSessions) localStorage.setItem(keys.sessions, JSON.stringify(nextSessions))
    if (nextConversation) localStorage.setItem(keys.legacy, JSON.stringify(nextConversation))
    window.dispatchEvent(new Event(coachAssetsUpdatedEvent))
  } catch (error) {
    console.error(`Unable to save ${platform === 'writing' ? 'Writia Assistant' : 'Speakia Coach'} asset progress.`, error)
    throw new Error('This asset’s progress could not be saved on this device.')
  }
}
