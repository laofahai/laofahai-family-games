export interface DrawMemberSeat {
  seat: number
}

export function nextDrawerSeat(members: readonly DrawMemberSeat[], currentSeat: number): number {
  if (members.length === 0) return -1
  const currentIndex = members.findIndex((m) => m.seat === currentSeat)
  if (currentIndex < 0) return members[0].seat
  return members[(currentIndex + 1) % members.length].seat
}

export function roundAfterWordSwap(currentRound: number): number {
  return currentRound
}
