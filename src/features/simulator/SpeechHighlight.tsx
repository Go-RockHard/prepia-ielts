import type { ReactNode } from 'react'

export function SpeechHighlight({ text, wordIndex = -1, search = '', focusSearchMatch = false }: { text: string; wordIndex?: number; search?: string; focusSearchMatch?: boolean }): ReactNode {
  const searchTerms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  let currentWord = 0
  let hasFocusedSearchMatch = false
  return text.match(/\s+|\S+/g)?.map((part, index) => {
    if (/^\s+$/.test(part)) return part
    const isActive = currentWord === wordIndex
    const isSearchMatch = searchTerms.some((term) => part.toLocaleLowerCase().includes(term))
    const isFocusedSearchMatch = focusSearchMatch && isSearchMatch && !hasFocusedSearchMatch
    if (isFocusedSearchMatch) hasFocusedSearchMatch = true
    currentWord += 1
    return isActive
      ? <mark className={`speech-word-active${isSearchMatch ? ' speech-word-search-match' : ''}`} key={index} aria-current="true" tabIndex={isFocusedSearchMatch ? -1 : undefined}>{part}</mark>
      : isSearchMatch
        ? <mark className="speech-word-search-match" key={index} tabIndex={isFocusedSearchMatch ? -1 : undefined}>{part}</mark>
      : <span key={index}>{part}</span>
  }) ?? text
}
