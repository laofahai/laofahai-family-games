import { useEffect, useMemo, useState } from 'react'
import { Shuffle, UserRound, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { wordBank, wordTags, type WordItem, type WordPair } from '@/data/word-bank'
import { getPlayers } from '@/platform/players'
import { pickUnseen } from '@/platform/progress'
import { RosterPicker } from '@/platform/RosterPicker'
import { roomsAvailable } from '@/platform/rooms'
import { getRosterIds, setRoster } from '@/platform/session'
import { UndercoverRemote } from './UndercoverRemote'

type Phase = 'setup' | 'reveal' | 'done'
type RoleType = 'civilian' | 'spy' | 'blank'

type Role = {
  player: number
  name: string
  type: RoleType
  word: WordItem | null
}

type Round = {
  pair: WordPair
  spyWord: WordItem
  civilianWord: WordItem
  roles: Role[]
  hasBlank: boolean
}

const blankWord: WordItem = { text: '白板', pinyin: 'bai ban' }

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getMaxSpies(players: number) {
  if (players <= 4) return 1
  if (players <= 6) return 2
  if (players <= 8) return 3
  if (players <= 10) return 4
  return Math.max(4, Math.floor(players / 3))
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function shuffle<T>(items: T[]) {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function UndercoverGame() {
  const [mode, setMode] = useState<'local' | 'remote'>('local')
  const [phase, setPhase] = useState<Phase>('setup')
  const [rosterIds, setRosterIds] = useState<string[]>(getRosterIds)
  const [spyCount, setSpyCount] = useState(1)
  const [tagFilter, setTagFilter] = useState('全部')
  const [round, setRound] = useState<Round | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState(1)
  const [showWord, setShowWord] = useState(false)
  const [revealedPlayers, setRevealedPlayers] = useState<boolean[]>([])
  const [showAll, setShowAll] = useState(false)

  const playerCount = rosterIds.length
  const maxSpies = useMemo(() => getMaxSpies(playerCount), [playerCount])

  useEffect(() => {
    setSpyCount((value) => clamp(value, 1, maxSpies))
  }, [maxSpies])

  const filteredBank = useMemo(() => {
    if (tagFilter === '全部') return wordBank
    return wordBank.filter((pair) => pair.tag === tagFilter)
  }, [tagFilter])


  function handleStart() {
    const pool = filteredBank.length ? filteredBank : wordBank
    // 优先挑没玩过的词对：shuffle 后传入，pickUnseen 从「没见过」的里取第一个并自动标记已见；
    // 整库用过一轮后会自动回收重来。scope 固定为 'undercover'，idOf 用稳定的 pair.id。
    const [pair = pickRandom(pool)] = pickUnseen('undercover', shuffle(pool), (item) => item.id, 1)
    const [first, second] = pair.words
    const spyWord = Math.random() > 0.5 ? first : second
    const civilianWord = spyWord === first ? second : first
    const all = getPlayers()
    const names = rosterIds.map((id) => all.find((p) => p.id === id)?.name ?? '')
    const roles: Role[] = Array.from({ length: playerCount }, (_, index) => ({
      player: index + 1,
      name: names[index] || `玩家 ${index + 1}`,
      type: 'civilian',
      word: civilianWord,
    }))

    const spyIndices = shuffle([...roles.keys()]).slice(0, spyCount)
    spyIndices.forEach((index) => {
      roles[index] = { ...roles[index], type: 'spy', word: spyWord }
    })

    const eligibleCount = playerCount - spyCount
    const maxBlanks =
      playerCount >= 5
        ? Math.min(
            Math.max(1, Math.ceil((playerCount - 4) / 2)),
            Math.min(eligibleCount, 3)
          )
        : 0
    const blankCount = maxBlanks > 0 ? Math.floor(Math.random() * (maxBlanks + 1)) : 0
    const hasBlank = blankCount > 0
    if (blankCount > 0) {
      const available = roles
        .map((_, index) => index)
        .filter((index) => roles[index].type !== 'spy')
      shuffle(available)
        .slice(0, blankCount)
        .forEach((index) => {
          roles[index] = { ...roles[index], type: 'blank', word: null }
        })
    }

    setRoster(rosterIds)
    setRound({ pair, spyWord, civilianWord, roles, hasBlank })
    setPhase('reveal')
    setCurrentPlayer(1)
    setShowWord(false)
    setRevealedPlayers(Array.from({ length: playerCount }, () => false))
    setShowAll(false)
  }

  function handleNext() {
    if (!round) return
    if (currentPlayer >= playerCount) {
      setPhase('done')
      return
    }
    setCurrentPlayer((value) => value + 1)
    setShowWord(false)
  }

  function handleReset() {
    setPhase('setup')
    setRound(null)
    setCurrentPlayer(1)
    setShowWord(false)
    setRevealedPlayers([])
    setShowAll(false)
  }

  const currentRole = round?.roles[currentPlayer - 1]

  function toggleReveal(playerIndex: number) {
    setRevealedPlayers((prev) => {
      if (!prev.length) return prev
      const next = [...prev]
      next[playerIndex] = !next[playerIndex]
      return next
    })
  }

  if (mode === 'remote') {
    return (
      <div className="space-y-6">
        <UndercoverRemote onBack={() => setMode('local')} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {phase === 'setup' && (
        <Card className="paper-grid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Users className="h-5 w-5 text-melon-600" />
              配置玩家
            </CardTitle>
            <CardDescription>支持 3 人起玩，卧底数量会自动限制。</CardDescription>
            {roomsAvailable() && (
              <button
                type="button"
                onClick={() => setMode('remote')}
                className="mt-2 self-start rounded-full border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600 transition hover:bg-orange-100"
              >
                📱 各自用自己手机玩（远程）
              </button>
            )}
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>这一局有谁（已选 {playerCount} 人）</Label>
                <RosterPicker selectedIds={rosterIds} onChange={setRosterIds} min={3} max={10} />
                {playerCount < 3 && (
                  <p className="text-xs text-rose-500">至少选 3 个人才能开局。</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="spies">卧底人数 (最多 {maxSpies})</Label>
                <select
                  id="spies"
                  className="h-11 w-full rounded-2xl border border-ink-200/80 bg-white px-3 text-sm text-ink-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500 focus-visible:ring-offset-2"
                  value={spyCount}
                  onChange={(event) => setSpyCount(Number(event.target.value))}
                >
                  {Array.from({ length: maxSpies }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={value}>
                      {value} 个
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-ink-100/70 bg-white/70 px-4 py-3 text-xs text-ink-500">
                白板随机出现：人数 ≥ 5 时，最多{' '}
                {playerCount >= 5
                  ? Math.min(Math.max(1, Math.ceil((playerCount - 4) / 2)), 3)
                  : 0}{' '}
                名白板。
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tag">词库主题</Label>
                <select
                  id="tag"
                  className="h-11 w-full rounded-2xl border border-ink-200/80 bg-white px-3 text-sm text-ink-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500 focus-visible:ring-offset-2"
                  value={tagFilter}
                  onChange={(event) => setTagFilter(event.target.value)}
                >
                  <option value="全部">全部</option>
                  {wordTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-dashed border-ink-200/70 bg-white/70 p-4 text-sm text-ink-600">
                <p className="font-medium text-ink-700">玩法提醒</p>
                <ul className="mt-2 space-y-1 text-xs">
                  <li>轮流看词，记住自己的词和身份。</li>
                  <li>轮流描述词语，不要说出词本身。</li>
                  <li>大家投票找出卧底或白板。</li>
                </ul>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              onClick={handleStart}
              disabled={playerCount < 3}
              className="h-12 w-full gap-2 bg-orange-500 text-white shadow-md hover:bg-orange-600"
            >
              <Shuffle className="h-4 w-4" />
              开始发牌
            </Button>
          </CardFooter>
        </Card>
      )}

      {phase === 'reveal' && round && (
        <Card className="paper-grid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <UserRound className="h-5 w-5 text-melon-600" />
              {currentRole?.name ?? `玩家 ${currentPlayer}`} 看词
            </CardTitle>
            <CardDescription>看完后点击确定，把手机传给下一位。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => setShowWord(true)}
              className="w-full min-h-[220px] rounded-3xl border border-ink-100/70 bg-white/80 p-6 text-center transition hover:-translate-y-0.5 hover:shadow-md"
              disabled={showWord}
            >
              {showWord && currentRole ? (
                <div className="space-y-2">
                  <div className="font-display text-4xl text-ink-900">
                    {currentRole.type === 'blank' ? blankWord.text : currentRole.word?.text}
                  </div>
                  <div className="text-sm tracking-widest text-ink-500">
                    {currentRole.type === 'blank' ? blankWord.pinyin : currentRole.word?.pinyin}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-ink-500">点击卡片揭晓你的词</div>
                  <div className="font-display text-3xl text-ink-300">???</div>
                </div>
              )}
            </button>
            <Button onClick={handleNext} className="h-12 w-full gap-2" disabled={!showWord}>
              {currentPlayer < playerCount
                ? `确定，传给 ${round.roles[currentPlayer]?.name ?? '下一位'}`
                : '看完了，开始讨论'}
            </Button>
          </CardContent>
          <CardFooter className="justify-end" />
        </Card>
      )}

      {phase === 'done' && round && (
        <Card className="paper-grid">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Users className="h-5 w-5 text-melon-600" />
              本轮发牌完成
            </CardTitle>
            <CardDescription>点击玩家卡片查看词语，或直接显示最终结果。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {round.roles.map((role, index) => {
                const revealed = showAll || revealedPlayers[index]
                const word = role.type === 'blank' ? blankWord : role.word
                return (
                  <button
                    key={role.player}
                    type="button"
                    onClick={() => toggleReveal(index)}
                    className="flex min-h-[120px] flex-col items-start justify-between rounded-3xl border border-ink-100/70 bg-white/85 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="text-sm font-semibold text-ink-700">{role.name}</div>
                    {revealed ? (
                      <div className="space-y-1">
                        <div className="font-display text-2xl text-ink-900">{word?.text}</div>
                        <div className="text-xs text-ink-500">{word?.pinyin}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-ink-400">点击查看</div>
                    )}
                  </button>
                )
              })}
            </div>
            {showAll && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-ink-100/70 bg-white/80 p-4">
                  <div className="text-xs text-ink-500">词语组合</div>
                  <div className="mt-2 text-lg font-semibold text-ink-900">
                    {round.pair.words[0].text} / {round.pair.words[1].text}
                  </div>
                  <div className="text-xs text-ink-500">
                    {round.pair.words[0].pinyin} / {round.pair.words[1].pinyin}
                  </div>
                </div>
                <div className="rounded-2xl border border-melon-200/70 bg-melon-50 p-4">
                  <div className="text-xs text-melon-600">卧底词</div>
                  <div className="mt-2 text-lg font-semibold text-melon-700">{round.spyWord.text}</div>
                  <div className="text-xs text-melon-600">{round.spyWord.pinyin}</div>
                </div>
                {round.hasBlank && (
                  <div className="rounded-2xl border border-ink-100/70 bg-white/80 p-4 md:col-span-2">
                    <div className="text-xs text-ink-500">白板提示</div>
                    <div className="mt-2 text-sm text-ink-700">
                      白板没有词语，需要靠听描述找出词汇方向。
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setShowAll((value) => !value)}>
              {showAll ? '隐藏最终结果' : '显示最终结果'}
            </Button>
            <Button onClick={handleReset} variant="outline" className="gap-2">
              再来一局
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
