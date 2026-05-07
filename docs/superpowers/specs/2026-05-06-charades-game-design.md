# 你来比划我来猜（Charades）— 设计文档

- 状态：Draft → Pending review
- 日期：2026-05-06
- 所属仓库：`laofahai-family-games`
- 目标交付：在现有 React + TypeScript + Vite + Tailwind v4 项目中新增 charades 游戏，与已有的"谁是卧底"并列。

## 1. 目标

实现一款手机端、家庭聚会场景下的"你来比划我来猜"小游戏，主打：

- **随机性高、上手快**：进入即玩，最少配置
- **手机贴额头玩法（Heads Up 模式）**：屏幕朝外，靠手腕翻转判定对/过
- **屏幕常亮**：游戏过程不黑屏
- **多档计时**：60 / 90 / 120 / 180 秒
- **词库丰富**：≥ 800 词，**仅按难度分层，不再做分类**

## 2. 玩法定义

采用 **Heads Up 模式（A 模式）**：

- 持手机者把手机正立举到额头，**屏幕朝外**，自己看不到
- 其他家人看到屏幕上的词，**对持手机者比划**
- 持手机者**猜词**，根据反馈翻动手机：
  - **手机向前翻倒**（屏幕朝下）= **猜对** → 下一题
  - **手机向后翻倒**（屏幕朝上）= **过 / 跳过** → 下一题
- 倒计时结束自动结算

只做单局玩法，不做内置多人轮换；想轮流就大家轮流点"再来一局"。

## 3. 用户流程

```
首页（已有 App.tsx 九宫格）
  ↓ 点击"你来比划"
首次进入：玩法引导页（图示 + "启用动作感应"按钮）
  ↓
难度 + 时长选择页（默认：简单+中等，90 秒）
  ↓ 点"开始"
3-2-1 倒计时（同时申请 Wake Lock / 检测横屏 / 启用动作监听）
  ↓
游戏进行：大字显示当前词；翻转判定对/过；屏幕全屏闪绿/红 + 短震 + 短音效
  ↓ 倒计时结束
结算页：本局总数（对 X / 过 Y）+ 词单回顾（每个词标 ✓/✗，可滚动）
  ↓
[再来一局] [换设置] [返回首页]
```

**首次进入引导页**仅在第一次进入 charades 时显示（不论设备类型）。`localStorage` 记两个独立标记：
- `charades.introSeen`：是否看过引导页
- `charades.motionPermission`：iOS 权限状态（`granted` / `denied` / 未设置）

后续进入直接到难度时长页。引导页上的"启用动作感应"按钮在非 iOS 设备上文案改为"我知道了"——同样在用户手势中尝试调用一次，无 `requestPermission` 方法的浏览器直接当作 granted 处理。

**主路径只有"难度 + 时长"两个选择**，不再设特色挑战 / 主题包；最大化随机感。

## 4. 架构与组件

### 4.1 文件结构

```
src/
  games/
    charades/
      CharadesGame.tsx          # 顶层组件，stage 状态机
      stages/
        IntroStage.tsx          # 玩法引导（首次进入）
        SetupStage.tsx          # 难度 + 时长选择
        CountdownStage.tsx      # 3-2-1
        PlayingStage.tsx        # 比划猜进行中
        ResultStage.tsx         # 结算 + 词单回顾
      components/
        WordCard.tsx            # 大字显示当前词
        FeedbackOverlay.tsx     # 全屏闪绿/红动画
        OrientationGuard.tsx    # 检测竖屏时显示"请横屏"
        SoundToggle.tsx         # 顶部静音/关震切换
      hooks/
        useFlipDetector.ts      # 翻转检测（accelerationIncludingGravity.z）
        useWakeLock.ts          # 屏幕常亮
        useMotionPermission.ts  # iOS 13+ 权限请求
        useCountdown.ts         # 倒计时（按帧 / setInterval）
      data/
        charades-words.ts       # 词库
      types.ts                  # WordEntry, Difficulty, Stage 等类型
      utils/
        shuffle.ts              # 抽词、防重复算法
        sounds.ts               # 音效播放（WebAudio 或 <audio>）
```

### 4.2 顶层状态机（CharadesGame.tsx）

用 `useReducer` 管理：

```ts
type Stage = 'intro' | 'setup' | 'countdown' | 'playing' | 'result'

interface State {
  stage: Stage
  config: {
    difficulties: Set<Difficulty>   // 默认 ['easy', 'medium']
    durationSec: 60 | 90 | 120 | 180 // 默认 90
  }
  session: {
    words: WordEntry[]              // 这一局抽到的全部词
    cursor: number                  // 当前是第几题
    results: ('correct' | 'pass')[] // 与 cursor 对齐，长度 = 已判定数
    secondsLeft: number
  }
  ui: {
    sound: boolean   // 默认 true，存到 localStorage
    haptic: boolean  // 默认 true，存到 localStorage
  }
}
```

**actions**：`START_SETUP / START_COUNTDOWN / START_PLAYING / TICK / MARK_CORRECT / MARK_PASS / END / RESET`

### 4.3 入口接入

修改 `src/App.tsx`：

