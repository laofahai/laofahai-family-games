import { useEffect, useRef, useState } from 'react'
import {
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  Dices,
  Home,
  RotateCcw,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { contentFor } from '@/platform/content'
import { pickUnseen } from '@/platform/progress'
import { diceTasks, type DiceTask } from './data/dice-tasks'

interface DiceGameProps {
  onExit: () => void
}

// 骰子点数图标 1-6
const DICE_ICONS = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6]

function shuffle<T>(items: readonly T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function randomFace(): number {
  return Math.floor(Math.random() * 6) + 1
}

export function DiceGame({ onExit }: DiceGameProps) {
  const [face, setFace] = useState(1) // 当前显示的点数 1-6
  const [rolling, setRolling] = useState(false)
  const [task, setTask] = useState<DiceTask | null>(null)
  const [turn, setTurn] = useState(1) // 第几个人（简单的轮流提示）
  const timersRef = useRef<number[]>([])

  // 卸载时清理所有定时器
  useEffect(() => {
    return () => {
      for (const id of timersRef.current) clearTimeout(id)
      timersRef.current = []
    }
  }, [])

  function drawTask(): DiceTask | null {
    // 运行时取云端/缓存内容，回退打包副本；从池里抽一个「没见过」的，避免短期重复。
    const pool = contentFor<DiceTask>('dice', diceTasks)
    const [picked] = pickUnseen('dice', shuffle(pool), (t) => t.text, 1)
    return picked ?? null
  }

  function roll(advanceTurn: boolean) {
    if (rolling) return
    // 清掉上一轮可能残留的定时器
    for (const id of timersRef.current) clearTimeout(id)
    timersRef.current = []

    setRolling(true)
    setTask(null)
    if (advanceTurn) setTurn((n) => n + 1)

    // 滚动动画：快速切换显示的点数几次，再定格。
    const steps = 8
    const stepMs = 90
    for (let i = 0; i < steps; i += 1) {
      const id = window.setTimeout(() => setFace(randomFace()), i * stepMs)
      timersRef.current.push(id)
    }
    // 定格 + 抽任务
    const endId = window.setTimeout(() => {
      setFace(randomFace())
      setTask(drawTask())
      setRolling(false)
    }, steps * stepMs)
    timersRef.current.push(endId)
  }

  const FaceIcon = DICE_ICONS[face - 1]

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Dices className="h-6 w-6 text-melon-600" />
          骰子任务
        </CardTitle>
        <CardDescription>掷一掷骰子，抽一个有趣的小任务，全家轮流来做！</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 轮到谁（简单提示） */}
        <div className="flex justify-center">
          <span className="rounded-full bg-melon-100 px-4 py-1 text-sm font-semibold text-melon-700">
            轮到第 {turn} 位
          </span>
        </div>

        {/* 大骰子 */}
        <div className="flex flex-col items-center gap-5">
          <div
            className={cn(
              'flex h-40 w-40 items-center justify-center rounded-3xl border-2 border-melon-200 bg-white shadow-[0_18px_40px_-24px_rgba(62,36,9,0.5)] transition-transform duration-150',
              rolling ? 'scale-105 rotate-3' : 'scale-100 rotate-0'
            )}
            aria-label={`骰子点数 ${face}`}
          >
            <FaceIcon
              className={cn(
                'h-28 w-28 text-melon-600 transition-transform',
                rolling && 'animate-pulse'
              )}
            />
          </div>

          <Button
            onClick={() => roll(false)}
            disabled={rolling}
            className="min-h-14 w-full max-w-xs text-lg"
          >
            <Dices className="mr-1 h-5 w-5" />
            {rolling ? '骰子滚动中…' : task ? '再掷一次' : '掷骰子'}
          </Button>
        </div>

        {/* 任务卡 */}
        {task && !rolling && (
          <div className="rounded-2xl border border-melon-200 bg-melon-50/70 p-6 text-center shadow-inner">
            <span className="inline-block rounded-full bg-melon-500 px-3 py-1 text-xs font-semibold text-white">
              {task.tag}
            </span>
            <p className="mt-4 text-2xl font-bold leading-relaxed text-ink-900">{task.text}</p>
          </div>
        )}

        {!task && !rolling && (
          <p className="text-center text-sm text-ink-500">点上面的「掷骰子」开始吧～</p>
        )}
      </CardContent>

      {/* 底部操作 */}
      <div className="space-y-3 px-6 pb-6">
        {task && (
          <Button
            onClick={() => roll(true)}
            disabled={rolling}
            variant="outline"
            className="min-h-14 w-full text-base"
          >
            <UserPlus className="mr-1 h-5 w-5" />
            换下一个人（再掷一次）
          </Button>
        )}
        {task && (
          <Button
            onClick={() => roll(false)}
            disabled={rolling}
            variant="ghost"
            className="min-h-14 w-full text-base"
          >
            <RotateCcw className="mr-1 h-5 w-5" />
            这个不想做，换一个
          </Button>
        )}
        <Button onClick={onExit} variant="ghost" className="min-h-14 w-full text-base text-ink-500">
          <Home className="mr-1 h-5 w-5" />
          回首页
        </Button>
      </div>
    </Card>
  )
}
