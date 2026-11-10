import { useCallback, useEffect, useRef, useState } from 'react'
import { Type } from '@google/genai'
import { GoogleGenAI } from '@/lib/geminiClient'
import { getProdiaTextModel } from '@/lib/geminiModels'
import type { AiSimulationRecord } from '@/features/aiSimulation/types'
import type { LexicalCategory, LexicalEntry } from './lexicalEntries'

type LexicalEntryDraft = Omit<LexicalEntry, 'id' | 'custom'>
type CaptureState = 'idle' | 'saving' | 'saved' | 'error'

const categories: LexicalCategory[] = ['Word', 'Phrase', 'Expression', 'Collocation', 'Discourse marker']

function isLexicalCategory(value: unknown): value is LexicalCategory {
  return typeof value === 'string' && categories.some((category) => category === value)
}

function sentenceContaining(text: string, term: string): string {
  const index = text.toLocaleLowerCase().indexOf(term.toLocaleLowerCase())
  if (index < 0) return ''

  const before = text.slice(0, index)
  const after = text.slice(index)
  const sentenceStart = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'), before.lastIndexOf('\n')) + 1
  const sentenceEndings = ['.', '!', '?', '\n']
    .map((punctuation) => after.indexOf(punctuation))
    .filter((position) => position >= 0)
  const sentenceEnd = sentenceEndings.length ? index + Math.min(...sentenceEndings) + 1 : text.length
  return text.slice(sentenceStart, sentenceEnd).trim()
}

async function extractLexicalResources(apiKey: string, record: AiSimulationRecord): Promise<LexicalEntryDraft[]> {
  const candidateTurns = record.turns.filter((turn) => turn.role === 'candidate' && turn.text.trim())
  if (!candidateTurns.length) return []
  if (!apiKey.trim()) throw new Error('Add a Speakia AI API key in Settings to save vocabulary from this session.')

  const transcript = candidateTurns.map((turn, index) => `Candidate response ${index + 1}: ${turn.text.trim()}`).join('\n').slice(0, 12000)
  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  const response = await client.models.generateContent({
    model: getProdiaTextModel(),
    contents: `Identify up to 8 genuinely useful IELTS Speaking lexical resources used by the candidate in these responses. Prioritize precise vocabulary, collocations, natural phrases, expressions, and discourse markers that a learner could reuse. Exclude ordinary common words, examiner language, and anything not present verbatim in a candidate response. Return an empty list if there are no notable resources. For each item give the exact text span, its category, and a concise learner-friendly meaning.\n\nTopic: ${record.topic || record.templateTitle || 'IELTS Speaking'}\n${transcript}`,
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          resources: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                category: { type: Type.STRING, enum: categories },
                meaning: { type: Type.STRING },
                partOfSpeech: { type: Type.STRING },
              },
              required: ['term', 'category', 'meaning'],
            },
          },
        },
        required: ['resources'],
      },
    },
  })

  if (!response.text?.trim()) throw new Error('Speakia AI returned no vocabulary for this session.')
  let decoded: unknown
  try {
    decoded = JSON.parse(response.text)
  } catch (error) {
    console.error('Speakia AI returned invalid JSON while extracting session vocabulary.', error)
    throw new Error('Speakia AI returned unreadable vocabulary suggestions. Please retry.')
  }
  if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)
    || !('resources' in decoded) || !Array.isArray(decoded.resources)) {
    throw new Error('Speakia AI returned an invalid vocabulary list. Please retry.')
  }

  const resources: LexicalEntryDraft[] = []
  for (const resource of decoded.resources.slice(0, 8)) {
    if (typeof resource !== 'object' || resource === null || Array.isArray(resource)
      || !('term' in resource) || typeof resource.term !== 'string'
      || !('category' in resource) || !isLexicalCategory(resource.category)
      || !('meaning' in resource) || typeof resource.meaning !== 'string'
      || ('partOfSpeech' in resource && typeof resource.partOfSpeech !== 'string')) {
      throw new Error('Speakia AI returned an incomplete vocabulary suggestion. Please retry.')
    }

    const term = resource.term.trim()
    const meaning = resource.meaning.trim()
    if (!term || term.length > 100 || !meaning || meaning.length > 300) continue
    const sourceTurn = candidateTurns.find((turn) => turn.text.toLocaleLowerCase().includes(term.toLocaleLowerCase()))
    if (!sourceTurn) continue
    const example = sentenceContaining(sourceTurn.text, term)
    if (!example) continue
    resources.push({
      term,
      category: resource.category,
      meaning,
      example,
      topic: (record.topic || record.templateTitle || 'IELTS Speaking').slice(0, 100),
      ...(typeof resource.partOfSpeech === 'string' && resource.partOfSpeech.trim()
        ? { partOfSpeech: resource.partOfSpeech.trim().slice(0, 40) }
        : {}),
    })
  }
  return resources
}

export function useLexicalSessionCapture(
  records: AiSimulationRecord[],
  apiKey: string,
  lexicalTerms: string[],
  onAddLexicalEntry: (entry: LexicalEntryDraft) => LexicalEntry,
) {
  const seenRecordIds = useRef(new Set(records.map((record) => record.id)))
  const knownTerms = useRef(new Set(lexicalTerms.map((term) => term.trim().toLocaleLowerCase())))
  const failedRecord = useRef<AiSimulationRecord | null>(null)
  const [state, setState] = useState<CaptureState>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    knownTerms.current = new Set(lexicalTerms.map((term) => term.trim().toLocaleLowerCase()))
  }, [lexicalTerms])

  const captureRecord = useCallback(async (record: AiSimulationRecord) => {
    setState('saving')
    setMessage('Finding useful vocabulary from your session…')
    try {
      const suggestions = await extractLexicalResources(apiKey, record)
      let savedCount = 0
      for (const suggestion of suggestions) {
        const normalizedTerm = suggestion.term.trim().toLocaleLowerCase()
        if (knownTerms.current.has(normalizedTerm)) continue
        onAddLexicalEntry(suggestion)
        knownTerms.current.add(normalizedTerm)
        savedCount += 1
      }
      failedRecord.current = null
      setState('saved')
      setMessage(savedCount
        ? `${savedCount} lexical ${savedCount === 1 ? 'resource has' : 'resources have'} been added to your Lexical Vault.`
        : suggestions.length
          ? 'The useful vocabulary from this session is already in your Lexical Vault.'
          : 'No new standout vocabulary was found in the candidate responses.')
    } catch (error) {
      console.error('Unable to capture lexical resources from a speaking session.', error)
      failedRecord.current = record
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Session vocabulary could not be saved. Please retry.')
    }
  }, [apiKey, onAddLexicalEntry])

  useEffect(() => {
    const newRecords = records.filter((record) => !seenRecordIds.current.has(record.id))
    if (!newRecords.length) return
    newRecords.forEach((record) => seenRecordIds.current.add(record.id))
    void (async () => {
      for (const record of newRecords) await captureRecord(record)
    })()
  }, [captureRecord, records])

  const retry = useCallback(() => {
    if (failedRecord.current) void captureRecord(failedRecord.current)
  }, [captureRecord])

  return { state, message, retry }
}
