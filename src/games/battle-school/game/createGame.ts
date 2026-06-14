// 创建 Phaser.Game 的工厂：Scale.RESIZE 填满全屏容器、Arcade 物理、挂载 ArenaScene。
// React 宿主在 mount 时调它、unmount 时 destroy。这里不含任何 React，也不含游戏逻辑。

import Phaser from 'phaser'
import { ArenaScene } from './ArenaScene'
import type { SceneConfig } from './bridge'

export function createGame(parent: HTMLElement, cfg: SceneConfig): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0b0e1a',
    scale: {
      mode: Phaser.Scale.RESIZE, // 跟随容器尺寸填满
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 1800 },
        debug: false,
      },
    },
    render: { antialias: true, pixelArt: false },
    scene: [ArenaScene],
  })
  // 场景启动时把配置喂进去（scene key 与 ArenaScene 的 super('arena') 一致）。
  game.scene.start('arena', cfg)
  return game
}
