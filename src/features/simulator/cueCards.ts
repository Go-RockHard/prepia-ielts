import { useEffect, useState } from 'react'
import { Type } from '@google/genai'
import { GoogleGenAI } from '@/lib/geminiClient'
import { getProdiaTextModel } from '@/lib/geminiModels'

export interface CueCardTopic {
  id: string
  title: string
  cueCard: string
}

const GENERATED_CUE_CARDS_KEY = 'speakia-generated-cue-cards-v1'
const GENERATED_CUE_CARDS_EVENT = 'speakia:generated-cue-cards-changed'

export const cueCardTopics: CueCardTopic[] = [
  { id: 'cue-place', title: 'A place you enjoy visiting', cueCard: 'Describe a place you enjoy visiting.\nYou should say:\n• where it is\n• how you found out about it\n• what you do there\nand explain why you enjoy visiting it.' },
  { id: 'cue-person', title: 'A person who inspired you', cueCard: 'Describe a person who inspired you.\nYou should say:\n• who this person is\n• how you know them\n• what they have achieved\nand explain why they inspire you.' },
  { id: 'cue-skill', title: 'A useful skill you learned', cueCard: 'Describe a useful skill you learned.\nYou should say:\n• what the skill is\n• when you learned it\n• how you learned it\nand explain why it is useful to you.' },
  { id: 'cue-event', title: 'A memorable event', cueCard: 'Describe a memorable event in your life.\nYou should say:\n• what happened\n• when and where it happened\n• who was with you\nand explain why you remember it.' },
  { id: 'cue-object', title: 'An object you use every day', cueCard: 'Describe an object you use every day.\nYou should say:\n• what it is\n• when you started using it\n• how it helps you\nand explain why it is important to you.' },
  { id: 'cue-book', title: 'A book that made an impression', cueCard: 'Describe a book that made a strong impression on you.\nYou should say:\n• what the book is about\n• when you read it\n• what you learned from it\nand explain why it was memorable.' },
  { id: 'cue-decision', title: 'An important decision', cueCard: 'Describe an important decision you made.\nYou should say:\n• what the decision was\n• when you made it\n• what influenced your choice\nand explain how you felt about the result.' },
  { id: 'cue-journey', title: 'An enjoyable journey', cueCard: 'Describe a journey you particularly enjoyed.\nYou should say:\n• where you went\n• how you travelled\n• who went with you\nand explain what made the journey enjoyable.' },
]

function isCueCardTopic(value: unknown): value is CueCardTopic {
  if (typeof value !== 'object' || value === null) return false
  const card = value as { id?: unknown; title?: unknown; cueCard?: unknown }
  return typeof card.id === 'string' && typeof card.title === 'string'
    && typeof card.cueCard === 'string' && card.title.trim().length > 0
    && card.title.length <= 100 && card.cueCard.trim().length > 0
    && card.cueCard.length <= 1000
}

function titleKey(title: string): string {
  return title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function similarTitle(left: string, right: string): boolean {
  const leftWords = new Set(titleKey(left).split(/\s+/).filter((word) => word.length > 2))
  const rightWords = new Set(titleKey(right).split(/\s+/).filter((word) => word.length > 2))
  const union = new Set([...leftWords, ...rightWords])
  if (!union.size) return false
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length
  return overlap / union.size >= 0.65
}

export function loadGeneratedCueCards(): CueCardTopic[] {
  try {
    const stored = localStorage.getItem(GENERATED_CUE_CARDS_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every(isCueCardTopic)) {
      console.warn('Saved generated cue cards are invalid and have been ignored.')
      return []
    }
    return parsed
  } catch (error) {
    console.error('Unable to load generated cue cards from browser storage.', error)
    return []
  }
}

export function useGeneratedCueCards(): CueCardTopic[] {
  const [cards, setCards] = useState(loadGeneratedCueCards)
  useEffect(() => {
    const refresh = () => setCards(loadGeneratedCueCards())
    const handleStorage = (event: StorageEvent) => {
      if (event.key === GENERATED_CUE_CARDS_KEY) refresh()
    }
    window.addEventListener(GENERATED_CUE_CARDS_EVENT, refresh)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(GENERATED_CUE_CARDS_EVENT, refresh)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])
  return cards
}

export async function generateAndSaveCueCard(apiKey: string, existingCards: CueCardTopic[], requestedTheme = ''): Promise<CueCardTopic> {
  if (!apiKey.trim()) throw new Error('Add your Speakia AI API key in Settings to generate a cue-card topic.')
  const currentCards = [...existingCards]
  const themeInstruction = requestedTheme.trim()
    ? `The candidate is interested in this theme: "${requestedTheme.trim()}". Make a fresh topic around that theme without duplicating or closely paraphrasing any existing topic.`
    : 'Choose an original, varied topic suitable for a candidate to answer from personal experience.'
  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  const response = await client.models.generateContent({
    model: getProdiaTextModel(),
    contents: `Create one original IELTS Speaking Part 2 cue card. ${themeInstruction}\nDo not choose any topic that is the same as or substantially similar to these existing topics:\n${JSON.stringify(currentCards.map(({ title, cueCard }) => ({ title, cueCard })))}\nReturn a concise candidate-facing task with exactly four "You should say" bullet points and a final "and explain" prompt. Keep it natural and answerable from personal experience. Return only the required JSON.`,
    config: {
      temperature: 0.9,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          cueCard: { type: Type.STRING },
        },
        required: ['title', 'cueCard'],
      },
    },
  })
  if (!response.text?.trim()) throw new Error('Speakia AI returned an empty cue card. Try again.')
  let generated: unknown
  try {
    generated = JSON.parse(response.text)
  } catch (error) {
    console.error('Speakia AI returned invalid JSON for a generated cue card.', error)
    throw new Error('Speakia AI returned an unreadable cue card. Try again.')
  }
  if (typeof generated !== 'object' || generated === null || Array.isArray(generated)
    || !('title' in generated) || !('cueCard' in generated)
    || typeof generated.title !== 'string' || !generated.title.trim()
    || generated.title.length > 100 || typeof generated.cueCard !== 'string'
    || !generated.cueCard.trim() || generated.cueCard.length > 1000) {
    throw new Error('Speakia AI returned an incomplete cue card. Try a different theme.')
  }
  const title = generated.title.trim()
  const cueCard = generated.cueCard.trim()
  const existingCardsAtSave = loadGeneratedCueCards()
  if ([...currentCards, ...existingCardsAtSave].some((card) => similarTitle(card.title, title)
    || card.cueCard.trim().toLocaleLowerCase() === cueCard.toLocaleLowerCase())) {
    throw new Error('Speakia AI suggested a topic that is already in your library. Generate another topic.')
  }
  const card: CueCardTopic = { id: crypto.randomUUID(), title, cueCard }
  const nextCards = [card, ...existingCardsAtSave]
  try {
    localStorage.setItem(GENERATED_CUE_CARDS_KEY, JSON.stringify(nextCards))
  } catch (error) {
    console.error('Unable to save the generated cue card to browser storage.', error)
    throw new Error('The new cue card was generated but could not be saved in this browser.')
  }
  window.dispatchEvent(new Event(GENERATED_CUE_CARDS_EVENT))
  return card
}
