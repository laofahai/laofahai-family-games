import { Coins, ShoppingCart, Target, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface IntroStageProps {
  onContinue: () => void
}

export function IntroStage({ onContinue }: IntroStageProps) {
  function handleStart() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('price.introSeen', '1')
    }
    onContinue()
  }

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <ShoppingCart className="h-5 w-5 text-melon-600" />
          玩法说明
        </CardTitle>
        <CardDescription>第一次玩看一下，下次会直接进入设置。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-ink-700">
        <div className="flex items-start gap-3 rounded-2xl border border-ink-100/70 bg-white/70 p-4">
          <Coins className="mt-0.5 h-5 w-5 text-melon-600" />
          <div>
            <div className="font-semibold text-ink-900">每轮亮出一件真实商品</div>
            <div className="mt-1 text-xs text-ink-600">
              从一瓶矿泉水到一台 MacBook，价格都是 2026 年的真实市价。
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4">
          <Target className="mt-0.5 h-5 w-5 text-emerald-700" />
          <div>
            <div className="font-semibold text-emerald-900">轮流报价，别偷看</div>
            <div className="mt-1 text-xs text-emerald-700">
              每人轮流在手机上输入自己猜的价格，输完传给下一个人，报价会先藏起来。
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4">
          <Trophy className="mt-0.5 h-5 w-5 text-amber-700" />
          <div>
            <div className="font-semibold text-amber-900">最接近的赢</div>
            <div className="mt-1 text-xs text-amber-700">
              揭晓真实价格，猜得最接近的 +1 分；误差在 10% 以内算「神价」，+2 分！
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-ink-200/70 bg-white/70 p-4 text-xs text-ink-500">
          天天逛商场的人优势很大，建议盯紧妈妈的报价。
        </div>
      </CardContent>
      <div className="px-6 pb-6">
        <Button onClick={handleStart} className="h-12 w-full text-base">
          开始
        </Button>
      </div>
    </Card>
  )
}
