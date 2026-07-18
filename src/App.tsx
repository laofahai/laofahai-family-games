import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ChevronDown, DoorOpen, Gamepad2, Ghost, Sparkles, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { addDeviceLogin, getDeviceLogins, isAdmin, isUnlocked, tryUnlock } from '@/platform/access'
import { UnlockGate, type UnlockInfo } from '@/platform/UnlockGate'
import { IdentitySheet } from '@/platform/IdentitySheet'
import { AdminPanel } from '@/platform/AdminPanel'
import { PartyRoom } from '@/platform/PartyRoom'
import { PresenceStrip } from '@/platform/PresenceStrip'
import { ACTIVE_GAME_IDS, GAMES, gameSections, type GameMeta } from '@/platform/catalog'
import { addPlayer, getPlayers, removePlayer, type Player } from '@/platform/players'
import { getCurrentPlayer, hydratePlayer, setCurrentPlayer, setSyncCode } from '@/platform/progress'
import { hydrateBadges, recordPlayed, type BadgeDef } from '@/platform/badges'
import { hydrateProgress } from '@/platform/progression'
import { roomsAvailable } from '@/platform/rooms'
import { usePresence } from '@/platform/presence'
import { LevelBadge } from '@/platform/LevelBadge'
import { BadgeUnlock } from '@/platform/BadgeUnlock'
import { contentKeysForGame, ensureContent } from '@/platform/content'
import { AGE_BANDS, ageOverlaps } from '@/platform/taxonomy'
import { cn } from '@/lib/utils'

const UndercoverGame = lazy(() =>
  import('@/games/undercover/UndercoverGame').then((m) => ({ default: m.UndercoverGame }))
)
const CharadesGame = lazy(() =>
  import('@/games/charades/CharadesGame').then((m) => ({ default: m.CharadesGame }))
)
const KnowYouGame = lazy(() =>
  import('@/games/know-you/KnowYouGame').then((m) => ({ default: m.KnowYouGame }))
)
const DrawGame = lazy(() => import('@/games/draw/DrawGame').then((m) => ({ default: m.DrawGame })))
const PriceGame = lazy(() => import('@/games/price/PriceGame').then((m) => ({ default: m.PriceGame })))

type Screen =
  | 'home'
  | 'party'
  | 'undercover'
  | 'charades'
  | 'knowYou'
  | 'draw'
  | 'price'

const games = GAMES
const ACTIVE_GAMES = ACTIVE_GAME_IDS

function loadBand(): string {
  try {
    return localStorage.getItem('fg:ageBand') ?? 'all'
  } catch {
    return 'all'
  }
}

function GameLoading({ name }: { name: string }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-ink-200 bg-white/60 p-8 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-melon-200 border-t-melon-500" />
      <div className="text-sm font-semibold text-ink-600">正在加载{name}…</div>
    </div>
  )
}

