export const MIN_PRICE_REMOTE_MEMBERS = 3

export function canStartPriceRemote(memberCount: number): boolean {
  return memberCount >= MIN_PRICE_REMOTE_MEMBERS
}

export function parsePositivePriceGuess(input: string | number): number | null {
  const value = Number(input)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function remotePricePromptKey(round: number | undefined, name: string | undefined): string {
  return `${round ?? ''}:${name ?? ''}`
}
