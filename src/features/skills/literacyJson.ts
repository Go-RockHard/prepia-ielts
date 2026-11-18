export function extractJsonObject(text: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const start = trimmed.indexOf('{')
  if (start < 0) throw new Error('The model response did not contain a JSON object.')
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < trimmed.length; index += 1) {
    const character = trimmed[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === '{') depth += 1
    else if (character === '}') {
      depth -= 1
      if (depth === 0) return trimmed.slice(start, index + 1)
    }
  }
  throw new Error('The model response ended before the JSON object was complete.')
}

export function parseJsonObject(text: string): unknown {
  const objectText = extractJsonObject(text)
  try {
    return JSON.parse(objectText) as unknown
  } catch (initialError) {
    let repaired = ''
    let inString = false
    let escaped = false
    for (let index = 0; index < objectText.length; index += 1) {
      const character = objectText[index]
      if (inString) {
        repaired += character
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === '"') inString = false
        continue
      }
      if (character === '"') inString = true
      if (character === ',') {
        let next = index + 1
        while (next < objectText.length && /\s/.test(objectText[next])) next += 1
        if (objectText[next] === '}' || objectText[next] === ']') continue
      }
      repaired += character
    }
    if (repaired === objectText) throw initialError
    try {
      return JSON.parse(repaired) as unknown
    } catch (repairError) {
      throw new Error(`The model response contained malformed JSON: ${repairError instanceof Error ? repairError.message : 'unrecognized JSON syntax'}`)
    }
  }
}

export function completeGeneratedQuestionShape(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  const question = value as Record<string, unknown>
  const type = question.type
  if (Array.isArray(question.gaps)) {
    return {
      ...question,
      gaps: question.gaps.map((value, index) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
        const gap = value as Record<string, unknown>
        return {
          ...gap,
          id: typeof gap.id === 'string' && gap.id.trim() ? gap.id.trim() : `gap-${index + 1}`,
          label: typeof gap.label === 'string' && gap.label.trim() ? gap.label.trim() : `Answer ${index + 1}`,
        }
      }),
    }
  }
  if (Array.isArray(question.items)) {
    return {
      ...question,
      items: question.items.map((value, index) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
        const item = value as Record<string, unknown>
        return {
          ...item,
          id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `item-${index + 1}`,
          ...(type === 'labeling' || type === 'flow-chart'
            ? { label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : `Label ${index + 1}` }
            : {}),
        }
      }),
    }
  }
  return question
}
