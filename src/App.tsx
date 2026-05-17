import { useState } from 'react'
import { Gamepad2, Ghost, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CharadesGame } from '@/games/charades/CharadesGame'
import { StoryGame } from '@/games/story/StoryGame'
import { UndercoverGame } from '@/games/undercover/UndercoverGame'
import { cn } from '@/lib/utils'

type Screen = 'home' | 'undercover' | 'charades' | 'story'

const games = [
  { id: 'undercover', name: '谁是卧底', desc: '适合 3 人起玩', status: 'hot' },
  { id: 'charades', name: '你来比划', desc: '手机贴额头，限时猜词', status: 'hot' },
  { id: 'story', name: '编故事', desc: '抽关键词，限时编故事', status: 'hot' },
  { id: 'dice', name: '骰子任务', desc: '敬请期待', status: 'soon' },
  { id: 'draw', name: '你画我猜', desc: '敬请期待', status: 'soon' },
  { id: 'sound', name: '声音模仿', desc: '敬请期待', status: 'soon' },
  { id: 'memory', name: '记忆翻牌', desc: '敬请期待', status: 'soon' },
  { id: 'speed', name: '反应测试', desc: '敬请期待', status: 'soon' },
  { id: 'mystery', name: '神秘游戏', desc: '敬请期待', status: 'soon' },
]

const ACTIVE_GAMES = new Set(['undercover', 'charades', 'story'])

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')

  return (
    <div className="min-h-screen px-4 py-10 md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {screen === 'home' && (
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-white/80 p-2 shadow-sm">
                  <Gamepad2 className="h-6 w-6 text-melon-500" />
                </span>
                <h1 className="font-display text-3xl text-ink-900">家庭小游戏乐园</h1>
              </div>
              <p className="max-w-xl text-sm text-ink-600">
                适合一家人围坐的小游戏清单。九宫格入口，随时开玩。
              </p>
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
              <CardDescription>点击进入小游戏，陆续更新更多玩法。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((game) => {
                const isActive = ACTIVE_GAMES.has(game.id)
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => {
                      if (game.id === 'undercover') setScreen('undercover')
                      else if (game.id === 'charades') setScreen('charades')
                      else if (game.id === 'story') setScreen('story')
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
                    <div>
                      <div className="font-display text-xl text-ink-900">{game.name}</div>
                      <div className="text-xs text-ink-500">{game.desc}</div>
                    </div>
                  </button>
                )
              })}
            </CardContent>
            <CardFooter className="justify-between">
              <div className="text-xs text-ink-500">已上线：谁是卧底、你来比划、编故事。</div>
              <div className="text-xs text-ink-500">更多游戏正在路上。</div>
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
      </div>
    </div>
  )
}
