// 远程局小提示：大家不在一起，开个微信视频/语音一起聊（我们不自建实时语音）。
import { Video } from 'lucide-react'

export function RemoteVoiceHint() {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
      <Video className="mt-0.5 h-4 w-4 shrink-0" />
      <span>远程一起玩？先开个微信视频/语音一起聊，边看自己手机边讨论，体验最顺。</span>
    </div>
  )
}
