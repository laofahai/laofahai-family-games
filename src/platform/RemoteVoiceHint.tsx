// 远程局小提示：房间内置语音走浏览器直连；少数网络打洞失败时再用微信兜底。
import { Video } from 'lucide-react'

export function RemoteVoiceHint() {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
      <Video className="mt-0.5 h-4 w-4 shrink-0" />
      <span>远程一起玩可以直接加入房间语音；如果当前网络连不上，再开微信语音/视频兜底。</span>
    </div>
  )
}
