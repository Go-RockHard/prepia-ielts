export type CoachMediaShareRequest =
  | { kind: 'audio'; audio: Blob; title: string }
  | { kind: 'youtube'; url: string; title: string }

export function shareAudioWithCoach(audio: Blob, title: string): void {
  window.dispatchEvent(new CustomEvent<CoachMediaShareRequest>('speakia:coach-share-audio', {
    detail: { kind: 'audio', audio, title },
  }))
}

export function shareYoutubeWithCoach(url: string, title: string): void {
  window.dispatchEvent(new CustomEvent<CoachMediaShareRequest>('speakia:coach-share-audio', {
    detail: { kind: 'youtube', url, title },
  }))
}
