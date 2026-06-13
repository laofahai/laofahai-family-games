import { Lightbulb, MessageCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlayerId, TruthTopic } from '../types'
import { infoOf, TOPIC_LABEL } from '../types'

interface TellStageProps {
  teller: PlayerId
  roundNo: number
  totalRounds: number
  topic: TruthTopic
  onSwapTopic: () => void
  onDone: () => void
}

export function TellStage({ teller, roundNo, totalRounds, topic, onSwapTopic, onDone }: TellStageProps) {
  const info = infoOf(teller)

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <MessageCircle className="h-5 w-5 text-melon-600" />
          第 {roundNo} / {totalRounds} 轮 · 主角：{info.emoji} {info.name}
        </CardTitle>
        <CardDescription>
          {info.name}按 1、2、3 说出三件关于自己的事——两件真的，一件编的。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-3xl border border-amber-200/70 bg-amber-50/70 p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
            <Lightbulb className="h-4 w-4" />
            话题提示卡 · {TOPIC_LABEL[topic.category]}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-4xl">{topic.emoji}</span>
            <div className="font-display text-xl text-ink-900">{topic.text}</div>
          </div>
          <div className="mt-3 text-xs text-amber-700">
            想不出来就换一张；不想用提示也可以自由发挥。
          </div>
        </div>

        <Button variant="outline" onClick={onSwapTopic} className="h-12 w-full gap-2">
          <RefreshCw className="h-4 w-4" />
          换一张话题卡
        </Button>

        <div className="rounded-2xl border border-dashed border-ink-200/70 bg-white/70 p-4 text-xs text-ink-500">
          其他人可以追问细节：「那是哪一年？」「当时还有谁在场？」——看主角会不会露馅。
        </div>
      </CardContent>
      <div className="px-6 pb-6">
        <Button onClick={onDone} className="h-14 w-full text-base">
          说完了，开始投票
        </Button>
      </div>
    </Card>
  )
}
