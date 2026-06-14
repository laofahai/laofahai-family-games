// 打老师·全屏 Phaser 宿主：与 _battle/PhaserHost 不同，这里用 Scale.RESIZE 让画布
// 铺满父容器（父容器是 fixed inset-0 的全屏舞台），并在容器尺寸变化时同步 resize。
// 逻辑全在 React，这里只负责把 BattleScene 挂上、把 game 交回上层（onReady）。
//
// 为何不复用 _battle/PhaserHost：那个用 Scale.FIT + 固定 800x450 逻辑分辨率（适合「小舞台」）；
// 横版要「世界比屏宽、相机跟随」，画布需铺满视口、随窗口实时 resize，用 RESIZE 更顺手。
// _battle 不可改，故在本游戏内单独加这个全屏宿主。

import Phaser from 'phaser'
import { useEffect, useRef } from 'react'
import { BattleScene } from './scene'

export interface PhaserStageProps {
  backgroundColor?: string
  /** 实例就绪回调：拿到 game 后可取 scene 挂引用 */
  onReady?: (game: Phaser.Game) => void
  className?: string
}

export function PhaserStage({ backgroundColor = '#1b1726', onReady, className }: PhaserStageProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    const parent = parentRef.current
    if (gameRef.current || !parent) return // 防重复（StrictMode）

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: parent.clientWidth || window.innerWidth,
      height: parent.clientHeight || window.innerHeight,
      backgroundColor,
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
      render: { antialias: true, pixelArt: false },
      scene: BattleScene,
    })
    gameRef.current = game
    // 关键：等场景真正创建好再回调，否则 getScene('battle') 可能拿到 null/未启动实例，
    // 导致上层 sceneRef 为空、setMove/spawnEnemy 全部空转（之前「走不动」的根因）。
    const fire = () => onReadyRef.current?.(game)
    game.events.once(Phaser.Core.Events.READY, () => {
      const scene = game.scene.getScene('battle')
      if (scene && !scene.sys.isActive()) {
        scene.events.once(Phaser.Scenes.Events.CREATE, fire)
      } else {
        fire()
      }
    })

    // 容器尺寸变化 → 同步画布尺寸（RESIZE 模式下手动 resize 最稳，scene 内部读 scale.width/height 重排）
    const ro = new ResizeObserver(() => {
      const w = parent.clientWidth
      const h = parent.clientHeight
      if (w > 0 && h > 0) game.scale.resize(w, h)
    })
    ro.observe(parent)

    return () => {
      ro.disconnect()
      game.destroy(true)
      gameRef.current = null
    }
    // 只在挂载/卸载跑；尺寸交给 ResizeObserver
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={parentRef} className={className ?? 'h-full w-full'} />
}
