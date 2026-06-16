# 课间大乱斗 — 女生角色素材清单 / Girl Character Sprites MANIFEST

女生（FEMALE-presenting）精灵，**与现有 `public/assets/battle-school/` 完全同风格**，
用于让「课间大乱斗」战斗游戏区分男生/女生同学。drop-in 兼容现有加载器。

> 这是一个 **新文件夹**，未覆盖任何现有文件，未改动 `src/`，未 commit。

---

## 来源 / Source

- 资源包 / Pack: **Kenney「Toon Characters 1」**（亦名「Toon Characters」，二者为同一包，文件完全一致）
- 作者 / Author: **Kenney** — https://kenney.nl
- 资源主页 / Asset page: https://kenney.nl/assets/toon-characters-1 （及 https://kenney.nl/assets/toon-characters）
- 本次实际下载 / Downloads used (两者内容逐文件相同 / byte-identical contents):
  - https://opengameart.org/sites/default/files/kenney_toonCharacters1.zip （~5.47 MB）
  - https://kenney.nl/media/pages/assets/toon-characters/4e8a6e4e53-1774770819/kenney_toon-characters.zip （~5.47 MB）
- OpenGameArt 条目 / OGA listing: https://opengameart.org/content/toon-characters-1

**这与现有 `battle-school/` 用的是同一个包**（见 `battle-school/CREDITS.md`），因此风格 100% 一致。

## 许可 / License

**CC0 1.0 Universal（公有领域 / Public Domain）**
https://creativecommons.org/publicdomain/zero/1.0/
（License.txt 原文已核对：「free to use in personal, educational and commercial projects」，署名非强制。）
仍出于礼貌署名 Kenney（www.kenney.nl）。

---

## 关于女生角色的诚实说明 / Honest note on female coverage

Kenney Toon Characters 1 整包**只有 6 个皮肤**：Female adventurer、Female person、
Male adventurer、Male person、Robot、Zombie——**只有 2 个明确女性皮肤**，
且这 2 个在现有游戏里**已被用作 kidA / kidB**（见 CREDITS.md）。
该包没有裙装/连衣裙皮肤，「Female adventurer」（鲍勃头+发带）读感偏女性，
「Female person」（短发+发带）偏中性。

因此本目录的做法是：**以包内 2 个原生女性皮肤为基底**，
对**非肤色像素做受控色相替换（hair / 上衣 / 发带分区重着色，肤色保护不动）**，
派生出多个外观各异、但**比例·线稿·上色·画布与原包逐像素一致**的女生角色。
这是 CC0 精灵扩充阵容的标准做法，能在「明确女性 + 数量足够 + 风格零偏差」之间取得最佳平衡。
（Robot / Zombie 偏中性/非人，未纳入女生阵容。）

替代方案评估：Kenney「Modular Characters」虽含大量女性发型，但为**扁平矢量风**，
与现有 soft-chibi toon 风格**明显冲突**，故**不采用**。坚持同包是风格一致性的最优解。

---

## 文件清单 / Files staged（共 5 角色 × 8 帧 = 40 个 PNG，全部 96×128，透明背景，脚部对齐）

每个角色都包含与现有约定**完全相同的 8 帧名**：
`idle, walk0, walk1, walk2, walk3, attack2, hurt, jump`。

| 前缀 / Prefix | 基底原包皮肤 / Base skin | 处理 / Treatment | 外观 / Look | 尺寸 / Size |
| --- | --- | --- | --- | --- |
| `herog_*`    | Female adventurer | 原色（native） | 鲍勃头+发带，蓝色上衣，最清晰女性感 | 96×128 |
| `kidE_*`     | Female person     | 原色（native） | 深发+发带，绿色上衣 | 96×128 |
| `kidF_*`     | Female adventurer | 重着色（recolor） | 玫粉发+粉色上衣 | 96×128 |
| `kidG_*`     | Female person     | 重着色（recolor） | 紫/品红上衣 + 青色发带 | 96×128 |
| `teacherF_*` | Female person     | 重着色（recolor） | 酒红/勃艮第上衣（成年/老师色调） | 96×128 |

所有 40 个文件实测均为 `PNG 96×128`、非空白：
- 原色帧（`herog_*`, `kidE_*`）：8-bit 调色板 PNG（与现有 `battle-school/` 同编码）
- 重着色帧（`kidF_*`, `kidG_*`, `teacherF_*`）：8-bit/color RGBA PNG（同尺寸，体积略大，仍 <8KB/帧）

## 推荐角色映射 / Recommended role mapping

| 游戏角色 | 建议素材前缀 |
| --- | --- |
| 女主角（小孩） / girl hero | `herog_*` |
| 女同学 1 / girl classmate | `kidE_*` |
| 女同学 2 / girl classmate | `kidF_*` |
| 女同学 3 / girl classmate | `kidG_*` |
| 女老师 BOSS / girl teacher | `teacherF_*`（建议沿用现有男老师做法，场景内再叠加眼镜+教鞭，强化「老师」识别） |

## 使用提示 / Integration hint（不涉及本次改动，仅备注）

文件命名与现有 `battle-school/` 完全同构，可直接被同一套加载器（同 8 帧名、同 96×128）读取。
集成时只需在加载器中把这些前缀指向 `assets/battle-school-girls/` 即可，本次任务**不触碰代码**。