- `Screen` 类型加 `'charades'`
- 九宫格中 `id: 'charades'` 改为 `status: 'hot'`，点击切到 charades 屏
- 渲染 `<CharadesGame onExit={() => setScreen('home')} />`

## 5. 词库设计

### 5.1 数据结构

```ts
// src/games/charades/types.ts
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface WordEntry {
  text: string
  difficulty: Difficulty
}
```

**没有分类字段**。词库就是一个扁平列表，仅按难度分层。

### 5.2 量级

| 难度          | 实际词数  | 内容方向                                  |
|--------------|----------|------------------------------------------|
| easy         | 253      | 常见动物、食物、生活物品、基础动作、入门成语、全民动画角色 |
| medium       | 377      | 中等难度名词、典型成语、经典影视/动漫人物、复合动作       |
| hard         | 176      | 较难成语、历史/明星人物、复杂动作、罕见动物食物         |
| **总计**     | **806**   | —                                        |

### 5.3 内容生成原则

- 词必须"**能比划**"：纯抽象概念（如"民主""熵"）不收
- 同义/近义词避免重复（既有"小狗"就不再放"狗"）
- 成语优先选**有动作画面感**的（"狐假虎威""画蛇添足"），抽象成语（"指鹿为马"动作弱）放 hard
- 影视人物优先选**全民认知度高**的（孙悟空、葫芦娃、海绵宝宝、周杰伦），冷门人物不收
- **不修改原 `src/data/word-bank.ts`**（谁是卧底仍依赖它）；charades 自带独立词库

### 5.4 抽词算法（utils/shuffle.ts）

- 按用户勾选的难度集合过滤词池
- Fisher-Yates 洗牌后顺序消费
- **同一局内不重复**：词池足够大时不会循环
- 词池小于一局可能消耗的题数时，洗完一轮后再洗第二轮，标记 `lap` 用于结算页区分

## 6. 翻转检测（hooks/useFlipDetector.ts）

### 6.1 算法

读取 `DeviceMotionEvent.accelerationIncludingGravity.z`（单位 m/s²）：

- 横屏正立举着时，`z ≈ 0`（重力主要在 y 上）
- 屏幕**朝下**（向前翻 = 对）：`z ≈ -9.8`
- 屏幕**朝上**（向后翻 = 过）：`z ≈ +9.8`

### 6.2 状态机

```
NEUTRAL ─── z < -6 ──► CORRECT_FIRED ──┐
   ▲                                    │
   │       z > +6 ──► PASS_FIRED ───────┤
   │                                    │
   └──────  AND(|z|<4, 自触发起 ≥ 600ms) ◄ 复位条件
                                        │
              ▼                         │
         触发外部回调（onCorrect/onPass）
```

**复位（回到 NEUTRAL）必须同时满足两个条件**：
1. `|z| < 4`（手机回到接近水平举立的中立姿态）
2. 距上次触发已过 600ms 冷却

任何一个不满足都保持 FIRED 状态，不再二次触发。

阈值 `±6` 与中立区 `|z| < 4` 是经验值，会在真机上微调。冷却时间防止"翻转回正过程中再次触发"。

### 6.3 采样与节流

- 监听 `devicemotion` 事件，但每次回调内做轻量判断（无 setState 风暴）
- 每 50ms 取一次有效采样（节流），避免高频更新
- 用 `useRef` 持有内部状态，仅在状态切换瞬间调用外部 `onCorrect / onPass` 回调

### 6.4 降级方案

设备不支持或权限被拒：

- 自动切换为**屏幕点按模式**：左半屏点击 = 对，右半屏点击 = 过
- 顶部小提示一行："感应不可用，点屏幕：左对 / 右过"
- 结算页不区分两种模式

## 7. 屏幕常亮（hooks/useWakeLock.ts）

- 进入 `playing` stage 时调用 `navigator.wakeLock.request('screen')`
- `visibilitychange` 切回前台时重新申请（系统会在切走时自动释放）
- 离开 stage / 组件卸载时 `lock.release()`
- 不支持的浏览器（旧 Safari、部分国产浏览器）静默失败，不打断游戏

## 8. 横屏策略（components/OrientationGuard.tsx）

- **不强制**调用 `screen.orientation.lock`（兼容性差，需要 fullscreen，国产浏览器普遍不支持）
- 改为**软引导**：用 `window.matchMedia('(orientation: portrait)')` 检测，若处于竖屏，全屏显示提示卡片"请把手机横过来玩"，并暂停所有游戏逻辑
- 转到横屏后自动恢复

## 9. iOS 权限（hooks/useMotionPermission.ts）

iOS 13+ 要求 `DeviceMotionEvent.requestPermission()` 在用户手势中调用：

- 引导页"启用动作感应"按钮的 `onClick` 中调用
- 返回 `'granted'`：进入正常流程
- 返回 `'denied'`：进入降级（点按模式），提示用户"已使用点按模式"
- 不存在 `requestPermission` 方法（Android、桌面）：直接当作 granted

## 10. 反馈（视觉 + 震动 + 音效）

### 10.1 视觉

`FeedbackOverlay`：

