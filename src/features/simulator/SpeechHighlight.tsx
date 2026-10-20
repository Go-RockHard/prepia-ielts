import type { ReactNode } from 'react'

export function SpeechHighlight({ text, wordIndex = -1 }: { text: string; wordIndex?: number }): ReactNode {
  let currentWord = 0
  return text.match(/\s+|\S+/g)?.map((part, index) => {
    if (/^\s+$/.test(part)) return part
    const isActive = currentWord === wordIndex
    currentWord += 1
    return isActive
      ? <mark className="speech-word-active" key={index} aria-current="true">{part}</mark>
      : <span key={index}>{part}</span>
  }) ?? text
}
