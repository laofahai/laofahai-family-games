export type Theme = 'fairy' | 'adventure' | 'school' | 'scifi' | 'daily' | 'funny'

export type Category = 'character' | 'place' | 'item' | 'twist'

export interface StoryCard {
  text: string
  category: Category
  theme: Theme
}

export type Duration = 60 | 90 | 120 | 180

export type Stage = 'intro' | 'setup' | 'countdown' | 'playing' | 'result'

export type Verdict = 'pass' | 'retry'

export interface RoundResult {
  cards: StoryCard[]
  verdict: Verdict
}

export interface SessionConfig {
  themes: Set<Theme>
  cardCount: 3 | 4 | 5
  durationSec: Duration
}

export const THEME_LABEL: Record<Theme, string> = {
  fairy: '童话',
  adventure: '冒险',
  school: '校园',
  scifi: '科幻',
  daily: '日常',
  funny: '搞笑',
}

export const CATEGORY_LABEL: Record<Category, string> = {
  character: '人物',
  place: '地点',
  item: '物品',
  twist: '转折',
}
