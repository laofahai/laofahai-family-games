import { HeartHandshake, Lightbulb, Trophy, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface IntroStageProps {
  onContinue: () => void
}

export function IntroStage({ onContinue }: IntroStageProps) {
  function handleStart() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('knowYou.introSeen', '1')
    }
    onContinue()
  }

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <HeartHandshake className="h-5 w-5 text-melon-600" />
          玩法说明
        </CardTitle>
        <CardDescription>第一次玩看一下，下次会直接进入设置。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-ink-700">
        <div className="flex items-start gap-3 rounded-2xl border border-ink-100/70 bg-white/70 p-4">
          <Users className="mt-0.5 h-5 w-5 text-melon-600" />
          <div>
            <div className="font-semibold text-ink-900">每轮一位家人当"主角"</div>
            <div className="mt-1 text-xs text-ink-600">
              题目来自主角的世界：爸爸的程序员日常、妈妈的商场打工日记、姐姐的邓紫棋和热梗、妹妹的一年级生活。
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4">
          <Lightbulb className="mt-0.5 h-5 w-5 text-emerald-700" />
          <div>
            <div className="font-semibold text-emerald-900">其他人先抢答，再翻答案</div>
            <div className="mt-1 text-xs text-emerald-700">
              知识卡有参考答案；走心卡（"我最近最烦恼的事是什么？"）由主角亲口公布。答得对不对，主角说了算。
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4">
          <Trophy className="mt-0.5 h-5 w-5 text-amber-700" />
          <div>
            <div className="font-semibold text-amber-900">两种荣誉</div>
            <div className="mt-1 text-xs text-amber-700">
              答对的人证明"我懂你"，拿了解分 ❤️；全场没人答对，主角喊出"我知道你不知道！"拿独家分 🤫。
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-ink-200/70 bg-white/70 p-4 text-xs text-ink-500">
          建议一个人拿着手机当主持，读题给大家听。答案没有标准对错——聊起来、互相多了解一点，才是这个游戏的目的。
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
