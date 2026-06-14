// Phaser 挂载宿主：把一个 Phaser.Game 挂进 React 容器。
// 负责生命周期（防 React StrictMode 双挂载重复建实例）、自适应缩放、卸载销毁。
// 两个战斗游戏的 Phaser 场景都通过它挂载；游戏入口用 React.lazy 动态 import 自己的
// 游戏组件，从而让 phaser 和场景代码进独立 chunk、不进首屏主包。
//
// React 与 Phaser 的通信走 game.events（EventEmitter）：场景里 emit/答题事件，
// 上层 React 监听并弹原生答题层；答完再 emit 回去让场景继续。onReady 把 game 交给上层。

import Phaser from 'phaser'
import { useEffect, useRef } from 'react'

export interface PhaserHostProps {
  /** 逻辑分辨率（引擎用 FIT 自适应到容器，手机也不变形） */
  width?: number
  height?: number
  backgroundColor?: string
  /** 场景（类或实例数组） */
  scene: Phaser.Types.Scenes.SceneType | Phaser.Types.Scenes.SceneType[]
  /** 传给首个场景 scene.start 的数据 */
  sceneData?: Record<string, unknown>
  /** 实例就绪回调：拿到 game 后可挂 game.events 监听、做 React↔Phaser 桥 */
  onReady?: (game: Phaser.Game) => void
  className?: string
}

export function PhaserHost({
  width = 800,
  height = 450,
  backgroundColor = '#faf7f2',
  scene,
  sceneData,
  onReady,
  className,
}: PhaserHostProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  // 把可能每次渲染变化的回调/数据收进 ref，避免进 effect 依赖导致重建实例
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const dataRef = useRef(sceneData)
  dataRef.current = sceneData

  useEffect(() => {
    if (gameRef.current || !parentRef.current) return // 防重复（StrictMode）
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parentRef.current,
      width,
      height,
      backgroundColor,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, pixelArt: false },
      scene,
    })
    gameRef.current = game
    // 把初始数据塞进 registry，场景 create 时可 this.registry.get(...) 取
    if (dataRef.current) {
      for (const [k, v] of Object.entries(dataRef.current)) game.registry.set(k, v)
    }
    onReadyRef.current?.(game)
    return () => {
      game.destroy(true)
      gameRef.current = null
    }
    // 只在挂载/卸载时跑；尺寸/场景固定，变化不重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={parentRef}
      className={className ?? 'mx-auto aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-3xl shadow-sm'}
    />
  )
}