- "对"：全屏绿色覆盖（80% 不透明）+ 大号"✓"图标 + "对！"，350ms 内淡出
- "过"：全屏黄/红 + "✗" + "过~"，同样 350ms
- 用 CSS transition / Tailwind animate；不要堵塞 stage 切词

### 10.2 震动

- 对：`navigator.vibrate(80)`
- 过：`navigator.vibrate([40, 40, 40])`（短-停-短-停-短，差异化）
- 不支持的设备静默失败

### 10.3 音效（utils/sounds.ts）

- 用预加载的短音频（base64 内嵌或 public/sounds/ 下两个 <100KB 的 .mp3）
- 对：清脆"叮"
- 过：低沉"嗡"
- 用 `<audio>` 元素或 `WebAudio AudioBufferSourceNode` 播放
- 首次播放需要用户手势触发（开始游戏的点击就能解锁）

### 10.4 静音 / 关震开关

- 顶部右上角小图标（喇叭 + 震动），点击切换
- 状态存 `localStorage`：`charades.sound` / `charades.haptic`
- 默认全开

## 11. 计时（hooks/useCountdown.ts）

- 用 `requestAnimationFrame` 驱动剩余毫秒精度计算（避免 `setInterval` 在后台被节流后跑偏）
- 每帧比对 `performance.now()` 与开始时间
- 暴露 `secondsLeft`（向下取整）和 `progress`（0~1，用于进度条）
- 倒计时进度条放在屏幕顶部窄带（不抢占词显示区）
- 最后 10 秒进度条变红 + 每秒"嘀"音效（如果未静音）

## 12. UI 视觉规范

- 主色沿用现有 melon-500 系（统一项目风格）
- 词显示用大号 sans 字体（80~120px），超长词自动缩放
- "对"绿色用 emerald-500，"过"红色用 rose-500（或现有 ink 调色板内对应色）
- 整局横屏布局，避免任何竖向 scroll 干扰
- 结算页词单纵向滚动列表，每行：`[✓ / ✗] 词 (难度小标签)`

## 13. 错误处理

| 情况                        | 行为                                     |
|----------------------------|----------------------------------------|
| Wake Lock API 不可用         | 静默失败                                  |
| DeviceMotionEvent 不可用     | 自动切到点按模式                            |
| iOS 权限被拒绝               | 自动切到点按模式 + 顶部提示一行                  |
| 切到后台再回前台              | 倒计时**暂停**直到回前台；Wake Lock 重新申请       |
| 词库为空（不该发生）           | 结算页显示"无可用词"，按钮回到 setup           |
| 旋转屏 / 误触刷新             | OrientationGuard 接管 / 刷新视为退出当前局     |

## 14. 测试与验证

### 14.1 单元 / 纯逻辑

- `useFlipDetector` 状态机：mock `devicemotion` 事件序列，断言 `onCorrect / onPass` 仅在正确节点触发
- `shuffle` 抽词：同一局不重复、跨多次调用统计分布、过滤难度/分类正确
- `useCountdown`：mock `performance.now()`，验证暂停/恢复、最后10秒标记

### 14.2 端到端 / 手动

- iOS Safari：权限请求弹出 → 授权 → 翻转判定生效
- iOS Safari：拒绝权限 → 点按模式生效
- Android Chrome：直接判定生效（无需权限）
- 桌面浏览器：自动点按模式 + 横屏提示
- Wake Lock：游戏进行 5 分钟不黑屏（在支持的浏览器上）
- 切到后台 30 秒回来：倒计时不跑飞、Wake Lock 重新激活
- 横屏 ↔ 竖屏切换：OrientationGuard 正确显示/隐藏

### 14.3 验收条件

- 主流程在一台 iOS Safari + 一台 Android Chrome 上端到端跑通
- 词库实际词数 ≥ 800
- 一局内不重复出词（≥ 60 题前不循环）

## 15. 范围与非目标

**本次范围内：**

- charades 游戏完整玩法（A 模式 + 单局 + 词单回顾）
- 词库 ≥ 800 词，6 分类，3 难度
- 翻转 + 点按双输入
- Wake Lock + 横屏软引导
- 静音 / 关震 / 特色挑战 1-2 个

**非目标（不在本期）：**

- B 模式（持机者看屏幕自己比划）
- 内置多人轮换 + 计分
- 自定义词库 / 用户上传词
- 后端 / 账号 / 云端记录历史战绩
- PWA / 离线安装
- 强制锁定横屏（兼容性放弃）
- 国际化 / 英文词库

## 16. 实施分阶（暂定，最终由 writing-plans 细化）

1. **骨架与入口**：types、stage 状态机、App.tsx 接入、空 stage 组件
2. **词库**：charades-words.ts（≥ 800 词），shuffle 工具与单测
3. **核心交互**：useFlipDetector + useCountdown + 点按降级
4. **辅助 hook**：useWakeLock、useMotionPermission、OrientationGuard
5. **UI 与反馈**：WordCard、FeedbackOverlay、SoundToggle、结算页
6. **打磨**：音效、震动、最后10秒强调、字体自适应
7. **真机测试**：iOS / Android 走查、根据反馈调阈值
