// 学习记录：给两个学习闯关游戏（一依局=闫一依、石榴镇=闫顺儿）记「做了多少、对了多少、
// 哪科是弱项、错题本」。本地优先（localStorage），每个游戏就是一个孩子，按游戏分开存。
// 答错进错题本，答对自动从错题本清掉（错题清零的成就感）。

export type LearnGame = 'yiyi' | 'shiliu'

// 学科标签：用题目的 kind 归类，给人看的名字
const SUBJECTS: Record<LearnGame, Record<string, string>> = {
  yiyi: { math: '数学', chinese: '语文', english: '英语', science: '科学', spark: '趣味' },
  shiliu: { detective: '推理', shop: '购物', vertical: '竖式', spark: '趣味' },
}

export const KID_NAME: Record<LearnGame, string> = { yiyi: '闫一依', shiliu: '闫顺儿' }

interface RawQuestion {
  id: string
  kind: string
  badge?: string
  title?: string
  prompt: string
  scenario?: string
  choices?: { id: string; text: string }[]
  answerChoices?: { id: string; text: string }[]
  answer: string
  explanation?: string
}

export interface Mistake {
  qid: string
  kind: string
  label: string
  prompt: string
  scenario?: string
  choices: { id: string; text: string }[]
  answer: string
  your?: string
  explanation?: string
  ts: number
  question: unknown // 原题完整对象，用于「错题重做」原样回放
}

interface SubjectStat {
  done: number
  correct: number
}
interface Stats {
  totalDone: number
  totalCorrect: number
  bySubject: Record<string, SubjectStat>
  daily: Record<string, SubjectStat> // key: YYYY-MM-DD
}

export interface LearnItem {
  question: RawQuestion
  correct: boolean
  your?: string
}

export interface SubjectRow {
  subject: string
  label: string
  done: number
  correct: number
  accuracy: number
  weak: boolean
}
export interface Report {
  game: LearnGame
  kid: string
  totalDone: number
  totalCorrect: number
  accuracy: number
  streak: number
  playedDays: number
  subjects: SubjectRow[]
  mistakes: Mistake[]
}

const MISTAKE_CAP = 80

function mKey(game: LearnGame): string {
  return `fg:learn:${game}:mistakes`
}
function sKey(game: LearnGame): string {
  return `fg:learn:${game}:stats`
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 隐私模式 / 容量满：静默忽略 */
  }
}

function loadMistakes(game: LearnGame): Mistake[] {
  const raw = safeGet(mKey(game))
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as Mistake[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}
function loadStats(game: LearnGame): Stats {
  const raw = safeGet(sKey(game))
  if (raw) {
    try {
      const s = JSON.parse(raw) as Stats
      if (s && typeof s === 'object') {
        return {
          totalDone: s.totalDone ?? 0,
          totalCorrect: s.totalCorrect ?? 0,
          bySubject: s.bySubject ?? {},
          daily: s.daily ?? {},
        }
      }
    } catch {
      /* 坏数据：重来 */
    }
  }
  return { totalDone: 0, totalCorrect: 0, bySubject: {}, daily: {} }
}

/** 本地日期 YYYY-MM-DD（按设备时区，符合「今天练了没」的直觉） */
function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function toMistake(game: LearnGame, item: LearnItem): Mistake {
  const q = item.question
  const choices = q.choices ?? q.answerChoices ?? []
  const label = q.badge ?? q.title ?? SUBJECTS[game][q.kind] ?? q.kind
  return {
    qid: q.id,
    kind: q.kind,
    label,
    prompt: q.prompt,
    scenario: q.scenario,
    choices,
    answer: q.answer,
    your: item.your,
    explanation: q.explanation,
    ts: Date.now(),
    question: q,
  }
}

/** 记录一局：累加统计；错的进错题本，对的把同题从错题本清掉。 */
export function recordSession(game: LearnGame, items: LearnItem[]): void {
  if (items.length === 0) return
  const stats = loadStats(game)
  let mistakes = loadMistakes(game)
  const day = today()
  if (!stats.daily[day]) stats.daily[day] = { done: 0, correct: 0 }

  for (const item of items) {
    const kind = item.question.kind
    if (!stats.bySubject[kind]) stats.bySubject[kind] = { done: 0, correct: 0 }
    stats.bySubject[kind].done += 1
    stats.daily[day].done += 1
    stats.totalDone += 1
    if (item.correct) {
      stats.bySubject[kind].correct += 1
      stats.daily[day].correct += 1
      stats.totalCorrect += 1
      // 这道题做对了：从错题本清掉（掌握了）
      mistakes = mistakes.filter((m) => m.qid !== item.question.id)
    } else {
      // 错题：去重后放到最前面（最近的错题在上）
      mistakes = mistakes.filter((m) => m.qid !== item.question.id)
      mistakes.unshift(toMistake(game, item))
    }
  }

  if (mistakes.length > MISTAKE_CAP) mistakes = mistakes.slice(0, MISTAKE_CAP)
  safeSet(sKey(game), JSON.stringify(stats))
  safeSet(mKey(game), JSON.stringify(mistakes))
}

/** 连续练习天数（含今天往前数，断了就停）。 */
function computeStreak(daily: Record<string, SubjectStat>): number {
  let streak = 0
  const d = new Date()
  for (;;) {
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const key = `${d.getFullYear()}-${m}-${day}`
    if (daily[key] && daily[key].done > 0) {
      streak += 1
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export function getReport(game: LearnGame): Report {
  const stats = loadStats(game)
  const mistakes = loadMistakes(game)
  const labels = SUBJECTS[game]
  const subjects: SubjectRow[] = Object.entries(stats.bySubject)
    .map(([subject, s]) => {
      const accuracy = s.done > 0 ? s.correct / s.done : 0
      return {
        subject,
        label: labels[subject] ?? subject,
        done: s.done,
        correct: s.correct,
        accuracy,
        // 弱项：做过至少 4 题且正确率低于 65%
        weak: s.done >= 4 && accuracy < 0.65,
      }
    })
    .sort((a, b) => a.accuracy - b.accuracy)
  return {
    game,
    kid: KID_NAME[game],
    totalDone: stats.totalDone,
    totalCorrect: stats.totalCorrect,
    accuracy: stats.totalDone > 0 ? stats.totalCorrect / stats.totalDone : 0,
    streak: computeStreak(stats.daily),
    playedDays: Object.values(stats.daily).filter((d) => d.done > 0).length,
    subjects,
    mistakes,
  }
}

/** 错题原题数组（用于「错题重做」直接喂给游戏）。 */
export function getMistakeQuestions<T>(game: LearnGame): T[] {
  return loadMistakes(game).map((m) => m.question as T)
}

export function hasMistakes(game: LearnGame): boolean {
  return loadMistakes(game).length > 0
}

export function clearMistakes(game: LearnGame): void {
  safeSet(mKey(game), JSON.stringify([]))
}
