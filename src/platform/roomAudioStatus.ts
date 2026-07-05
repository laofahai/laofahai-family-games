export function roomAudioStatusText(opts: {
  joined: boolean
  remoteCount: number
  roomState: string
  status: string
}): string {
  if (!opts.joined) {
    return opts.roomState === 'lobby'
      ? '等待开始时也能语音；每台设备都要点“加入语音”。'
      : '每台设备都要点“加入语音”才能互相听见。'
  }
  if (opts.remoteCount > 0) return `${opts.status} 已听到 ${opts.remoteCount} 人。`
  return '你已加入语音，等其他人也点“加入语音”。'
}
