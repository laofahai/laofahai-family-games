import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function StartScreen({
  playerName,
  totalLevels,
  savedLevel,
  onStartFresh,
  onContinue,
  onCoop,
}: {
  playerName: string
  totalLevels: number
  savedLevel: number | null // 0-based 已闯到的下一关；null=无存档
  onStartFresh: () => void
  onContinue: () => void
  onCoop: () => void // 邀请同学一起打（共斗大厅）
}) {
  const hasSave = savedLevel != null && savedLevel > 0
  return (
    <Card className="mx-auto max-w-xl space-y-4 p-6 text-center">
      <div className="text-5xl">🧒⚔️🧑‍🏫</div>
      <div>
        <h2 className="font-display text-2xl text-ink-900">课间大乱斗</h2>
        <p className="mt-1 text-sm text-ink-600">
          {playerName}，冲过去！揍翻拦路的同学，再答题打败每关的老师。共 {totalLevels} 关。
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {hasSave && (
          <Button onClick={onContinue} className="min-h-12 text-base">
            继续闯关（第 {Math.min(savedLevel + 1, totalLevels)} 关）
          </Button>
        )}
        <Button
          onClick={onStartFresh}
          variant={hasSave ? 'outline' : 'default'}
          className="min-h-12 text-base"
        >
          {hasSave ? '从头玩' : '开始闯关'}
        </Button>
        <Button onClick={onCoop} variant="outline" className="min-h-12 text-base">
          邀请同学一起打 🧒⚔️🧒
        </Button>
      </div>

      <div className="space-y-1 rounded-2xl bg-amber-50 p-3 text-left text-xs text-amber-800">
        <p>📱 触屏：左摇杆移动 · 👊 普攻 · ⤴ 跳(可跳过弱怪) · ⚡ 学霸大招</p>
        <p>💻 电脑：W/A/S/D 或方向键移动(W/↑跳) · J 普攻 · K 技能 · L 切换大招/回血</p>
        <p className="text-amber-700/80">学霸大招 = 答对一道学科题，放出群体大招(对老师是重击)。</p>
      </div>
    </Card>
  )
}
