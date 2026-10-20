export interface TimedTranscriptTurn {
  text: string
  audioStartSeconds?: number
  audioDurationSeconds?: number
}

export function wordIndexAtElapsed(text: string, elapsedSeconds: number, durationSeconds?: number): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  if (!wordCount || elapsedSeconds < 0) return -1
  const progress = durationSeconds && durationSeconds > 0
    ? elapsedSeconds / durationSeconds
    : elapsedSeconds * 2.7 / wordCount
  return Math.max(0, Math.min(wordCount - 1, Math.floor(progress * wordCount)))
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
