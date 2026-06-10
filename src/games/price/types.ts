export type PriceCategory =
  | 'snack'
  | 'toy'
  | 'digital'
  | 'beauty'
  | 'daily'
  | 'food'
  | 'ticket'
  | 'big'

export interface PriceItem {
  name: string
  /** 真实参考价，单位元 */
  price: number
  unit?: string
  /** 揭晓时显示的趣味说明 */
  note?: string
  category: PriceCategory
}

export const CATEGORY_LABEL: Record<PriceCategory, string> = {
  snack: '零食饮品',
  toy: '玩具潮玩',
  digital: '数码电器',
  beauty: '美妆服饰',
  daily: '日用生鲜',
  food: '餐饮小吃',
  ticket: '票务出行',
  big: '大件离谱',
}

export type PlayerId = 'dad' | 'mom' | 'bigSis' | 'lilSis'

export interface PlayerInfo {
  id: PlayerId
  name: string
  emoji: string
}

export const PLAYERS: PlayerInfo[] = [
  { id: 'dad', name: '爸爸', emoji: '👨‍💻' },
  { id: 'mom', name: '妈妈', emoji: '🛍️' },
  { id: 'bigSis', name: '姐姐', emoji: '🎤' },
  { id: 'lilSis', name: '妹妹', emoji: '🎀' },
]

export const PLAYER_MAP: Record<PlayerId, PlayerInfo> = Object.fromEntries(
  PLAYERS.map((p) => [p.id, p])
) as Record<PlayerId, PlayerInfo>

export type RoundCount = 5 | 8 | 12

export type Stage = 'intro' | 'setup' | 'guessing' | 'reveal' | 'result'

export interface RoundRecord {
  item: PriceItem
  guesses: Partial<Record<PlayerId, number>>
  /** 本轮赢家（可并列） */
  winners: PlayerId[]
  /** 赢家是否在 ±10% 内（拿双倍分） */
  sharp: boolean
}
