import { useEffect, useMemo, useState } from 'react'
import { Gamepad2, Ghost, Sparkles, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CharadesGame } from '@/games/charades/CharadesGame'
import { DiceGame } from '@/games/dice/DiceGame'
import { DrawGame } from '@/games/draw/DrawGame'
import { KnowYouGame } from '@/games/know-you/KnowYouGame'
import { MemoryGame } from '@/games/memory/MemoryGame'
import { PriceGame } from '@/games/price/PriceGame'
import { SoundGame } from '@/games/sound/SoundGame'
import { ShiliuTownGame } from '@/games/shiliu-town/ShiliuTownGame'
import { StoryGame } from '@/games/story/StoryGame'
import { TruthLieGame } from '@/games/truth-lie/TruthLieGame'
import { UndercoverGame } from '@/games/undercover/UndercoverGame'
import { YiyiBureauGame } from '@/games/yiyi-bureau/YiyiBureauGame'
import { isUnlocked } from '@/platform/access'
import { UnlockGate } from '@/platform/UnlockGate'
import { IdentitySheet } from '@/platform/IdentitySheet'
import { WhoPlaying } from '@/platform/WhoPlaying'
import { ACTIVE_GAME_IDS, GAMES } from '@/platform/catalog'
import { addPlayer, getPlayers, removePlayer, type Player } from '@/platform/players'
import { getCurrentPlayer, hydratePlayer, setCurrentPlayer, setSyncCode } from '@/platform/progress'
import { refreshContent } from '@/platform/content'
import { AGE_BANDS, ageOverlaps } from '@/platform/taxonomy'
import { cn } from '@/lib/utils'

type Screen =
  | 'home'
  | 'undercover'
  | 'charades'
  | 'story'
  | 'knowYou'
  | 'draw'
  | 'price'
  | 'truthLie'
  | 'shiliuTown'
  | 'yiyiBureau'
  | 'dice'
  | 'sound'
  | 'memory'

const games = GAMES
const ACTIVE_GAMES = ACTIVE_GAME_IDS

function loadBand(): string {
  try {
    return localStorage.getItem('fg:ageBand') ?? 'all'
  } catch {
    return 'all'
  }
}

