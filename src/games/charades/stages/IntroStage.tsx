import { ArrowDown, ArrowUp, Hand, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMotionPermission } from '../hooks/useMotionPermission'
import { unlockAudio } from '../utils/sounds'

interface IntroStageProps {
  onContinue: () => void
}

export function IntroStage({ onContinue }: IntroStageProps) {
  const { request } = useMotionPermission()

  async function handleStart() {
    unlockAudio()
    await request()
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('charades.introSeen', '1')
    }
    onContinue()
  }

  return (
    <Card className="paper-grid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Hand className="h-5 w-5 text-melon-600" />
          玩法说明
        </CardTitle>
        <CardDescription>第一次玩看一下，下次会直接进入设置。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm text-ink-700">
        <div className="flex items-start gap-3 rounded-2xl border border-ink-100/70 bg-white/70 p-4">
          <Smartphone className="mt-0.5 h-5 w-5 text-melon-600" />
          <div>
            <div className="font-semibold text-ink-900">手机贴额头</div>
            <div className="mt-1 text-xs text-ink-600">
              横屏举着，屏幕朝外。家人看屏幕上的词比划给你，你来猜。
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4">
            <ArrowDown className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <div className="font-semibold text-emerald-900">向前翻 = 对</div>
              <div className="mt-1 text-xs text-emerald-700">屏幕朝下，进入下一题</div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4">
            <ArrowUp className="mt-0.5 h-5 w-5 text-rose-700" />
            <div>
              <div className="font-semibold text-rose-900">向后翻 = 过</div>
              <div className="mt-1 text-xs text-rose-700">屏幕朝上，跳过此题</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-ink-200/70 bg-white/70 p-4 text-xs text-ink-500">
          点击下面的按钮，会请求一次"动作感应"权限（iOS 必须）。如果设备不支持或拒绝，可以用屏幕点按代替：
          <span className="text-emerald-700">左半屏点对</span> / <span className="text-rose-700">右半屏点过</span>。
        </div>
      </CardContent>
      <div className="px-6 pb-6">
        <Button onClick={handleStart} className="h-12 w-full text-base">
          启用动作感应，开始
        </Button>
      </div>
    </Card>
  )
}
