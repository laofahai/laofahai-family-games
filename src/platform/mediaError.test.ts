import { describe, expect, it } from 'vitest'

import { mediaPermissionErrorMessage } from './mediaError'

describe('mediaPermissionErrorMessage', () => {
  it('explains Android overlay permission blocks for microphone access', () => {
    const error = new DOMException(
      "This site can't ask for your permission. Close any bubbles or overlays from other apps. Then try again.",
      'NotAllowedError'
    )

    expect(mediaPermissionErrorMessage('microphone', error)).toContain('关闭其他 App 的悬浮窗')
  })

  it('uses camera wording for camera permission failures', () => {
    const error = new DOMException('Permission denied', 'NotAllowedError')

    expect(mediaPermissionErrorMessage('camera', error)).toContain('摄像头')
  })

  it('uses combined wording when camera and microphone are requested together', () => {
    const error = new DOMException('Permission denied', 'NotAllowedError')

    expect(mediaPermissionErrorMessage('cameraOrMicrophone', error)).toContain('摄像头或麦克风')
  })
})
