import type { AdaptiveQuiz } from './adaptiveQuiz'
import type { AudioLesson } from './audioLesson'
import type { EmbeddedLearningModule } from './learningModules'
import type { InteractiveLesson } from './interactiveLesson'

const conversationStorageKey = 'speakia-coach-conversation-v1'
export const coachAssetsUpdatedEvent = 'speakia:coach-assets-updated'

export type CoachAsset =
  | { id: string; kind: 'lesson'; title: string; topic: string; summary: string; lesson: InteractiveLesson }
  | { id: string; kind: 'flashcards' | 'slides'; title: string; topic: string; summary: string; module: EmbeddedLearningModule }
  | { id: string; kind: 'audio-lesson'; title: string; topic: string; summary: string; audioLesson: AudioLesson }
  | { id: string; kind: 'quiz'; title: string; topic: string; summary: string; quiz: AdaptiveQuiz }

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
  return undefined
}

export function loadCoachAssets(): CoachAsset[] {
  try {
    const stored = localStorage.getItem(conversationStorageKey)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) throw new Error('Saved Speakia coach conversation is not a list.')
    return parsed.map(assetFromMessage).filter((asset): asset is CoachAsset => asset !== undefined).reverse()
  } catch (error) {
    console.error('Unable to load Speakia coach assets.', error)
    return []
  }
}

export function saveCoachAssetInteraction(assetId: string, interaction: string): void {
  let parsed: unknown
  try {
    const stored = localStorage.getItem(conversationStorageKey)
    if (!stored) throw new Error('The saved coach conversation is unavailable.')
    parsed = JSON.parse(stored)
  } catch (error) {
    console.error('Unable to read the saved coach conversation while saving asset progress.', error)
    throw new Error('This asset’s progress could not be saved.')
  }
  if (!Array.isArray(parsed)) throw new Error('This asset’s progress could not be saved because the coach conversation is invalid.')

  let changed = false
  const next = parsed.map((message) => {
    if (!isRecord(message)) return message
    const asset = message.lesson ?? message.embeddedModule
    if (!isRecord(asset) || asset.id !== assetId || !Array.isArray(asset.interactions)) return message
    if (asset.interactions.includes(interaction)) return message
    changed = true
    const interactions = [...asset.interactions.filter((item): item is string => typeof item === 'string').slice(-19), interaction]
    if (message.lesson === asset) return { ...message, lesson: { ...asset, interactions } }
    return { ...message, embeddedModule: { ...asset, interactions } }
  })
  if (!changed) return

  try {
    localStorage.setItem(conversationStorageKey, JSON.stringify(next))
    window.dispatchEvent(new Event(coachAssetsUpdatedEvent))
  } catch (error) {
    console.error('Unable to save Speakia coach asset progress.', error)
    throw new Error('This asset’s progress could not be saved on this device.')
  }
}
