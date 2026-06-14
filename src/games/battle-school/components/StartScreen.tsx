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
        <h2 className="font-display text-2xl text-ink-900">横版打老师</h2>
        <p className="mt-1 text-sm text-ink-600">
          {playerName}，往右闯关！先搞定 2~3 个同学小怪，再答题打败关底老师 Boss。
          <br />
          答对出招、连对暴击；答错或超时会被反揍掉血。共 {totalLevels} 关。
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

      <div className="rounded-2xl bg-amber-50 p-3 text-left text-xs text-amber-800">
        招式随机：扇大耳刮子 👋 / 踹一脚 🦵 / 挠痒痒 🤣 / 吐口痰 💦，搞笑又解压～
      </div>
    </Card>
  )
}
