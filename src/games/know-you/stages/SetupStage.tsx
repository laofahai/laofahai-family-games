import { Play, RotateCcw, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { QuestionsPerRole, RoleId } from '../types'
import { ROLES } from '../types'
import { cn } from '@/lib/utils'

interface SetupStageProps {
  players: Set<RoleId>
  perRole: QuestionsPerRole
  withFamilyCards: boolean
  usedCount: number
  onTogglePlayer: (r: RoleId) => void
  onChangePerRole: (n: QuestionsPerRole) => void
  onToggleFamilyCards: () => void
  onResetUsed: () => void
  onStart: () => void
}

const PER_ROLE_OPTIONS: QuestionsPerRole[] = [3, 5, 8]

export function SetupStage({
  players,
  perRole,
  withFamilyCards,
  usedCount,
  onTogglePlayer,
  onChangePerRole,
  onToggleFamilyCards,
  onResetUsed,
  onStart,
}: SetupStageProps) {
  const canStart = players.size >= 2
  const familyCardCount = withFamilyCards ? perRole - 1 : 0
  const totalQuestions = players.size * perRole + familyCardCount

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Settings2 className="h-5 w-5 text-melon-600" />
          开局设置
        </CardTitle>
        <CardDescription>勾选今天在场的家人，选每人几道题。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink-700">今天谁在场？（至少 2 人）</div>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((role) => {
              const active = players.has(role.id)
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => onTogglePlayer(role.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border p-3 text-left transition',
                    active
                      ? 'border-melon-500 bg-melon-50 shadow'
                      : 'border-ink-200 bg-white opacity-60 hover:border-melon-300 hover:opacity-100'
                  )}
                >
                  <span className="text-3xl">{role.emoji}</span>
                  <span>
                    <span className="block text-sm font-semibold text-ink-900">{role.name}</span>
                    <span className="block text-xs text-ink-500">{role.desc}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {!canStart && <div className="text-xs text-rose-600">至少要有 2 位家人才能玩</div>}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-ink-700">每人几道题</div>
          <div className="grid grid-cols-3 gap-2">
            {PER_ROLE_OPTIONS.map((n) => {
              const active = perRole === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChangePerRole(n)}
                  className={cn(
                    'h-12 rounded-2xl border text-sm font-medium transition',
                    active
                      ? 'border-ink-700 bg-ink-700 text-white shadow'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400'
                  )}
                >
                  {n} 道
                </button>
              )
            })}
          </div>
          <div className="text-xs text-ink-500">
            本局共 {totalQuestions} 张卡，主角轮流换。3 道 = 快速一局 / 8 道 = 深度互怼
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleFamilyCards}
          className={cn(
            'flex w-full items-center justify-between rounded-2xl border p-4 text-left transition',
            withFamilyCards
              ? 'border-violet-400 bg-violet-50 shadow'
              : 'border-ink-200 bg-white opacity-70 hover:opacity-100'
          )}
        >
          <span>
            <span className="block text-sm font-semibold text-ink-900">🎉 穿插全家彩蛋卡</span>
            <span className="block text-xs text-ink-500">
              每轮换人之间加一张"谁最可能 / 模仿挑战 / 家庭回忆",不计分纯起哄
            </span>
          </span>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold',
              withFamilyCards ? 'bg-violet-500 text-white' : 'bg-ink-100 text-ink-500'
            )}
          >
            {withFamilyCards ? '开' : '关'}
          </span>
        </button>

        {usedCount > 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-ink-200 bg-white p-4">
            <span className="text-xs text-ink-500">
              已玩过 <span className="font-semibold text-ink-900">{usedCount}</span>{' '}
              张卡，不会再出现（题不够时才会回收）
            </span>
            <button
              type="button"
              onClick={onResetUsed}
              className="flex shrink-0 items-center gap-1 rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700 transition hover:border-rose-400 hover:text-rose-600"
            >
              <RotateCcw className="h-3 w-3" />
              清空记录
            </button>
          </div>
        )}
      </CardContent>
      <div className="px-6 pb-6">
        <Button onClick={onStart} disabled={!canStart} className="h-14 w-full gap-2 text-base">
          <Play className="h-5 w-5" />
          开始出题
        </Button>
      </div>
    </Card>
  )
}