export default function App() {
  const [unlocked, setUnlocked] = useState(isUnlocked)
  const [showMe, setShowMe] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [screen, setScreen] = useState<Screen>('home')
  const [remoteEntry, setRemoteEntry] = useState<string | null>(null)
  const [partyCode, setPartyCode] = useState<string | null>(null)
  const [partyGame, setPartyGame] = useState<string | null>(null)
  const [showMoreGames, setShowMoreGames] = useState(false)
  const [bandId, setBandId] = useState<string>(loadBand)
  const [loadingGame, setLoadingGame] = useState<string | null>(null)
  const [contentError, setContentError] = useState('')

  const band = AGE_BANDS.find((b) => b.id === bandId) ?? AGE_BANDS[0]
  const roomReady = roomsAvailable()

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
  const [newBadges, setNewBadges] = useState<BadgeDef[]>([])
  // 进度（等级/称号/金币）是 localStorage 同步读的；hydrateProgress 异步合并完云端后
  // 改本地缓存，需要 bump 这个版本号触发顶栏等级牌重读最新数据。
  const [progressVersion, setProgressVersion] = useState(0)
  const currentPlayer = players.find((p) => p.id === playerId)
  const presenceUsers = usePresence({
    enabled: unlocked && roomReady,
    playerId,
    name: currentPlayer?.name ?? '玩家',
    emoji: currentPlayer?.emoji ?? '🙂',
    roomCode: partyCode,
  })

  // 大人（爸妈/管理员）能看到所有游戏；孩子只看到「自己的」私人游戏（owner），看不到兄弟姐妹的
  const isGrownup = playerId === 'dad' || playerId === 'mom' || isAdmin()
  const visibleGames = useMemo(
    () =>
      games.filter(
        (g) =>
          (band.id === 'all' || ageOverlaps(g.age, band.range)) &&
          (!g.owner || isGrownup || g.owner.includes(playerId))
      ),
    [band, playerId, isGrownup]
  )
  const visibleSections = useMemo(() => gameSections(visibleGames), [visibleGames])

  const choosePlayer = (id: string) => {
    setPlayerId(id)
    setCurrentPlayer(id)
    void hydratePlayer(id) // 连了同步码的人，切到 TA 就先把云端进度拉回合并
    void hydrateBadges(id) // 勋章也跟着拉回来
    void hydrateProgress(id).then(() => setProgressVersion((v) => v + 1)) // 成长（等级/金币）也拉回，拉完刷新顶栏牌
  }

  // 进一个游戏：记「这个人玩过它」（探索勋章用），顺手评出新勋章弹庆祝
  const enterGame = async (screenKey: Screen, gameId: string) => {
    setLoadingGame(gameId)
    setContentError('')
    const ready = await ensureContent(contentKeysForGame(gameId))
    setLoadingGame(null)
    if (!ready) {
      setContentError('题库加载失败，检查网络后再试一次。')
      return
    }
    const fresh = recordPlayed(playerId, gameId)
    if (fresh.length) setNewBadges(fresh)
    setRemoteEntry(null)
    setScreen(screenKey)
  }

  const enterRemoteGame = async (gameId: string) => {
    setLoadingGame(gameId)
    setContentError('')
    const ready = await ensureContent(contentKeysForGame(gameId))
    setLoadingGame(null)
    if (!ready) {
      setContentError('题库加载失败，检查网络后再试一次。')
      return
    }
    const fresh = recordPlayed(playerId, gameId)
    if (fresh.length) setNewBadges(fresh)
    setRemoteEntry(gameId)
    setPartyCode(null)
    setPartyGame(null)
    setScreen('party')
  }

  const enterParty = () => {
    setContentError('')
    setRemoteEntry(null)
    setPartyCode(null)
    setPartyGame(null)
    setScreen('party')
  }

  const launchPartyGame = async (gameId: string) => {
    setLoadingGame(gameId)
    setContentError('')
    const ready = await ensureContent(contentKeysForGame(gameId))
    setLoadingGame(null)
    if (!ready) {
      setContentError('题库加载失败，检查网络后再试一次。')
      return
    }
    const fresh = recordPlayed(playerId, gameId)
    if (fresh.length) setNewBadges(fresh)
    setPartyGame(gameId)
  }

  const renderGameCard = (game: GameMeta) => {
    const isActive = ACTIVE_GAMES.has(game.id)
    return (
      <div
        key={game.id}
        className={cn(
          'group flex min-h-[150px] flex-col items-start justify-between rounded-3xl border border-ink-100/70 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md',
          !isActive && 'opacity-70'
        )}
      >
        <div className="flex w-full flex-1 flex-col items-start justify-between text-left">
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
          <div className="w-full pt-4">
            <div className="flex items-center justify-between gap-2">
              <div className="font-display text-xl text-ink-900">{game.name}</div>
              <span className="shrink-0 rounded-full bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-ink-500">
                {game.audience}
              </span>
            </div>
            <div className="text-xs text-ink-500">{game.desc}</div>
          </div>
        </div>
        <div className="mt-3 grid w-full gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              if (!isActive) return
              void enterGame(game.id as Screen, game.id)
            }}
            disabled={!isActive || loadingGame === game.id}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-ink-900 px-3 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingGame === game.id ? '加载中' : '开始玩'}
          </button>
          {roomReady && game.supportsRoom && isActive && (
            <button
              type="button"
              onClick={() => void enterRemoteGame(game.id)}
              disabled={loadingGame === game.id}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-orange-200 bg-orange-50 px-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <DoorOpen className="h-4 w-4" />
              {loadingGame === game.id ? '加载中' : '一起玩儿'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // 进场时只同步玩家数据；题库改为点击游戏时按需加载，避免首页拉全量内容。
  useEffect(() => {
    void hydratePlayer(playerId)
    void hydrateBadges(playerId)
    void hydrateProgress(playerId).then(() => setProgressVersion((v) => v + 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddPlayer = (name: string) => {
    const p = addPlayer(name)
    setPlayers(getPlayers())
    addDeviceLogin(p.id) // 本机加的人也算「登录过」，可在切换列表里出现
    choosePlayer(p.id)
  }

  const handleRemovePlayer = (id: string) => {
    removePlayer(id)
    const next = getPlayers()
    setPlayers(next)
    if (playerId === id) choosePlayer(next[0]?.id ?? 'guest')
  }

  // 登录：个人码→自动选中那个人并绑成 TA 的个人码；管理员→只认身份、不绑码。都记进「本机登录过」。
  const handleUnlocked = (info?: UnlockInfo) => {
    setUnlocked(true)
    if (!info) return
    const existing = getPlayers().find((p) => p.name === info.name)
    let pid: string
    if (existing) {
      pid = existing.id
    } else {
      pid = addPlayer(info.name).id
      setPlayers(getPlayers())
    }
    if (!info.admin) setSyncCode(info.code, pid) // 管理员不把管理码绑成个人码
    addDeviceLogin(pid)
    choosePlayer(pid)
  }

  // 「我」面板里用码登录别人：校验通过就切到 TA（管理员请走解锁页两步）
  const handleLoginOther = async (code: string): Promise<boolean> => {
    const res = await tryUnlock(code)
    if (res.ok && res.person) {
      handleUnlocked(res.person)
      return true
    }
    return false
  }

  if (!unlocked) {
    return <UnlockGate onUnlocked={handleUnlocked} />
  }

  return (
    <div className="min-h-[100dvh] px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-[calc(env(safe-area-inset-top)+2.5rem)] md:px-10">
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      {showMe && (
        <IdentitySheet
          players={players}
          currentId={playerId}
          deviceLogins={getDeviceLogins()}
          onPick={choosePlayer}
          onAdd={handleAddPlayer}
          onRemove={handleRemovePlayer}
          onLoginOther={handleLoginOther}
          onClose={() => setShowMe(false)}
        />
      )}
      <BadgeUnlock badges={newBadges} onClose={() => setNewBadges([])} />
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
              <button
                type="button"
                onClick={enterParty}
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-orange-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
              >
                <DoorOpen className="h-4 w-4" />
                一起玩 · 建小组语音房
              </button>
            </div>

            <div className="flex flex-col items-start gap-2 self-start md:items-end">
              <div className="flex flex-wrap items-center gap-2">
                {/* 顶栏成长牌：当前玩家在《觉醒者》里的等级 / 中二称号 / 金币 */}
                <LevelBadge key={`${playerId}:${progressVersion}`} playerId={playerId} compact />
                {isAdmin() && (
                  <button
                    type="button"
                    onClick={() => setShowAdmin(true)}
                    className="flex min-h-11 items-center gap-2 rounded-full border border-melon-200 bg-melon-50 px-4 text-sm font-semibold text-melon-700 shadow-sm transition hover:border-melon-300"
                  >
                    管理
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowMe(true)}
                  className="flex min-h-11 items-center gap-2 rounded-full border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-700 shadow-sm transition hover:border-melon-300"
                >
                  <UserRound className="h-4 w-4 text-melon-600" />
                  <span className="text-ink-400">我</span>
                  <span>{currentPlayer?.emoji ?? '🙂'}</span>
                  <span>{currentPlayer?.name ?? '选一个'}</span>
                  <span className="text-ink-400">▾</span>
                </button>
              </div>
              <PresenceStrip users={presenceUsers} currentPlayerId={playerId} className="max-w-full md:max-w-md" />
            </div>
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
                      'min-h-11 rounded-full border px-4 text-sm font-semibold transition',
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
            {contentError && (
              <div className="mx-6 mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {contentError}
              </div>
            )}
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleSections.main.map(renderGameCard)}
              {visibleSections.more.length > 0 && (
                <div className="col-span-full space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowMoreGames((v) => !v)}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-200 bg-white/65 text-sm font-semibold text-ink-600 transition hover:border-melon-300"
                  >
                    <ChevronDown className={cn('h-4 w-4 transition', showMoreGames && 'rotate-180')} />
                    {showMoreGames ? '收起轻小游戏' : `更多轻小游戏（${visibleSections.more.length}）`}
                  </button>
                  {showMoreGames && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {visibleSections.more.map(renderGameCard)}
                    </div>
                  )}
                </div>
              )}
              {visibleGames.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
                  这个年龄段暂时没有游戏，换一个试试。
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-between">
              <div className="text-xs text-ink-500">
                常用 {visibleSections.main.length} 个，轻小游戏 {visibleSections.more.length} 个。
              </div>
              <div className="text-xs text-ink-500">多人各自用手机：点顶部「一起玩·建小组语音房」，进去先语音，想玩再选游戏。</div>
            </CardFooter>
          </Card>
        )}

        {screen === 'party' && (
          <section className="space-y-6">
            <div>
              <Button
                variant="outline"
                onClick={() => {
                  setScreen('home')
                  setRemoteEntry(null)
                  setPartyCode(null)
                  setPartyGame(null)
                }}
                className="gap-2"
              >
                返回首页
              </Button>
            </div>
            <PartyRoom
              initialGame={remoteEntry}
              presenceUsers={presenceUsers}
              onReady={setPartyCode}
              onLeave={() => {
                setScreen('home')
                setRemoteEntry(null)
                setPartyCode(null)
                setPartyGame(null)
              }}
              onLaunch={(gameId) => void launchPartyGame(gameId)}
            />
            {contentError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {contentError}
              </div>
            )}
            {partyCode && partyGame && (
              <Suspense fallback={<GameLoading name="远程游戏" />}>
                {partyGame === 'undercover' && <UndercoverGame startRemote partyCode={partyCode} />}
                {partyGame === 'charades' && (
                  <CharadesGame startRemote partyCode={partyCode} onExit={() => setPartyGame(null)} />
                )}
                {partyGame === 'knowYou' && (
                  <KnowYouGame startRemote partyCode={partyCode} onExit={() => setPartyGame(null)} />
                )}
                {partyGame === 'draw' && <DrawGame startRemote partyCode={partyCode} onExit={() => setPartyGame(null)} />}
                {partyGame === 'price' && <PriceGame startRemote partyCode={partyCode} onExit={() => setPartyGame(null)} />}
              </Suspense>
            )}
          </section>
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
            <Suspense fallback={<GameLoading name="谁是卧底" />}>
              <UndercoverGame startRemote={remoteEntry === 'undercover'} />
            </Suspense>
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
            <Suspense fallback={<GameLoading name="你来比划" />}>
              <CharadesGame startRemote={remoteEntry === 'charades'} onExit={() => setScreen('home')} />
            </Suspense>
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
            <Suspense fallback={<GameLoading name="我知道你不知道" />}>
              <KnowYouGame startRemote={remoteEntry === 'knowYou'} onExit={() => setScreen('home')} />
            </Suspense>
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
            <Suspense fallback={<GameLoading name="你画我猜" />}>
              <DrawGame startRemote={remoteEntry === 'draw'} onExit={() => setScreen('home')} />
            </Suspense>
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
            <Suspense fallback={<GameLoading name="猜价格" />}>
              <PriceGame startRemote={remoteEntry === 'price'} onExit={() => setScreen('home')} />
            </Suspense>
          </section>
        )}

      </div>
    </div>
  )
}
