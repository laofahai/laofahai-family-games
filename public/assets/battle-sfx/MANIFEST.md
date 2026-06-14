# Battle SFX — 真实采样素材清单

课间大乱斗（打老师 / 知识对战）的真实音效采样。播放逻辑：`src/games/shared/sound.ts`
的 `playSfx(name)` **优先**播放本目录的同名采样（经 `src/games/shared/sfx-samples.ts`
解码播放），仅在缺采样 / 尚未解码完成时回落到原有的 Web Audio 合成音。

## 许可（全部 CC0）

全部 18 个文件均来自 **Kenney**（https://kenney.nl）的免费音效包，许可为
**Creative Commons Zero v1.0 (CC0, Public Domain)** —— https://creativecommons.org/publicdomain/zero/1.0/
可自由用于个人、教育与商业项目，**无需署名**（署名 Kenney / www.kenney.nl 仅为可选致谢）。

来源音效包及其官方下载地址：

| 包 | 官方页面 | 下载 zip |
|---|---|---|
| Impact Sounds (1.0) | https://kenney.nl/assets/impact-sounds | https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip |
| Interface Sounds | https://kenney.nl/assets/interface-sounds | https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip |
| RPG Audio | https://kenney.nl/assets/rpg-audio | https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip |

## 名字 → 采样 映射

格式：Ogg Vorbis（`.ogg`），单/立体声，44.1k 或 48k Hz。

| 文件 | 来源包 | 原始文件名 | 时长 | 大小 | 用途 |
|---|---|---|---|---|---|
| `tap.ogg` | Interface Sounds | `click_001.ogg` | 0.10s | 4.8 KB | UI 点按 |
| `punch.ogg` | Impact Sounds | `impactPunch_medium_000.ogg` | 0.43s | 8.8 KB | 普攻命中（中拳） |
| `hit.ogg` | Impact Sounds | `impactGeneric_light_000.ogg` | 0.14s | 5.8 KB | 普通命中 / 答对（清脆） |
| `crit.ogg` | Impact Sounds | `impactPunch_heavy_000.ogg` | 0.65s | 11.6 KB | 暴击（重拳） |
| `combo.ogg` | Interface Sounds | `confirmation_001.ogg` | 0.29s | 9.0 KB | 连击上扬 |
| `skill.ogg` | RPG Audio | `knifeSlice.ogg` | 0.60s | 15.5 KB | 放技能（横扫 whoosh） |
| `nova.ogg` | Impact Sounds | `impactBell_heavy_000.ogg` | 1.48s | 13.9 KB | 大招爆发（厚重铃响 + 余响） |
| `heal.ogg` | Interface Sounds | `confirmation_003.ogg` | 0.32s | 9.5 KB | 回血（柔和上行） |
| `jump.ogg` | Interface Sounds | `maximize_001.ogg` | 0.26s | 12.1 KB | 跳跃（上滑） |
| `down.ogg` | Impact Sounds | `impactSoft_heavy_000.ogg` | 0.51s | 6.6 KB | 敌人倒下（闷响倒地） |
| `win.ogg` | Interface Sounds | `confirmation_004.ogg` | 0.49s | 12.4 KB | 通关（成功提示） |
| `lose.ogg` | Interface Sounds | `error_006.ogg` | 0.50s | 8.3 KB | 失败（下行失败音） |
| `correct.ogg` | Interface Sounds | `confirmation_002.ogg` | 0.54s | 14.2 KB | 答对叮咚 |
| `wrong.ogg` | Interface Sounds | `error_001.ogg` | 0.16s | 7.4 KB | 答错嗡鸣 |
| `slap.ogg` | RPG Audio | `chop.ogg` | 0.24s | 9.4 KB | 大耳刮子 / 真理巴掌（脆响一击） |
| `kick.ogg` | Impact Sounds | `impactPunch_heavy_001.ogg` | 0.54s | 10.9 KB | 踹 / 回旋踢（重击） |
| `spit.ogg` | RPG Audio | `cloth1.ogg` | 0.66s | 16.5 KB | 呸 / 唾沫（布料短促摩擦近似） |
| `taunt.ogg` | Interface Sounds | `question_001.ogg` | 0.49s | 11.7 KB | 毒舌 / 嘲讽（上挑疑问 sting） |

**合计：18 个文件，约 184 KB（188,411 字节）。** 单文件均在 4.8–16.5 KB，无超 500 KB / 1 MB 者。

## 备注

- `slap`（chop）、`spit`（cloth1）为「近似匹配」：Kenney 这三个 CC0 包里没有现成的
  「人脸巴掌 / 吐口水」拟声素材，故取听感最接近的脆击 / 布料摩擦音；若日后从
  freesound.org CC0 找到更贴切的，直接同名覆盖即可（播放器无需改动）。
- 响度在 `sfx-samples.ts` 的 `GAIN` 表里按名做了微调，避免某一条过吵。
- 替换素材：只要放一个同名 `<name>.ogg` 即可被优先采用；删掉某个文件则该名字自动回落合成。
