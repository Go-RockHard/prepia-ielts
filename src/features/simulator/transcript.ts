import type { TranscriptEntry } from './types'

const punctuationAtStart = /^[,.;:!?)}\]]/

export function mergeTranscriptText(current: string, incoming: string): string {
  const left = current.trimEnd()
  const right = incoming.trim()
  if (!right) return left
  if (!left) return right
  if (right.startsWith(left)) return right
  if (left.endsWith(right)) return left

  const maxOverlap = Math.min(left.length, right.length)
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (left.slice(-overlap).toLocaleLowerCase() === right.slice(0, overlap).toLocaleLowerCase()) {
      return `${left}${right.slice(overlap)}`
    }
  }

  return `${left}${punctuationAtStart.test(right) ? '' : ' '}${right}`
}

export function groupTranscriptTurns(transcript: TranscriptEntry[]): TranscriptEntry[] {
  return transcript.reduce<TranscriptEntry[]>((turns, entry) => {
    const text = entry.text.trim()
    if (!text) return turns
    const previous = turns[turns.length - 1]
    if (previous?.role === entry.role && entry.role !== 'assessment' && !previous.id && !entry.id) {
      turns[turns.length - 1] = {
        ...previous,
        text: mergeTranscriptText(previous.text, text),
      }
    } else {
      turns.push({ ...entry, text })
    }
    return turns
  }, [])
}
