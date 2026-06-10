import { Drama, Ear, Trophy, Vote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface IntroStageProps {
  onContinue: () => void
}

export function IntroStage({ onContinue }: IntroStageProps) {
  function handleStart() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('truthLie.introSeen', '1')
    }
    onContinue()
  }

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Drama className="h-5 w-5 text-melon-600" />
          玩法说明
        </CardTitle>
        <CardDescription>第一次玩看一下，下次会直接进入设置。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-ink-700">
        <div className="flex items-start gap-3 rounded-2xl border border-ink-100/70 bg-white/70 p-4">
          <Ear className="mt-0.5 h-5 w-5 text-melon-600" />
          <div>
            <div className="font-semibold text-ink-900">主角说三件自己的事</div>
            <div className="mt-1 text-xs text-ink-600">
              按 1、2、3 说出来，其中两件是真的、一件是编的。想不出来可以抽话题提示卡。
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4">
          <Vote className="mt-0.5 h-5 w-5 text-emerald-700" />
          <div>
            <div className="font-semibold text-emerald-900">其他人投票找假话</div>
            <div className="mt-1 text-xs text-emerald-700">
              每个人猜哪一件是编的。可以追问主角细节，看 TA 会不会露馅。
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4">
          <Trophy className="mt-0.5 h-5 w-5 text-amber-700" />
          <div>
            <div className="font-semibold text-amber-900">拆穿得分，骗人也得分</div>
            <div className="mt-1 text-xs text-amber-700">
              猜中假话 +1 分；主角每骗过一个人 +1 分。轮流当主角，最后看谁是全家影帝。
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-ink-200/70 bg-white/70 p-4 text-xs text-ink-500">
          小技巧：把真事说得越离谱、假事编得越平常，越容易骗到人。
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
