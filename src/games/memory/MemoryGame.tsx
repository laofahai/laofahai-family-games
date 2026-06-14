import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, Footprints, Play, RotateCcw, Settings2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { contentFor } from '@/platform/content'
import { pickUnseen } from '@/platform/progress'
import type { MemoryCard } from './types'

interface MemoryGameProps {
  onExit: () => void
}

type Stage = 'setup' | 'playing' | 'result'

// 一张牌：来源卡 + 唯一 id（同一对的两张 cardKey 相同）。
interface Tile {
  id: number
  cardKey: string
  emoji: string
  label: string
  matched: boolean
}

interface Difficulty {
  pairs: number
  label: string
  hint: string
}

const DIFFICULTIES: Difficulty[] = [
  { pairs: 6, label: '简单', hint: '6 对 · 12 张' },
  { pairs: 8, label: '中等', hint: '8 对 · 16 张' },
  { pairs: 10, label: '挑战', hint: '10 对 · 20 张' },
]

function shuffle<T>(items: readonly T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

// 取内容 → 挑 pairs 张不重复的卡 → 复制成对 → 洗牌成 2×pairs 张牌。
function buildTiles(pairs: number): Tile[] {
  const pool = contentFor<MemoryCard>('memory', [])
  const picked = pickUnseen('memory', shuffle(pool), (c) => c.label, pairs)
  const tiles: Tile[] = []
  picked.forEach((card, index) => {
    for (let copy = 0; copy < 2; copy += 1) {
      tiles.push({
        id: index * 2 + copy,
        cardKey: card.label,
        emoji: card.emoji,
        label: card.label,
        matched: false,
      })
    }
  })
  return shuffle(tiles)
}

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// 按用时 + 步数给个简单评级。完美步数 = 对数（每对一步翻对）。
function rank(pairs: number, moves: number, seconds: number): { title: string; note: string } {
  const ratio = moves / pairs // 1.0 = 完美记忆
  if (ratio <= 1.3 && seconds <= pairs * 8) {
    return { title: '记忆大师 🧠', note: '又快又准，简直过目不忘！' }
  }
  if (ratio <= 1.8) {
    return { title: '火眼金睛 ✨', note: '配对很有章法，厉害！' }
  }
  if (ratio <= 2.6) {
    return { title: '稳扎稳打 👍', note: '一步步全配对成功，干得好！' }
  }
  return { title: '勇往直前 🎉', note: '全部翻对啦，再来一局会更快！' }
}

export function MemoryGame({ onExit }: MemoryGameProps) {
  const [stage, setStage] = useState<Stage>('setup')
  const [pairs, setPairs] = useState<number>(6)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [flipped, setFlipped] = useState<number[]>([]) // 当前翻开、待判定的牌 id（最多 2）
  const [lock, setLock] = useState(false) // 判定停顿期间禁止点击
  const [moves, setMoves] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const startRef = useRef<number>(0)

  // 计时：playing 阶段每秒按时间戳刷新用时，离开/卸载时清理。
  useEffect(() => {
    if (stage !== 'playing') return
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [stage])

  // 判定用的停顿定时器；只在卸载时清理（此 effect 不 setState）。
  const judgeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (judgeRef.current) clearTimeout(judgeRef.current)
    },
    []
  )

  const startGame = useCallback((pairCount: number) => {
    setTiles(buildTiles(pairCount))
    setFlipped([])
    setLock(false)
    setMoves(0)
    setSeconds(0)
    startRef.current = Date.now()
    setStage('playing')
  }, [])

  function handleFlip(tile: Tile) {
    if (lock) return
    if (tile.matched) return
    if (flipped.includes(tile.id)) return
    if (flipped.length >= 2) return
    const next = [...flipped, tile.id]
    setFlipped(next)
    if (next.length < 2) return
    // 翻满一对：算 1 步、锁住，停顿 700ms 后判定（相同保持、不同翻回；全配对则结算）
    setMoves((m) => m + 1)
    setLock(true)
    const [a, b] = next
    const tileA = tiles.find((t) => t.id === a)
    const tileB = tiles.find((t) => t.id === b)
    const isMatch = Boolean(tileA && tileB && tileA.cardKey === tileB.cardKey)
    judgeRef.current = setTimeout(() => {
      if (isMatch) {
        setTiles((prev) => prev.map((t) => (t.id === a || t.id === b ? { ...t, matched: true } : t)))
        const complete = tiles.every((t) => t.matched || t.id === a || t.id === b)
        if (complete) {
          setSeconds(Math.floor((Date.now() - startRef.current) / 1000))
          setStage('result')
        }
      }
      setFlipped([])
      setLock(false)
    }, 700)
  }

  // ── setup ──────────────────────────────────────────────
  if (stage === 'setup') {
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Settings2 className="h-5 w-5 text-melon-600" />
            记忆翻牌
          </CardTitle>
          <CardDescription>翻开两张找相同，全部配对就赢啦。选个难度开始。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-semibold text-ink-700">难度</div>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => {
                const active = pairs === d.pairs
                return (
                  <button
                    key={d.pairs}
                    type="button"
                    onClick={() => setPairs(d.pairs)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition',
                      active
                        ? 'border-melon-500 bg-melon-500 text-white shadow'
                        : 'border-ink-200 bg-white text-ink-700 hover:border-melon-300'
                    )}
                  >
                    <span className="text-base font-semibold">{d.label}</span>
                    <span
                      className={cn('text-xs', active ? 'text-white/85' : 'text-ink-500')}
                    >
                      {d.hint}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
        <div className="px-6 pb-6">
          <Button onClick={() => startGame(pairs)} className="min-h-14 w-full gap-2 text-base">
            <Play className="h-5 w-5" />
            开始
          </Button>
        </div>
      </Card>
    )
  }

  // ── result ─────────────────────────────────────────────
  if (stage === 'result') {
    const { title, note } = rank(pairs, moves, seconds)
    return (
      <Card className="paper-grid">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Trophy className="h-5 w-5 text-melon-600" />
            全部配对成功
          </CardTitle>
          <CardDescription>{note}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-3xl border border-melon-200 bg-melon-50/70 p-6 text-center">
            <div className="font-display text-3xl text-ink-900">{title}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-ink-100 bg-white p-4">
              <Footprints className="h-5 w-5 text-melon-600" />
              <div className="text-2xl font-semibold text-ink-900">{moves}</div>
              <div className="text-xs text-ink-500">翻动步数</div>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-ink-100 bg-white p-4">
              <Clock className="h-5 w-5 text-melon-600" />
              <div className="text-2xl font-semibold text-ink-900">{formatTime(seconds)}</div>
              <div className="text-xs text-ink-500">用时</div>
            </div>
          </div>
        </CardContent>
        <div className="flex flex-col gap-2 px-6 pb-6 sm:flex-row">
          <Button onClick={() => startGame(pairs)} className="min-h-12 flex-1 gap-2">
            <RotateCcw className="h-4 w-4" />
            再来一局
          </Button>
          <Button
            onClick={() => setStage('setup')}
            variant="outline"
            className="min-h-12 flex-1 gap-2"
          >
            <Settings2 className="h-4 w-4" />
            换难度
          </Button>
          <Button onClick={onExit} variant="ghost" className="min-h-12 flex-1">
            返回首页
          </Button>
        </div>
      </Card>
    )
  }

  // ── playing ────────────────────────────────────────────
  const matchedPairs = tiles.filter((t) => t.matched).length / 2
  // 列数随对数自适应：手机统一 4 列，宽屏稍多一点。
  const colsClass =
    pairs >= 10 ? 'grid-cols-4 sm:grid-cols-5' : 'grid-cols-4 sm:grid-cols-4'

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-xl">
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-ink-700">
              <Footprints className="h-4 w-4 text-melon-600" />
              {moves} 步
            </span>
            <span className="inline-flex items-center gap-1 text-ink-700">
              <Clock className="h-4 w-4 text-melon-600" />
              {formatTime(seconds)}
            </span>
          </span>
          <span className="text-sm font-medium text-ink-500">
            {matchedPairs}/{pairs}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={cn('grid gap-2 sm:gap-3', colsClass)}>
          {tiles.map((tile) => {
            const isFaceUp = tile.matched || flipped.includes(tile.id)
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => handleFlip(tile)}
                disabled={lock || tile.matched || flipped.includes(tile.id)}
                aria-label={isFaceUp ? tile.label : '未翻开的牌'}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-2xl border text-3xl transition select-none sm:text-4xl',
                  isFaceUp
                    ? tile.matched
                      ? 'border-emerald-300 bg-emerald-50 shadow-inner'
                      : 'border-melon-400 bg-white shadow'
                    : 'border-melon-500 bg-melon-500 text-white/90 shadow hover:bg-melon-600 active:scale-95'
                )}
              >
                {isFaceUp ? (
                  <span className="flex flex-col items-center leading-none">
                    <span>{tile.emoji}</span>
                    <span className="mt-1 text-[10px] font-medium text-ink-500 sm:text-xs">
                      {tile.label}
                    </span>
                  </span>
                ) : (
                  <span className="text-2xl sm:text-3xl">❓</span>
                )}
              </button>
            )
          })}
        </div>
      </CardContent>
      <div className="px-6 pb-6">
        <Button onClick={() => setStage('setup')} variant="ghost" className="min-h-12 w-full">
          退出本局
        </Button>
      </div>
    </Card>
  )
}
