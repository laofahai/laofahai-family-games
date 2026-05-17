import { BookOpen, Sparkles, Timer, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface IntroStageProps {
  onContinue: () => void
}

export function IntroStage({ onContinue }: IntroStageProps) {
  function handleStart() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('story.introSeen', '1')
    }
    onContinue()
  }

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <BookOpen className="h-5 w-5 text-melon-600" />
          玩法说明
        </CardTitle>
        <CardDescription>第一次玩看一下，下次会直接进入设置。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-ink-700">
        <div className="flex items-start gap-3 rounded-2xl border border-ink-100/70 bg-white/70 p-4">
          <Sparkles className="mt-0.5 h-5 w-5 text-melon-600" />
          <div>
            <div className="font-semibold text-ink-900">抽几张关键词卡</div>
            <div className="mt-1 text-xs text-ink-600">
              每张卡是一个人物、地点、物品或剧情转折。选择你喜欢的主题（童话、冒险、科幻……）。
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4">
          <Timer className="mt-0.5 h-5 w-5 text-emerald-700" />
          <div>
            <div className="font-semibold text-emerald-900">限时编一个故事</div>
            <div className="mt-1 text-xs text-emerald-700">
              60–180 秒，把所有抽到的关键词融进故事里，讲给家人听。能现编现讲就行，别紧张。
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4">
          <Users className="mt-0.5 h-5 w-5 text-amber-700" />
          <div>
            <div className="font-semibold text-amber-900">家人当裁判</div>
            <div className="mt-1 text-xs text-amber-700">
              讲完后家人投票：精彩过关，还是有点离题、再讲一次。每个人都可以轮流当讲故事的人。
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-ink-200/70 bg-white/70 p-4 text-xs text-ink-500">
          小朋友可以选 3 张卡 + 较长时间。大人玩可以选 4–5 张卡 + 短时间，难度更高。
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
