// Supabase Realtime 广播：低延迟、不落库的 pub/sub，用来实时同步画笔。
// 公共频道用匿名公钥即可收发，无需迁移/额外配置。env 没配时安全降级为空操作。

import { supabase } from './supabase'

export interface DrawChannel {
  send: (msg: unknown) => void
  leave: () => void
}

/** 加入某个房间的画板频道。onMessage 收到别人广播的画笔消息（self:false 不回显自己）。 */
export function joinDrawChannel(code: string, onMessage: (msg: unknown) => void): DrawChannel {
  const sb = supabase
  if (!sb) return { send: () => {}, leave: () => {} }
  const ch = sb.channel(`draw:${code}`, { config: { broadcast: { self: false } } })
  ch.on('broadcast', { event: 'd' }, (e: { payload: unknown }) => onMessage(e.payload)).subscribe()
  return {
    send: (msg) => {
      void ch.send({ type: 'broadcast', event: 'd', payload: msg })
    },
    leave: () => {
      void sb.removeChannel(ch)
    },
  }
}

