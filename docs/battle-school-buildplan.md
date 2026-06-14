# 课间大乱斗 /《觉醒者》— 分批施工图（how / 排期）

> 配套 `battle-school-design.md`（what）。本文件是把大系统拆成**可并行/必串行**的 agent 批次。
> 由架构规划 agent 产出（2026-06）。落地对照执行。

## 铁律（贯穿所有批次）
1. **同一时刻只有一个 agent 改 `game/ArenaScene.ts`**（~1024行，游戏循环/物理/输入/波次/Boss循环/碰撞/juice 全在这）。其余系统写成**独立纯模块**（`bossMoves.ts` / `stage/*` / `expedition.ts` / `coopHost.ts` / `rng.ts`）或 React/UI 文件并行造，再用一次串行 pass 接进 ArenaScene。
2. **种子化随机是 co-op 的脊柱**：建 `game/rng.ts` 包 `Phaser.Math.RandomDataGenerator`；`ArenaScene` 从 `SceneConfig.seed` 取种子（单人=Date.now()，联机=host 广播）。所有"1/3随机"(#26)、远征图/抽卡(#24)、Boss选招(#28) **一律走种子**，绝不用 `Math.random`。这样联机地图同步免费。
3. **`bridge.ts` 的 `SceneConfig`/事件增改是次级瓶颈**：尽量批量改（一次加 `seed`/`expedition?`/`coop?`）。
4. 现状关键：World 是平地横版(`WORLD_W=3600`+单条地面)，无平台/坑/砖；Boss 只会走+扑(无 telegraph/招池)；`BattleQuestion` 无 difficulty 字段；`coop.ts`/`progression.ts`/`LevelBadge` 都写好了但**零调用方**。

## Batch 0 — 地基（round-2 合并后最先做，3 个并行，都不碰 ArenaScene）
- **0A 种子RNG + 题目难度档(#11数据层)**：新建 `game/rng.ts`；`_battle/core.ts` 给 `BattleQuestion` 加 `difficulty?: 'quick'|'deep'`；`_battle/questions.ts` 给 `drawQuestions`/`drawBySubject` 加可选 difficulty 过滤（**优雅降级**：过滤空就退回不过滤，旧的未打标题库照常）。杂兵抽 quick、Boss 抽 deep。
- **0B 成长接线脚手架(#17 非ArenaScene半)**：`App.tsx` 加 `hydrateProgress` + 首页挂 `LevelBadge`；`BattleSchoolGame.tsx` 开始/胜利页显示等级 + level-up toast 位。XP 发放钩子留到 Batch 4。
- **0C Boss招池数据 + telegraph 原语(#28逻辑)**：新建 `game/bossMoves.ts`（纯数据+helper，不碰场景）。`TeacherMove` 类型(telegraphMs≥500/activeMs/recoverMs/dodge/effect) + `MOVE_POOL` 覆盖 §7 全招 + `movesForBoss(def,band,override?)`。

## Batch 1 — #28 老师主动攻击（串行 ArenaScene+Enemy，第一个大「单人好玩」赢点）
依赖 0C。`Enemy` 加 boss 专属 `phase:idle|telegraph|active|recover` 状态机（仿现有 lunge 计时）；**命中框/躲避判定留在 ArenaScene**（它管物理组/hero/juice），Enemy 只暴露 phase+招id。每 2.5~4s(种子)选招。**与破盾循环合流**：盾破窗口(`!isShielded`)内不放主动招（那是玩家进攻回合）；「我点名了」直接复用 `openBossQuiz`/`FloatingQuiz`。低年级招少且慢。

## Batch 2 — #26 固定手工关卡 + 马里奥元素 + 1/3随机（prep 并行 / 接线串行）
- **并行 prep**：2A `game/stage/StageDef.ts`+`stages.ts`(≥2 手工关)+`randomize.ts`(纯函数: StageDef+种子 → ResolvedStage，~33%元素随机)；2B `game/stage/`马里奥实体(QBlock/Pipe/Pit/踩怪 stomp)。
- **串行接线**(改 ArenaScene)：`buildLevelWorld`/`startLevel` 从 ResolvedStage 建平台/坑/管道/砖；坑=掉血+回位**不秒死**；到旗杆/校门→刷 Boss。
- **co-op 约束**：ResolvedStage 必须是 `(StageDef, seed)` 纯函数；本批给 `coop.ts` 的 `CoopShared` 加 `seed` 字段（一行，先备好契约）。

## Batch 3 — #24 Roguelite 觉醒远征（多并行 + ArenaScene 轻接触）
- **并行**：3A `game/expedition.ts`(种子分叉节点图)+`drafts.ts`(战后三选一卡，挂 progression)；3B `ui/ExpeditionMap.tsx`+`DraftScreen.tsx`+`BattleSchoolGame.tsx` 加 expedition/draft 阶段(仿现有 Phase 状态机)。
- **轻串行**：`SceneConfig` 加 `expedition?`；ArenaScene 接收 stageId+run修正、回传更丰富 gameover。

## Batch 4 — #13 技能kit + #15 连招 + #17 XP钩子（串行 ArenaScene 战斗核心）
`Hero.ts` 加免费快速技能(回旋踢/唾沫击退/嘴遁眩晕,能量+CD不答题)；ArenaScene 连招升级(三段击飞/juggle/定身→必杀/答题嵌连招翻倍) + **XP发放钩子**(KO/Boss/连击里程碑/无伤/首通 → 决策在场景、写入在 React 侧调 progression)。`bridge.ts` 加 SkillKind+level-up 事件；`TouchControls`/`Hud` 加技能钮(可在 bridge 落地后并行子 agent)。

## Batch 5 — 联机 co-op 接线（最后，最大并行；让 coop.ts 真能玩）
前面已把架构做成 co-op-aware（种子/共享Boss血/逐玩家XP），本批=大厅+远端渲染+host循环。
- **独立并行**：5A `ui/CoopLobby.tsx`(仿 knowledge-duel `OnlineDuelScreen` 邀请码/presence)；5B `game/coopHost.ts`(纯 reducer: 汇总 hit 扣共享血/推进关卡/团灭判定/生成共享种子/低频快照)。
- **串行**(ArenaScene)：5C 渲染远端英雄、本地伤害走 `coop.sendHit`、Boss血读 `CoopShared`、用共享种子。单人=单 peer 退化路径。

## 并行/串行总表
| 批 | 并行(文件不相交) | 串行(碰 ArenaScene) |
|---|---|---|
| 0 | 0A core/questions+rng · 0B App/UI · 0C bossMoves | — |
| 1 #28 | — | 单agent: ArenaScene+Enemy+roster |
| 2 #26 | 2A 关卡数据/resolver · 2B 马里奥实体（可与B1同时） | 接线: ArenaScene |
| 3 #24 | 3A 远征模型 · 3B 远征React UI | 轻: SceneConfig+ArenaScene 收修正 |
| 4 | (bridge落地后 Hud/TouchControls 子agent) | 主: ArenaScene 战斗+XP |
| 5 联机 | 5A 大厅UI · 5B coopHost reducer | 5C 远端渲染入 ArenaScene |

**co-op-aware 早埋点（免返工）**：①Batch0 种子RNG+SceneConfig.seed ②Batch2 CoopShared.seed ③#26/#24 随机全种子纯函数 ④Batch1 选招种子派生(各端一致) ⑤逐玩家XP keyed by player。

**关键文件**：`game/ArenaScene.ts`(热点) · `game/Enemy.ts` · `game/bridge.ts` · `_battle/coop.ts` · `_battle/questions.ts`(+`core.ts`)
