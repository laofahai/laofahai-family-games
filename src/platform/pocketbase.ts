import PocketBase from 'pocketbase'

export interface PocketBaseLike {
  send: <T = unknown>(path: string, opts?: Record<string, unknown>) => Promise<T>
  collection?: (name: string) => {
    create: (body: Record<string, unknown>) => Promise<unknown>
    subscribe: (
      topic: string,
      cb: (event: { action: string; record: Record<string, unknown> }) => void,
      opts?: { filter?: string }
    ) => Promise<() => void> | (() => void)
  }
}

const explicitUrl = import.meta.env.VITE_POCKETBASE_URL
const defaultUrl = typeof location !== 'undefined' && location.hostname === 'game.902.linch.tech'
  ? 'https://pb.902.linch.tech'
  : ''

const url = explicitUrl || defaultUrl
let clientOverride: PocketBaseLike | null = null

export const isPocketBaseConfigured = Boolean(url)

const realClient: PocketBaseLike | null = isPocketBaseConfigured ? (new PocketBase(url) as PocketBaseLike) : null
if (realClient && 'autoCancellation' in realClient && typeof realClient.autoCancellation === 'function') {
  realClient.autoCancellation(false)
}

export function pocketBaseClient(): PocketBaseLike | null {
  return clientOverride ?? realClient
}

export function pocketBaseAvailable(): boolean {
  return pocketBaseClient() !== null
}

export function setPocketBaseClientForTests(client: PocketBaseLike): void {
  clientOverride = client
}

export function clearPocketBaseClientForTests(): void {
  clientOverride = null
}

export async function fgPost<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  const client = pocketBaseClient()
  if (!client) return null
  try {
    return await client.send<T>(`/api/fg${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return null
  }
}

export interface RealtimeRecordTopic {
  kind: string
  room: string
  event: string
  sender: string
  ttlSeconds: number
  onMessage: (msg: unknown) => void
}

export interface RealtimeRecordChannel {
  send: (msg: unknown) => void
  leave: () => void
  handleRecord: (record: Record<string, unknown>) => void
}

function expiresAt(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString()
}

function filterLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function makeRecordChannel(topic: RealtimeRecordTopic): RealtimeRecordChannel {
  const handleRecord = (record: Record<string, unknown>) => {
    if (record.kind !== topic.kind) return
    if (record.room !== topic.room) return
    if (record.event !== topic.event) return
    if (record.sender === topic.sender) return
    topic.onMessage(record.payload)
  }

  return {
    send: (msg) => {
      const client = pocketBaseClient()
      const collection = client?.collection?.('rt_events')
      if (!collection) return
      void collection.create({
        kind: topic.kind,
        room: topic.room,
        event: topic.event,
        sender: topic.sender,
        payload: msg,
        expires_at: expiresAt(topic.ttlSeconds),
      })
    },
    leave: () => {},
    handleRecord,
  }
}

export function joinRecordChannel(topic: RealtimeRecordTopic): RealtimeRecordChannel {
  const channel = makeRecordChannel(topic)
  const client = pocketBaseClient()
  const collection = client?.collection?.('rt_events')
  if (!collection) return channel

  const filter = [
    `kind="${filterLiteral(topic.kind)}"`,
    `room="${filterLiteral(topic.room)}"`,
    `event="${filterLiteral(topic.event)}"`,
    `expires_at>"${new Date().toISOString()}"`,
  ].join(' && ')

  let unsubscribe: (() => void) | undefined
  void Promise.resolve(
    collection.subscribe(
      '*',
      (event) => {
        if (event.action === 'create') channel.handleRecord(event.record)
      },
      { filter }
    )
  ).then((fn) => {
    unsubscribe = fn
  })

  return {
    ...channel,
    leave: () => {
      unsubscribe?.()
    },
  }
}
