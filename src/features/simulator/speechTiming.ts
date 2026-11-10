export interface TimedTranscriptTurn {
  text: string
  audioStartSeconds?: number
  audioDurationSeconds?: number
}

function wordTimingWeight(word: string): number {
  const letters = word.toLocaleLowerCase().match(/[a-z]+/g)?.join('') ?? word
  const syllables = Math.max(1, (letters.match(/[aeiouy]+/g) ?? []).length
    - (/[aeiou]e$/i.test(letters) ? 1 : 0)
    + (/[^aeiou]le$/i.test(letters) ? 1 : 0))
  const punctuation = /[.!?…]["')\]]*$/.test(word) ? 0.7
    : /[,;:]["')\]]*$/.test(word) ? 0.3
      : 0
  return 0.55 + syllables * 0.45 + punctuation
}

export function wordIndexAtElapsed(text: string, elapsedSeconds: number, durationSeconds?: number): number {
  const words = text.match(/\S+/g) ?? []
  if (!words.length || elapsedSeconds < 0) return -1
  const weights = words.map(wordTimingWeight)
  const totalWeight = weights.reduce((total, weight) => total + weight, 0)
  const elapsed = durationSeconds && durationSeconds > 0
    ? elapsedSeconds / durationSeconds * totalWeight
    : elapsedSeconds * 2.7
  let offset = 0
  for (let index = 0; index < weights.length; index += 1) {
    offset += weights[index]
    if (elapsed < offset) return index
  }
  return words.length - 1
}

export function lastWordIndex(text: string): number {
  return Math.max(-1, (text.match(/\S+/g)?.length ?? 0) - 1)
}

export function transcriptPositionAtTime(
  turns: TimedTranscriptTurn[],
  currentTime: number,
  totalDuration: number,
): { turnIndex: number; wordIndex: number } | null {
  if (turns.length === 0 || currentTime < 0) return null
  const hasTiming = turns.every((turn) =>
    typeof turn.audioStartSeconds === 'number'
    && Number.isFinite(turn.audioStartSeconds)
    && typeof turn.audioDurationSeconds === 'number'
    && Number.isFinite(turn.audioDurationSeconds)
    && turn.audioDurationSeconds > 0)

  if (hasTiming) {
    const turnIndex = turns.findIndex((turn) =>
      currentTime >= turn.audioStartSeconds!
      && currentTime < turn.audioStartSeconds! + turn.audioDurationSeconds!)
    if (turnIndex < 0) return null
    const turn = turns[turnIndex]
    return {
      turnIndex,
      wordIndex: wordIndexAtElapsed(turn.text, currentTime - turn.audioStartSeconds!, turn.audioDurationSeconds),
    }
  }

  if (!Number.isFinite(totalDuration) || totalDuration <= 0) return null
  const weights = turns.map((turn) => Math.max(1, turn.text.trim().split(/\s+/).filter(Boolean).length))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let offset = 0
  for (let turnIndex = 0; turnIndex < turns.length; turnIndex += 1) {
    const duration = totalDuration * weights[turnIndex] / totalWeight
    if (currentTime >= offset && currentTime < offset + duration) {
      return {
        turnIndex,
        wordIndex: wordIndexAtElapsed(turns[turnIndex].text, currentTime - offset, duration),
      }
    }
    offset += duration
  }
  return null
}
