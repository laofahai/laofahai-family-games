type MediaKind = 'microphone' | 'camera' | 'cameraOrMicrophone'

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`.toLowerCase()
  return String(error ?? '').toLowerCase()
}

export function mediaPermissionErrorMessage(kind: MediaKind, error: unknown): string {
  const text = errorText(error)
  const label = kind === 'camera' ? '摄像头' : kind === 'microphone' ? '麦克风' : '摄像头或麦克风'

  if (text.includes('overlay') || text.includes('bubble')) {
    return `浏览器暂时不能弹出${label}权限。先关闭其他 App 的悬浮窗/气泡/小窗/录屏浮层，再点一次。`
  }

  if (text.includes('notallowed') || text.includes('permission') || text.includes('denied')) {
    return `${label}权限被拒绝了。请在浏览器地址栏的站点权限里允许${label}，然后重新加入。`
  }

  if (text.includes('notfound') || text.includes('devicesnotfound')) {
    return `没有找到可用的${label}。`
  }

  if (text.includes('notreadable') || text.includes('trackstarterror')) {
    return `${label}正被别的 App 占用，关闭其它通话/录音/录屏后再试。`
  }

  return `${label}启动失败，关闭其他通话或悬浮窗后再试一次。`
}
