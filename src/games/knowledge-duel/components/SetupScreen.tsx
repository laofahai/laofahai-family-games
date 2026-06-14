import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Band } from '@/games/_battle/questions'
import type {
  CpuLevel,
  DuelConfig,
  DuelMode,
  PlayerSetup,
  TopicMode,
} from '../types'
import {
  AVATARS,
  BAND_LABEL,
  CPU_LEVEL_LABEL,
  CPU_SETUP,
  DEFAULT_HP,
  TOPIC_LABEL,
} from '../constants'

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'min-h-12 rounded-2xl border px-4 text-sm font-semibold transition',
        active
          ? 'border-melon-500 bg-melon-500 text-white shadow-sm'
          : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function AvatarPicker({
  value,
  onChange,
  taken,
}: {
  value: string
  onChange: (a: string) => void
  taken: string
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {AVATARS.map((a) => {
        const isTaken = a === taken && a !== value
        return (
          <button
            key={a}
            type="button"
            disabled={isTaken}
            onClick={() => onChange(a)}
            className={[
              'flex aspect-square items-center justify-center rounded-xl text-2xl transition',
              a === value
                ? 'bg-melon-500 ring-2 ring-melon-600'
                : isTaken
                  ? 'cursor-not-allowed opacity-25'
                  : 'bg-ink-50 hover:bg-ink-100',
            ].join(' ')}
          >
            {a}
          </button>
        )
      })}
    </div>
  )
}

function PlayerEditor({
  title,
  value,
  onChange,
  otherEmoji,
  accent,
}: {
  title: string
  value: PlayerSetup
  onChange: (p: PlayerSetup) => void
  otherEmoji: string
  accent: string
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-ink-100 bg-white/70 p-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{value.emoji}</span>
        <span className={`text-sm font-bold ${accent}`}>{title}</span>
      </div>
      <input
        value={value.name}
        maxLength={8}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        placeholder="起个名字"
        className="min-h-12 w-full rounded-2xl border border-ink-200 bg-white px-3 text-base text-ink-800 outline-none focus:border-melon-400 focus:ring-2 focus:ring-melon-200"
      />
      <AvatarPicker
        value={value.emoji}
        taken={otherEmoji}
        onChange={(emoji) => onChange({ ...value, emoji })}
      />
    </div>
  )
}

interface SetupScreenProps {
  onStart: (config: DuelConfig) => void
}

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [mode, setMode] = useState<DuelMode>('hotseat')
  const [band, setBand] = useState<Band>('low')
  const [topic, setTopic] = useState<TopicMode>('mix')
  const [cpuLevel, setCpuLevel] = useState<CpuLevel>('normal')
  const [left, setLeft] = useState<PlayerSetup>({ name: '玩家一', emoji: '🦊' })
  const [right, setRight] = useState<PlayerSetup>({ name: '玩家二', emoji: '🐯' })

  const rightSetup: PlayerSetup =
    mode === 'cpu' ? { name: CPU_SETUP.name, emoji: CPU_SETUP.emoji } : right

  const leftName = left.name.trim() || '玩家一'
  const canStart = leftName.length > 0 && (mode === 'cpu' || (right.name.trim().length > 0))

  function handleStart() {
    onStart({
      mode,
      band,
      topic,
      cpuLevel,
      left: { ...left, name: leftName },
      right:
        mode === 'cpu'
          ? { name: CPU_SETUP.name, emoji: CPU_SETUP.emoji }
          : { ...right, name: right.name.trim() || '玩家二' },
      maxHp: DEFAULT_HP,
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>选择对战模式</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Pill active={mode === 'hotseat'} onClick={() => setMode('hotseat')}>
              👬 双人热座
            </Pill>
            <Pill active={mode === 'cpu'} onClick={() => setMode('cpu')}>
              🤖 人机对战
            </Pill>
          </div>
          <p className="text-xs text-ink-500">
            {mode === 'hotseat'
              ? '同一台手机轮流答题，传着玩。'
              : '你 vs 电脑，电脑会按难度自动作答。'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>对战双方</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PlayerEditor
            title="左方"
            value={left}
            onChange={setLeft}
            otherEmoji={rightSetup.emoji}
            accent="text-melon-600"
          />
          {mode === 'cpu' ? (
            <div className="flex items-center gap-2 rounded-2xl border border-ink-100 bg-ink-50/60 p-3">
              <span className="text-2xl">{CPU_SETUP.emoji}</span>
              <div>
                <div className="text-sm font-bold text-ink-700">右方：电脑</div>
                <div className="text-xs text-ink-500">难度越高出招越准</div>
              </div>
            </div>
          ) : (
            <PlayerEditor
              title="右方"
              value={right}
              onChange={setRight}
              otherEmoji={left.emoji}
              accent="text-sky-600"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>难度与题型</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-ink-500">年龄段</div>
            <div className="grid grid-cols-2 gap-2">
              {(['low', 'high'] as Band[]).map((b) => (
                <Pill key={b} active={band === b} onClick={() => setBand(b)}>
                  {BAND_LABEL[b]}
                </Pill>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold text-ink-500">题型</div>
            <div className="grid grid-cols-3 gap-2">
              {(['learn', 'fun', 'mix'] as TopicMode[]).map((t) => (
                <Pill key={t} active={topic === t} onClick={() => setTopic(t)}>
                  {TOPIC_LABEL[t]}
                </Pill>
              ))}
            </div>
          </div>

          {mode === 'cpu' && (
            <div>
              <div className="mb-1.5 text-xs font-semibold text-ink-500">电脑难度</div>
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'normal', 'hard'] as CpuLevel[]).map((c) => (
                  <Pill key={c} active={cpuLevel === c} onClick={() => setCpuLevel(c)}>
                    {CPU_LEVEL_LABEL[c]}
                  </Pill>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="min-h-12 w-full text-base"
        disabled={!canStart}
        onClick={handleStart}
      >
        ⚔️ 开始对战
      </Button>
    </div>
  )
}
