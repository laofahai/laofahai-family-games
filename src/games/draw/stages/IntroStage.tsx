import { Eye, Palette, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface IntroStageProps {
  onContinue: () => void
}

export function IntroStage({ onContinue }: IntroStageProps) {
  function handleStart() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('draw.introSeen', '1')
    }
    onContinue()
  }

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Palette className="h-5 w-5 text-melon-600" />
          玩法说明
        </CardTitle>
        <CardDescription>第一次玩看一下，下次会直接进入设置。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-ink-700">
        <div className="flex items-start gap-3 rounded-2xl border border-ink-100/70 bg-white/70 p-4">
          <Eye className="mt-0.5 h-5 w-5 text-melon-600" />
          <div>
            <div className="font-semibold text-ink-900">画手偷偷看词</div>
            <div className="mt-1 text-xs text-ink-600">
              把手机递给画画的人，其他人移开视线。画手看完词后点「开始画」。
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4">
          <Palette className="mt-0.5 h-5 w-5 text-emerald-700" />
          <div>
            <div className="font-semibold text-emerald-900">在屏幕上画，大家围着猜</div>
            <div className="mt-1 text-xs text-emerald-700">
              只能画，不能说话、不能写字、不能比口型！屏幕上会显示类别提示给猜的人。
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4">
          <Timer className="mt-0.5 h-5 w-5 text-amber-700" />
          <div>
            <div className="font-semibold text-amber-900">限时猜中</div>
            <div className="mt-1 text-xs text-amber-700">
              有人喊出正确答案就点「猜对了」；时间到或实在画不出来就翻车，看答案哈哈一笑进下一轮。
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-ink-200/70 bg-white/70 p-4 text-xs text-ink-500">
          妹妹画选「简单」，大人画选「困难」试试成语和网络热词。
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
