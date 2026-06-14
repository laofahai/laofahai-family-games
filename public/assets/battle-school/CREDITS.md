# 课间大乱斗 美术素材来源 / Asset Credits

本游戏角色精灵全部来自 **Kenney「Toon Characters 1」** 素材包。

## 来源 / Source

- 资源包名 / Pack: **Toon Characters 1**（Toon Characters Pack 1，创建于 2019-09-26）
- 作者 / Author: **Kenney** — https://kenney.nl
- 资源主页 / Asset page: https://kenney.nl/assets/toon-characters-1
- 实际下载地址 / Download used: https://opengameart.org/sites/default/files/kenney_toonCharacters1.zip
  （OpenGameArt 上的官方镜像；包名 `kenney_toonCharacters1.zip`，约 5.5 MB）
- OpenGameArt 条目 / OGA listing: https://opengameart.org/content/toon-characters-1

## 许可 / License

**CC0 1.0 Universal（公有领域 / Public Domain）**
https://creativecommons.org/publicdomain/zero/1.0/

> 可自由用于个人、教育与**商业**项目，**无需署名**（署名为自愿）。
> Free for personal, educational and commercial use. Attribution not required (but appreciated).

出于礼貌仍在此署名 Kenney（www.kenney.nl）。

## 用到的角色 → 游戏角色映射 / Character mapping

从原包 6 个角色中各取若干姿势帧（96×128 PNG），裁剪/重命名后放入本目录：

| 游戏角色 | 原包角色 | 文件前缀 |
| --- | --- | --- |
| 主角（小孩） / hero | Male adventurer | `hero_*` |
| 老师 BOSS / teacher | Male person（成年男·有胡子；场景内再叠加眼镜+教鞭，强化「老师」识别） | `teacher_*` |
| 同学 A / classmate | Female adventurer | `kidA_*` |
| 同学 B / classmate | Female person | `kidB_*` |
| 同学 C / classmate | Robot | `kidC_*` |
| 同学 D / classmate | Zombie | `kidD_*` |

同学具体用哪一款，由 `spawnEnemy/spawnWave` 传入的 emoji+name 哈希决定（见 `scene.ts` 的 `pickVariant`），不同同学看起来各不相同。

## 用到的姿势帧 / Poses used

每个角色保留以下 8 帧（来自原包 `PNG/Poses/`）：

- `idle`（待机）
- `walk0`~`walk3`（4 帧走路循环，原包 walk0–7 中取前 4 帧）
- `attack2`（出拳/攻击姿势）
- `hurt`（受击）
- `jump`（跳跃）

动画为**帧式**（frame-based）：待机=idle，移动=walk 循环，攻击=attack2，受击=hurt，跳跃=jump；
另叠加场景原有的补间「果冻」手感（挤压拉伸/走路颠簸/朝向翻转）。

原包中未使用的姿势（cheer/climb/duck/talk 等）与 HD/Vector/Tilesheet 版本均**未打包**，仅保留实际用到的 48 个 PNG，控制体积（约 210 KB）。
