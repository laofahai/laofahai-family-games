import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function LostScreen({
  levelIndex,
  totalLevels,
  onRetry,
  onExit,
}: {
  levelIndex: number
  totalLevels: number
  onRetry: () => void
  onExit: () => void
}) {
  return (
    <Card className="mx-auto max-w-md space-y-4 p-6 text-center">
      <div className="text-5xl">😵‍💫</div>
      <div>
        <h2 className="font-display text-2xl text-ink-900">被打趴下啦…</h2>
        <p className="mt-1 text-sm text-ink-600">
          倒在了第 {levelIndex + 1} / {totalLevels} 关。揉揉脸，再战一回！
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Button onClick={onRetry} className="min-h-12 text-base">
          再来一次
        </Button>
        <Button onClick={onExit} variant="outline" className="min-h-12 text-base">
          返回
        </Button>
      </div>
    </Card>
  )
}