export default function App() {
  const [unlocked, setUnlocked] = useState(isUnlocked)
  const [showMe, setShowMe] = useState(false)
  const [screen, setScreen] = useState<Screen>('home')
  const [bandId, setBandId] = useState<string>(loadBand)

  const band = AGE_BANDS.find((b) => b.id === bandId) ?? AGE_BANDS[0]
  const visibleGames = useMemo(
    () => games.filter((g) => band.id === 'all' || ageOverlaps(g.age, band.range)),
    [band]
  )

  const chooseBand = (id: string) => {
    setBandId(id)
    try {
      localStorage.setItem('fg:ageBand', id)
    } catch {
      /* 忽略 */
    }
  }

  const [players, setPlayers] = useState<Player[]>(getPlayers)
  const [playerId, setPlayerId] = useState<string>(getCurrentPlayer)
  const currentPlayer = players.find((p) => p.id === playerId)

  const choosePlayer = (id: string) => {
    setPlayerId(id)
    setCurrentPlayer(id)
    void hydratePlayer(id) // 连了同步码的人，切到 TA 就先把云端进度拉回合并
  }

  // 进场时：① 把云端最新题库拉回来缓存（离线/未配置则沿用缓存或打包副本）
  //        ② 把当前玩家的云端进度拉回来（没连码的人是无操作）
  useEffect(() => {
    void refreshContent()
    void hydratePlayer(playerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddPlayer = (name: string) => {
    const p = addPlayer(name)
    setPlayers(getPlayers())
    choosePlayer(p.id)
  }

  const handleRemovePlayer = (id: string) => {
    removePlayer(id)
    const next = getPlayers()
    setPlayers(next)
    if (playerId === id) choosePlayer(next[0]?.id ?? 'guest')
  }

  // 用个人码登录：自动选中这个人（家庭成员按名字匹配，否则新建），并把这个码绑成 TA 的个人码
  const handleUnlocked = (person?: { name: string; emoji: string | null; code: string }) => {
    setUnlocked(true)
    if (!person) return
    const existing = getPlayers().find((p) => p.name === person.name)
    let pid: string
    if (existing) {
      pid = existing.id
    } else {
      pid = addPlayer(person.name).id
      setPlayers(getPlayers())
    }
    setSyncCode(person.code, pid)
    choosePlayer(pid)
  }

  if (!unlocked) {
    return <UnlockGate onUnlocked={handleUnlocked} />
  }

  return (
    <div className="min-h-screen px-4 py-10 md:px-10">
      {showMe && (
        <IdentitySheet
          players={players}
          currentId={playerId}
          onPick={choosePlayer}
          onAdd={handleAddPlayer}
          onRemove={handleRemovePlayer}
          onClose={() => setShowMe(false)}
        />
      )}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {screen === 'home' && (
          <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-white/80 p-2 shadow-sm">
                  <Gamepad2 className="h-6 w-6 text-melon-500" />
                </span>
                <h1 className="font-display text-3xl text-ink-900">家庭小游戏乐园</h1>
              </div>
              <p className="max-w-xl text-sm text-ink-600">
                适合一家人围坐的小游戏清单。每局玩的人，进游戏后再选。
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowMe(true)}
              className="flex items-center gap-2 self-start rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 shadow-sm transition hover:border-melon-300"
            >
              <UserRound className="h-4 w-4 text-melon-600" />
              <span className="text-ink-400">我</span>
              <span>{currentPlayer?.emoji ?? '🙂'}</span>
              <span>{currentPlayer?.name ?? '选一个'}</span>
              <span className="text-ink-400">▾</span>
            </button>
          </header>
        )}

        {screen === 'home' && (
          <Card className="paper-grid">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Sparkles className="h-5 w-5 text-melon-600" />
                游戏列表
              </CardTitle>
              <CardDescription>点击进入小游戏。按年龄段挑，更快找到合适的。</CardDescription>
              <div className="flex flex-wrap gap-2 pt-3">
                {AGE_BANDS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => chooseBand(b.id)}
                    className={cn(
                      'min-h-9 rounded-full border px-4 text-sm font-semibold transition',
                      b.id === band.id
                        ? 'border-melon-500 bg-melon-50 text-melon-700'
                        : 'border-ink-200 bg-white text-ink-600 hover:border-melon-300'
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleGames.map((game) => {
                const isActive = ACTIVE_GAMES.has(game.id)
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => {
                      if (game.id === 'undercover') setScreen('undercover')
                      else if (game.id === 'charades') setScreen('charades')
                      else if (game.id === 'story') setScreen('story')
                      else if (game.id === 'knowYou') setScreen('knowYou')
                      else if (game.id === 'draw') setScreen('draw')
                      else if (game.id === 'price') setScreen('price')
                      else if (game.id === 'shiliuTown') setScreen('shiliuTown')
                      else if (game.id === 'yiyiBureau') setScreen('yiyiBureau')
                      else if (game.id === 'truthLie') setScreen('truthLie')
                      else if (game.id === 'dice') setScreen('dice')
                      else if (game.id === 'sound') setScreen('sound')
                      else if (game.id === 'memory') setScreen('memory')
                    }}
                    className={cn(
                      'group flex min-h-[150px] flex-col items-start justify-between rounded-3xl border border-ink-100/70 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md',
                      !isActive && 'cursor-not-allowed opacity-70'
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="rounded-2xl bg-ink-100 p-2">
                        <Ghost className="h-5 w-5 text-ink-700" />
                      </span>
                      {game.status === 'hot' ? (
                        <span className="rounded-full bg-melon-100 px-3 py-1 text-xs font-semibold text-melon-700">
                          Hot
                        </span>
                      ) : (
                        <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-700">
                          Coming
                        </span>
                      )}
                    </div>
                    <div className="w-full">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-display text-xl text-ink-900">{game.name}</div>
                        <span className="shrink-0 rounded-full bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-ink-500">
                          {game.audience}
                        </span>
                      </div>
                      <div className="text-xs text-ink-500">{game.desc}</div>
                    </div>
                  </button>
                )
              })}
              {visibleGames.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
                  这个年龄段暂时没有游戏，换一个试试。
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-between">
              <div className="text-xs text-ink-500">
                已上线 {ACTIVE_GAMES.size} 个游戏：聚会同乐 + 学习闯关，全家老小都能玩。
              </div>
              <div className="text-xs text-ink-500">新上线：骰子任务、声音模仿、记忆翻牌 🎉</div>
            </CardFooter>
          </Card>
        )}

        {screen === 'undercover' && (
          <section className="space-y-6">
            <div>
              <Button variant="outline" onClick={() => setScreen('home')} className="gap-2">
                返回首页
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl text-ink-900">谁是卧底</h2>
                <p className="text-sm text-ink-600">
                  轻松推理，笑点密集。所有人只拿到两个词之一。
                </p>
              </div>
            </div>
            <UndercoverGame />
          </section>
        )}

        {screen === 'charades' && (
          <section className="space-y-6">
            <div>
              <Button variant="outline" onClick={() => setScreen('home')} className="gap-2">
                返回首页
              </Button>
            </div>
            <div>
              <h2 className="font-display text-3xl text-ink-900">你来比划我来猜</h2>
              <p className="text-sm text-ink-600">
                手机贴额头，家人比划你猜词。前翻="对"，后翻="过"。
              </p>
            </div>
            <CharadesGame onExit={() => setScreen('home')} />
          </section>
        )}

        {screen === 'knowYou' && (
          <section className="space-y-6">
            <div>
              <Button variant="outline" onClick={() => setScreen('home')} className="gap-2">
                返回首页
              </Button>
            </div>
            <div>
              <h2 className="font-display text-3xl text-ink-900">我知道你不知道</h2>
              <p className="text-sm text-ink-600">
                每轮一位家人当主角，其他人猜 TA 世界里的事。答对拿 ❤️，没人答对主角拿 🤫。
              </p>
            </div>
            <KnowYouGame onExit={() => setScreen('home')} />
          </section>
        )}

        {screen === 'draw' && (
          <section className="space-y-6">
            <div>
              <Button variant="outline" onClick={() => setScreen('home')} className="gap-2">
                返回首页
              </Button>
            </div>
            <div>
              <h2 className="font-display text-3xl text-ink-900">你画我猜</h2>
              <p className="text-sm text-ink-600">
                画手偷偷看词，在屏幕上画，全家围着猜。只能画，不能说！
              </p>
            </div>
            <DrawGame onExit={() => setScreen('home')} />
          </section>
        )}

        {screen === 'price' && (
          <section className="space-y-6">
            <div>
              <Button variant="outline" onClick={() => setScreen('home')} className="gap-2">
                返回首页
              </Button>
            </div>
            <div>
              <h2 className="font-display text-3xl text-ink-900">猜价格</h2>
              <p className="text-sm text-ink-600">
                每轮一件真实商品，轮流报价，最接近真实价格的人得分。
              </p>
            </div>
            <PriceGame onExit={() => setScreen('home')} />
          </section>
        )}

        {screen === 'truthLie' && (
          <section className="space-y-6">
            <div>
              <Button variant="outline" onClick={() => setScreen('home')} className="gap-2">
                返回首页
              </Button>
            </div>
            <div>
              <h2 className="font-display text-3xl text-ink-900">两真一假</h2>
              <p className="text-sm text-ink-600">
                主角说三件自己的事，一件是编的。拆穿得分，骗过全场也得分。
              </p>
            </div>
            <TruthLieGame onExit={() => setScreen('home')} />
          </section>
        )}

        {screen === 'shiliuTown' && (
          <section className="space-y-6">
            <div>
              <Button variant="outline" onClick={() => setScreen('home')} className="gap-2">
                返回首页
              </Button>
            </div>
            <div>
              <h2 className="font-display text-3xl text-ink-900">闫顺儿小镇</h2>
              <p className="text-sm text-ink-600">
                小侦探先找线索，购物小掌柜再算钱。每局短一点，慢慢玩。
              </p>
            </div>
            <WhoPlaying players={players} currentId={playerId} onPick={choosePlayer} />
            <ShiliuTownGame onExit={() => setScreen('home')} />
          </section>
        )}

        {screen === 'yiyiBureau' && (
          <section className="space-y-6">
            <div>
              <Button variant="outline" onClick={() => setScreen('home')} className="gap-2">
                返回首页
              </Button>
            </div>
            <div>
              <h2 className="font-display text-3xl text-ink-900">闫一依任务局</h2>
              <p className="text-sm text-ink-600">
                当策划人、队长和数据分析员，破解一个个任务。数学打头阵，语文英语科学随机混搭，每局都新。
              </p>
            </div>
            <WhoPlaying players={players} currentId={playerId} onPick={choosePlayer} />
            <YiyiBureauGame onExit={() => setScreen('home')} />
          </section>
        )}

        {screen === 'story' && (
          <section className="space-y-6">
            <div>
              <Button variant="outline" onClick={() => setScreen('home')} className="gap-2">
                返回首页
              </Button>
            </div>
            <div>
              <h2 className="font-display text-3xl text-ink-900">编故事</h2>
              <p className="text-sm text-ink-600">
                抽几张关键词卡，限时内编一个把它们都用上的故事。家人当裁判。
              </p>
            </div>
            <StoryGame onExit={() => setScreen('home')} />
          </section>
        )}

        {screen === 'dice' && (
          <section className="space-y-6">
            <div>
              <Button variant="outline" onClick={() => setScreen('home')} className="gap-2">
                返回首页
              </Button>
            </div>
            <div>
              <h2 className="font-display text-3xl text-ink-900">骰子任务</h2>
              <p className="text-sm text-ink-600">掷一下骰子，抽到什么任务全家轮流做，活跃气氛。</p>
            </div>
            <DiceGame onExit={() => setScreen('home')} />
          </section>
        )}

        {screen === 'sound' && (
          <section className="space-y-6">
            <div>
              <Button variant="outline" onClick={() => setScreen('home')} className="gap-2">
                返回首页
              </Button>
            </div>
            <div>
              <h2 className="font-display text-3xl text-ink-900">声音模仿</h2>
              <p className="text-sm text-ink-600">抽一张卡，按提示学个声音，其他人来猜或打分，再传给下一位。</p>
            </div>
            <SoundGame onExit={() => setScreen('home')} />
          </section>
        )}

        {screen === 'memory' && (
          <section className="space-y-6">
            <div>
              <Button variant="outline" onClick={() => setScreen('home')} className="gap-2">
                返回首页
              </Button>
            </div>
            <div>
              <h2 className="font-display text-3xl text-ink-900">记忆翻牌</h2>
              <p className="text-sm text-ink-600">翻开两张找一样的，全配上就赢，考考记性。</p>
            </div>
            <MemoryGame onExit={() => setScreen('home')} />
          </section>
        )}
      </div>
    </div>
  )
}
