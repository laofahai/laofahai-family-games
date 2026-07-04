export function remoteKnowYouPromptKey(round: number | undefined, text: string | undefined): string {
  return `${round ?? ''}:${text ?? ''}`
}
