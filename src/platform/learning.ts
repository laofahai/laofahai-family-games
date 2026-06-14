// 学习记录：给两个学习闯关游戏（一依局=闫一依、石榴镇=闫顺儿）记「做了多少、对了多少、
// 哪科是弱项、错题本」。本地优先（localStorage），每个游戏就是一个孩子，按游戏分开存。
// 答错进错题本，答对自动从错题本清掉（错题清零的成就感）。
// 连了「云端码」的孩子，记录后整份上推、进场/打开小报时下拉，跟着孩子换设备。

import { pullLearn, pushLearn } from './cloud'
import { getSyncCode } from './progress'

export type LearnGame = 'yiyi' | 'shiliu'

// 学习游戏对应哪个孩子（家庭成员 id）——错题本/统计跟着这个孩子的「个人码」走
export const KID_PLAYER: Record<LearnGame, string> = { yiyi: 'yiyi', shiliu: 'shuner' }

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
  maxStreak?: number // 历史最高单局连对（给「连击火力」勋章）
  fullSessions?: number // 全对的局数（≥5 题且一题没错）
  defeated?: number // 累计「翻盘」数：把错题本里的题做对、清掉的次数
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
  maxStreak: number
  fullSessions: number
  defeated: number
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
          maxStreak: s.maxStreak ?? 0,
          fullSessions: s.fullSessions ?? 0,
          defeated: s.defeated ?? 0,
        }
      }
    } catch {
      /* 坏数据：重来 */
    }
  }
  return { totalDone: 0, totalCorrect: 0, bySubject: {}, daily: {}, maxStreak: 0, fullSessions: 0, defeated: 0 }
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
  const wasMistake = new Set(mistakes.map((m) => m.qid)) // 本局开始时错题本里有哪些
  const day = today()
  if (!stats.daily[day]) stats.daily[day] = { done: 0, correct: 0 }

  let run = 0 // 本局当前连对
  let sessionBest = 0 // 本局最高连对
  let sessionCorrect = 0
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
      sessionCorrect += 1
      run += 1
      if (run > sessionBest) sessionBest = run
      // 这道题原来在错题本里、现在做对了 = 翻盘一次
      if (wasMistake.has(item.question.id)) stats.defeated = (stats.defeated ?? 0) + 1
      // 从错题本清掉（掌握了）
      mistakes = mistakes.filter((m) => m.qid !== item.question.id)
    } else {
      run = 0
      // 错题：去重后放到最前面（最近的错题在上）
      mistakes = mistakes.filter((m) => m.qid !== item.question.id)
      mistakes.unshift(toMistake(game, item))
    }
  }
  if (sessionBest > (stats.maxStreak ?? 0)) stats.maxStreak = sessionBest
  if (items.length >= 5 && sessionCorrect === items.length) {
    stats.fullSessions = (stats.fullSessions ?? 0) + 1 // 满分局
  }

  if (mistakes.length > MISTAKE_CAP) mistakes = mistakes.slice(0, MISTAKE_CAP)
  safeSet(sKey(game), JSON.stringify(stats))
  safeSet(mKey(game), JSON.stringify(mistakes))
  void pushBlobToCloud(game) // 连了云就顺手推，失败不影响本地
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
    maxStreak: stats.maxStreak ?? 0,
    fullSessions: stats.fullSessions ?? 0,
    defeated: stats.defeated ?? 0,
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
  void pushBlobToCloud(game)
}

// ── 云端同步：错题本 + 统计跟着孩子的「个人码」走（与进度同用一个码）──────────

/** 这个孩子的个人码（= TA 的进度同步码）；没连返回 null，则纯本地。 */
export function getLearnCode(game: LearnGame): string | null {
  return getSyncCode(KID_PLAYER[game])
}

interface Blob {
  stats: Stats
  mistakes: Mistake[]
}

function loadBlob(game: LearnGame): Blob {
  return { stats: loadStats(game), mistakes: loadMistakes(game) }
}

function saveBlob(game: LearnGame, blob: Blob): void {
  if (blob.stats) safeSet(sKey(game), JSON.stringify(blob.stats))
  if (Array.isArray(blob.mistakes)) safeSet(mKey(game), JSON.stringify(blob.mistakes))
}

/** 推本地整份 blob 到云端（连了码才动）。 */
async function pushBlobToCloud(game: LearnGame): Promise<void> {
  const code = getLearnCode(game)
  if (!code) return
  await pushLearn(code, game, loadBlob(game))
}

/** 从云端拉取并按「活动多者为准」合并；连了码才动，返回是否同步过。 */
export async function hydrateLearn(game: LearnGame): Promise<boolean> {
  const code = getLearnCode(game)
  if (!code) return false
  const remote = await pullLearn(code)
  const cloud = remote[game] as Blob | undefined
  const localTotal = loadStats(game).totalDone
  if (!cloud || !cloud.stats) {
    // 云端还没有这个游戏：把本地播上去
    await pushBlobToCloud(game)
    return true
  }
  const cloudTotal = cloud.stats.totalDone ?? 0
  if (cloudTotal >= localTotal) {
    // 云端更全（或新设备本地为空）：采用云端
    saveBlob(game, cloud)
  } else {
    // 本地更全：推上云
    await pushBlobToCloud(game)
  }
  return true
}
