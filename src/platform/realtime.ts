import { deviceToken } from './rooms'
import { joinRecordChannel } from './pocketbase'

export interface DrawChannel {
  send: (msg: unknown) => void
  leave: () => void
}

/** 加入某个房间的画板频道。onMessage 收到别人广播的画笔消息（self:false 不回显自己）。 */
export function joinDrawChannel(code: string, onMessage: (msg: unknown) => void): DrawChannel {
  return joinRecordChannel({ kind: 'draw', room: code, event: 'd', sender: deviceToken(), ttlSeconds: 300, onMessage })
}
