import { describe, expect, it } from 'vitest'

import { roomAudioStatusText } from './roomAudioStatus'

describe('roomAudioStatusText', () => {
  it('tells users that every device must join voice in the lobby', () => {
    expect(
      roomAudioStatusText({
        joined: false,
        remoteCount: 0,
        roomState: 'lobby',
        status: '语音未开启',
      })
    ).toContain('每台设备都要点“加入语音”')
  })

  it('shows that the local device joined while waiting for others', () => {
    expect(
      roomAudioStatusText({
        joined: true,
        remoteCount: 0,
        roomState: 'lobby',
        status: '语音已开启，正在连接其他人',
      })
    ).toContain('等其他人也点“加入语音”')
  })

  it('reports the number of remote peers once connected', () => {
    expect(
      roomAudioStatusText({
        joined: true,
        remoteCount: 2,
        roomState: 'playing',
        status: '语音已连接',
      })
    ).toContain('已听到 2 人')
  })
})
