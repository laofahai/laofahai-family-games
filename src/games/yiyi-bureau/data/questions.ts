import { c, pick, rand, shuffle } from '@/games/shared/question-utils'
import { pickUnseen } from '@/platform/progress'

import type { BureauMode, BureauQuestion, Choice } from '../types'
import { CHINESE_TEACHER, CLASSMATES, HEAD_TEACHER, MATH_TEACHER, PLAYER } from './people'

type Maker = (id: number) => BureauQuestion

// 固定卡池的稳定 key：优先用不随机插名的字段（right / fact / odd），
// 避免用带 ${同学名} 插值的 text，保证「玩过的卡」跨局能稳定去重。
function cardKey(card: unknown): string {
  const o = card as Record<string, unknown>
  return String(o.right ?? o.fact ?? o.odd ?? o.text ?? JSON.stringify(card))
}

// 从固定卡池里挑一张「优先没出过」的；池子出完自动回收。
function freshPick<T>(scope: string, cards: readonly T[]): T {
  return pickUnseen(`yiyi:${scope}`, cards, cardKey, 1)[0] ?? cards[0]
}

function mate(): string {
  return pick(CLASSMATES)
}

function twoMates(): [string, string] {
  const [a, b] = shuffle(CLASSMATES)
  return [a, b]
}

// 优先使用精心设计的「踩坑」干扰项；不足或碰撞时再补足到 3 个。
function numChoices(answer: number, unit: string, wrongs: number[]): { choices: Choice[]; answer: string } {
  const values = new Set<number>([answer])
  for (const w of wrongs) {
    if (values.size >= 3) break
    if (w !== answer && Number.isFinite(w)) values.add(w)
  }
  let bump = 1
  while (values.size < 3) {
    const filler = answer + bump * (bump % 2 === 0 ? -2 : 3)
    if (filler > 0) values.add(filler)
    bump += 1
  }
  return {
    choices: shuffle([...values]).map((v) => c(String(v), `${v}${unit}`)),
    answer: String(answer),
  }
}

function textChoices(correct: string, wrongs: string[]): { choices: Choice[]; answer: string } {
  const seen = new Set<string>([correct])
  const picked: string[] = []
  for (const w of wrongs) {
    if (picked.length >= 2) break
    if (!seen.has(w)) {
      seen.add(w)
      picked.push(w)
    }
  }
  return { choices: shuffle([correct, ...picked]).map((text) => c(text, text)), answer: correct }
}

const WEEK = ['一', '二', '三', '四', '五']

// ===========================================================================
// 数学（约 60%）—— 全部 2~4 步，数字可心算，干扰项是典型错解
// ===========================================================================

// 按比分配
const mathRatioShare: Maker = (id) => {
  const recipe = pick([
    { name: '柠檬气泡水', a: '柠檬汁', b: '气泡水', unit: '毫升', role: `${PLAYER}是饮品摊主理人` },
    { name: '蜂蜜柚子茶', a: '蜂蜜', b: '温水', unit: '毫升', role: `${PLAYER}给义卖摊调配方` },
    { name: '海报底色', a: '蓝颜料', b: '白颜料', unit: '克', role: `${PLAYER}是美宣组组长` },
    { name: '奖励金', a: '一等奖', b: '二等奖', unit: '元', role: `${PLAYER}当裁判分奖金` },
  ])
  const { ra, rb } = pick([
    { ra: 3, rb: 2 },
    { ra: 4, rb: 1 },
    { ra: 5, rb: 3 },
    { ra: 2, rb: 3 },
    { ra: 3, rb: 1 },
  ])
  const per = pick([8, 10, 12, 15])
  const total = per * (ra + rb)
  const aAmt = per * ra
  const bAmt = per * rb
  const built = numChoices(aAmt, recipe.unit, [bAmt, total, per])
  return {
    id: `m-share-${id}`,
    kind: 'math',
    badge: '城市策划 · 配比',
    title: '配方分配单',
    scenario: `${recipe.role}：${recipe.name}里${recipe.a}和${recipe.b}要按 ${ra} : ${rb} 调，这次一共要配 ${total} ${recipe.unit}。`,
    prompt: `其中${recipe.a}要放多少${recipe.unit}？`,
    ...built,
    hint: `先把总量平均分成 ${ra} + ${rb} = ${ra + rb} 份，求出 1 份，再看${recipe.a}占几份。`,
    explanation: `1 份是 ${total} ÷ ${ra + rb} = ${per}，${recipe.a}占 ${ra} 份：${per} × ${ra} = ${aAmt} ${recipe.unit}。`,
  }
}

// 分数加减：还剩几分之几
const mathFracRemain: Maker = (id) => {
  const card = pick([
    { a: '1/3', b: '1/4', sum: '7/12', left: '5/12', trap: '2/7' },
    { a: '1/2', b: '1/6', sum: '2/3', left: '1/3', trap: '2/8' },
    { a: '2/5', b: '1/2', sum: '9/10', left: '1/10', trap: '3/7' },
    { a: '1/4', b: '3/8', sum: '5/8', left: '3/8', trap: '4/12' },
    { a: '1/4', b: '1/2', sum: '3/4', left: '1/4', trap: '2/6' },
    { a: '2/9', b: '1/3', sum: '5/9', left: '4/9', trap: '3/12' },
  ])
  const job = pick([
    { who: `${PLAYER}的任务进度条`, unit: '任务' },
    { who: `毕业纪念册的排版`, unit: '版面' },
    { who: `班级公众号的推送`, unit: '稿子' },
  ])
  const built = textChoices(card.left, [card.sum, card.trap])
  return {
    id: `m-frac-rem-${id}`,
    kind: 'math',
    badge: '初中预告 · 分数',
    title: '进度核算台',
    scenario: `${job.who}：上午做完了 ${card.a}，下午又做完了 ${card.b}。`,
    prompt: `这项${job.unit}还剩几分之几没做完？`,
    ...built,
    hint: `先把两次完成的合起来（通分再相加），再用整体「1」去减。`,
    explanation: `${card.a} + ${card.b} = ${card.sum}，剩下 1 − ${card.sum} = ${card.left}。`,
  }
}

// 分数求量
const mathFracOf: Maker = (id) => {
  const card = pick([
    { total: 120, num: 3, den: 8, label: '本', thing: '科普书', place: '班级图书角' },
    { total: 80, num: 2, den: 5, label: '人', thing: '戴眼镜的同学', place: '六(2)班' },
    { total: 90, num: 4, den: 9, label: '棵', thing: '成活的树苗', place: '认领的小树林' },
    { total: 150, num: 2, den: 3, label: '元', thing: '已收到的赞助', place: '义卖账本' },
    { total: 48, num: 5, den: 8, label: '张', thing: '已售出的票', place: '联欢会售票处' },
  ])
  const ans = (card.total * card.num) / card.den
  const onePart = card.total / card.den
  const built = numChoices(ans, card.label, [onePart, card.total - ans, ans + onePart])
  return {
    id: `m-frac-of-${id}`,
    kind: 'math',
    badge: '城市策划 · 数据',
    title: '占比测算处',
    scenario: `${PLAYER}是${card.place}的数据分析员：这里一共 ${card.total} ${card.label}，其中 ${card.num}/${card.den} 是${card.thing}。`,
    prompt: `${card.thing}有多少${card.label}？`,
    ...built,
    hint: `求一个数的几分之几，用乘法：先 ${card.total} ÷ ${card.den}，再乘 ${card.num}。`,
    explanation: `${card.total} ÷ ${card.den} = ${onePart}，再 × ${card.num} = ${ans} ${card.label}。`,
  }
}

// 比例尺（双向）
const mathScale: Maker = (id) => {
  const per = pick([5, 8, 10, 20])
  const place = pick(['操场到食堂', '校门口到图书馆', '社团楼到报告厅', '义卖会场到正门'])
  if (Math.random() < 0.5) {
    const cm = rand(4, 12)
    const real = cm * per
    const built = numChoices(real, ' 米', [cm + per, cm * 100, cm * per * 10])
    return {
      id: `m-scale-${id}`,
      kind: 'math',
      badge: '城市策划 · 路线',
      title: '导览图测算',
      scenario: `${PLAYER}是路线队长，校园导览图上 1 厘米代表实际 ${per} 米。`,
      prompt: `图上量出「${place}」长 ${cm} 厘米，实际是多少米？`,
      ...built,
      hint: `图上每 1 厘米对应 ${per} 米，量出几厘米就乘几。`,
      explanation: `${cm} × ${per} = ${real}，实际 ${real} 米。`,
    }
  }
  const cm = rand(4, 12)
  const real = cm * per
  const built = numChoices(cm, ' 厘米', [real, real + per, real - per])
  return {
    id: `m-scale-${id}`,
    kind: 'math',
    badge: '城市策划 · 路线',
    title: '导览图测算',
    scenario: `${PLAYER}要在导览图上画路线，图上 1 厘米代表实际 ${per} 米。`,
    prompt: `「${place}」实际 ${real} 米，在图上要画多长？`,
    ...built,
    hint: `已知实际米数，反过来除以每厘米代表的 ${per} 米。`,
    explanation: `${real} ÷ ${per} = ${cm}，图上画 ${cm} 厘米。`,
  }
}

// 满减 vs 打折 比价
const mathCompare: Maker = (id) => {
  const card = pick([
    { item: '球鞋', price: 120, zhe: '7.5 折', zhePrice: 90, cut: 35, cutPrice: 85, win: '乙', save: 5 },
    { item: '书包', price: 200, zhe: '8 折', zhePrice: 160, cut: 55, cutPrice: 145, win: '乙', save: 15 },
    { item: '滑板', price: 160, zhe: '9 折', zhePrice: 144, cut: 30, cutPrice: 130, win: '乙', save: 14 },
    { item: '礼盒', price: 100, zhe: '8.5 折', zhePrice: 85, cut: 12, cutPrice: 88, win: '甲', save: 3 },
    { item: '台灯', price: 80, zhe: '9 折', zhePrice: 72, cut: 5, cutPrice: 75, win: '甲', save: 3 },
  ])
  const opp = card.win === '甲' ? '乙' : '甲'
  const correct = `${card.win}店便宜，省 ${card.save} 元`
  const built = textChoices(correct, [
    `${opp}店便宜，省 ${card.save} 元`,
    `${card.win}店便宜，省 ${card.cut} 元`,
    '两家一样，看心情买',
  ])
  return {
    id: `m-compare-${id}`,
    kind: 'math',
    badge: '城市策划 · 比价',
    title: '比价小参谋',
    scenario: `同一款${card.item}原价 ${card.price} 元。甲店打${card.zhe}，乙店立减 ${card.cut} 元。`,
    prompt: `${PLAYER}当比价小参谋，哪家更便宜、便宜多少？`,
    ...built,
    hint: `分别算出两家到手价，再比大小、求差。打折是乘，立减是减。`,
    explanation: `甲店 ${card.price} 的${card.zhe}是 ${card.zhePrice} 元，乙店 ${card.price} − ${card.cut} = ${card.cutPrice} 元，${card.win}店便宜 ${card.save} 元。`,
  }
}

// 百分数应用（两步消耗）
const mathPercentApp: Maker = (id) => {
  const card = pick([
    { total: 60, p1: 40, p2: 30, thing: '零件', role: '车间记录员' },
    { total: 80, p1: 25, p2: 50, thing: '手工灯笼', role: '手工组组长' },
    { total: 50, p1: 20, p2: 40, thing: '宣传单', role: '宣传委员' },
    { total: 200, p1: 30, p2: 45, thing: '义卖品', role: '义卖总策划' },
    { total: 40, p1: 25, p2: 35, thing: '请柬', role: '联欢会主办人' },
  ])
  const part1 = (card.total * card.p1) / 100
  const part2 = (card.total * card.p2) / 100
  const left = card.total - part1 - part2
  const built = numChoices(left, ' 个', [100 - card.p1 - card.p2, card.total - part1, part1 + part2])
  return {
    id: `m-pct-${id}`,
    kind: 'math',
    badge: '城市策划 · 数据',
    title: '产量进度表',
    scenario: `${PLAYER}是${card.role}：一共要准备 ${card.total} 个${card.thing}，第一天完成了 ${card.p1}%，第二天完成了 ${card.p2}%。`,
    prompt: `还剩多少个${card.thing}没做？`,
    ...built,
    hint: `先把两天各做的个数算出来（总数 × 百分数），再从总数里减掉。`,
    explanation: `第一天 ${card.total}×${card.p1}% = ${part1} 个，第二天 ${part2} 个，剩 ${card.total} − ${part1} − ${part2} = ${left} 个。`,
  }
}

// 逆推（方程思想，多步还原）
const mathReverse: Maker = (id) => {
  const k = pick([3, 4, 5])
  const x = rand(4, 9)
  const b = rand(4, 18)
  const addType = Math.random() < 0.5
  const r = addType ? k * x + b : k * x - b
  const built = numChoices(x, '', [r, addType ? r - b : r + b, x + 2])
  return {
    id: `m-rev-${id}`,
    kind: 'math',
    badge: '初中预告 · 还原',
    title: '密码还原行动',
    scenario: `${mate()}留下线索：任务箱密码是一个数。把它${addType ? `乘 ${k} 再加 ${b}` : `乘 ${k} 再减 ${b}`}，正好得到 ${r}。`,
    prompt: `${PLAYER}负责开箱，这个密码是多少？`,
    ...built,
    hint: `倒着还原：${addType ? `先减回 ${b}` : `先加回 ${b}`}，再除以 ${k}。`,
    explanation: addType
      ? `(${r} − ${b}) ÷ ${k} = ${x}，密码是 ${x}。`
      : `(${r} + ${b}) ÷ ${k} = ${x}，密码是 ${x}。`,
  }
}

// 和倍问题
const mathMultiple: Maker = (id) => {
  const card = pick([
    { total: 36, k: 3, thing: '任务积分', a: '队长', b: '队员' },
    { total: 48, k: 5, thing: '收集的徽章', a: '高年级组', b: '低年级组' },
    { total: 40, k: 4, thing: '义卖海报', a: '设计组', b: '张贴组' },
    { total: 45, k: 4, thing: '藏书', a: '科普区', b: '故事区' },
    { total: 60, k: 2, thing: '志愿时长', a: '上半学期', b: '下半学期' },
  ])
  const small = card.total / (card.k + 1)
  const big = card.total - small
  const built = numChoices(small, '', [big, small + card.k, small * 2])
  return {
    id: `m-mul-${id}`,
    kind: 'math',
    badge: '初中预告 · 倍数',
    title: '倍数拆解题',
    scenario: `${PLAYER}在核对台账：${card.a}和${card.b}的${card.thing}一共 ${card.total}，且${card.a}正好是${card.b}的 ${card.k} 倍。`,
    prompt: `${card.b}有多少？`,
    ...built,
    hint: `把${card.b}看成 1 份，${card.a}就是 ${card.k} 份，一共 ${card.k + 1} 份。`,
    explanation: `${card.total} ÷ (${card.k} + 1) = ${small}，所以${card.b}有 ${small}，${card.a}有 ${big}。`,
  }
}

// 平均数进阶
const mathAverage2: Maker = (id) => {
  if (Math.random() < 0.5) {
    const a3 = pick([76, 78, 82, 85, 88])
    const t = a3 + pick([2, 4, 5])
    const need = t * 4 - a3 * 3
    const built = numChoices(need, ' 分', [t, t + 2, a3])
    return {
      id: `m-avg-${id}`,
      kind: 'math',
      badge: '城市策划 · 数据',
      title: '冲刺目标台',
      scenario: `${MATH_TEACHER}帮${PLAYER}定下计划：四次模拟想让平均分到 ${t} 分，前三次平均 ${a3} 分。`,
      prompt: `第四次至少要考多少分才能达标？`,
      ...built,
      hint: `四次的总分应是 ${t} × 4，减去前三次的总分 ${a3} × 3。`,
      explanation: `${t} × 4 − ${a3} × 3 = ${t * 4} − ${a3 * 3} = ${need} 分。`,
    }
  }
  const k = pick([3, 4])
  const avg = pick([80, 82, 85])
  const jump = pick([1, 2])
  const newAvg = avg + jump
  const last = newAvg * (k + 1) - avg * k
  const built = numChoices(newAvg, ' 分', [avg, last, newAvg + 1])
  return {
    id: `m-avg-${id}`,
    kind: 'math',
    badge: '城市策划 · 数据',
    title: '战报统计员',
    scenario: `${PLAYER}是记录员：前 ${k} 轮套圈平均 ${avg} 分，第 ${k + 1} 轮拿到 ${last} 分。`,
    prompt: `现在 ${k + 1} 轮的平均分是多少？`,
    ...built,
    hint: `把所有轮的总分加起来，再除以总轮数 ${k + 1}，不能只把两个数对半分。`,
    explanation: `(${avg} × ${k} + ${last}) ÷ ${k + 1} = ${avg * k + last} ÷ ${k + 1} = ${newAvg} 分。`,
  }
}

// 组合图形 / 周长面积综合
const mathAreaCombo: Maker = (id) => {
  if (Math.random() < 0.5) {
    const L = pick([8, 9, 10, 12])
    const W = pick([5, 6, 7])
    const d = 1
    const inner = (L - 2 * d) * (W - 2 * d)
    const built = numChoices(inner, ' 平方米', [L * W, (L - d) * (W - d), 2 * (L + W)])
    return {
      id: `m-area-${id}`,
      kind: 'math',
      badge: '城市策划 · 场地',
      title: '展板规划图',
      scenario: `${PLAYER}是布展规划师：展板长 ${L} 米、宽 ${W} 米，四周留 ${d} 米宽的边框，中间贴海报。`,
      prompt: `中间能贴海报的面积是多少？`,
      ...built,
      hint: `四周各留 ${d} 米，里面的长和宽都要减去 2 个 ${d} 米。`,
      explanation: `里面长 ${L - 2 * d} 米、宽 ${W - 2 * d} 米，面积 ${L - 2 * d} × ${W - 2 * d} = ${inner} 平方米。`,
    }
  }
  const W = pick([4, 5, 6])
  const g = pick([2, 3])
  const L = W + g
  const peri = 2 * (L + W)
  const area = L * W
  const built = numChoices(area, ' 平方米', [peri, L + W, W * W])
  return {
    id: `m-area-${id}`,
    kind: 'math',
    badge: '城市策划 · 场地',
    title: '花圃规划图',
    scenario: `${PLAYER}规划长方形花圃：周长 ${peri} 米，长比宽多 ${g} 米。`,
    prompt: `这块花圃的面积是多少？`,
    ...built,
    hint: `先用周长求出长加宽（周长 ÷ 2 = ${peri / 2}），再凑出长和宽，最后算面积。`,
    explanation: `长 + 宽 = ${peri / 2}，长比宽多 ${g}，得宽 ${W}、长 ${L}，面积 ${L} × ${W} = ${area} 平方米。`,
  }
}

// 相遇问题（追及作干扰）
const mathMeet: Maker = (id) => {
  const card = pick([
    { dist: 240, va: 70, vb: 50 },
    { dist: 240, va: 45, vb: 35 },
    { dist: 300, va: 60, vb: 40 },
    { dist: 400, va: 55, vb: 45 },
  ])
  const t = card.dist / (card.va + card.vb)
  const chase = card.dist / (card.va - card.vb)
  const built = numChoices(t, ' 小时', [chase, t + 1, card.dist / card.va])
  return {
    id: `m-meet-${id}`,
    kind: 'math',
    badge: '城市策划 · 行程',
    title: '相遇调度台',
    scenario: `${PLAYER}是出行调度员：两地相距 ${card.dist} 千米，两辆车同时从两端相向开出，一辆每小时 ${card.va} 千米，一辆每小时 ${card.vb} 千米。`,
    prompt: `几小时后两车相遇？`,
    ...built,
    hint: `相向而行，每小时两车一起靠近 ${card.va} + ${card.vb} 千米，用总路程去除。`,
    explanation: `两车每小时共走 ${card.va} + ${card.vb} = ${card.va + card.vb} 千米，${card.dist} ÷ ${card.va + card.vb} = ${t} 小时。`,
  }
}

// 复合单位换算
const mathUnit2: Maker = (id) => {
  const card = pick([
    { b: 3, per: 8, ml: 500, drink: '柠檬水' },
    { b: 4, per: 6, ml: 250, drink: '酸梅汤' },
    { b: 2, per: 10, ml: 500, drink: '气泡水' },
    { b: 5, per: 8, ml: 250, drink: '酸奶' },
  ])
  const totalMl = card.b * card.per * card.ml
  const liters = totalMl / 1000
  const built = numChoices(liters, ' 升', [liters * 10, totalMl, liters / 10])
  return {
    id: `m-unit-${id}`,
    kind: 'math',
    badge: '城市策划 · 换算',
    title: '备货换算台',
    scenario: `${PLAYER}是饮品摊后勤：备了 ${card.b} 箱${card.drink}，每箱 ${card.per} 瓶，每瓶 ${card.ml} 毫升。`,
    prompt: `一共备了多少升？`,
    ...built,
    hint: `先算总毫升（箱 × 每箱瓶数 × 每瓶毫升），再换成升：1000 毫升 = 1 升。`,
    explanation: `${card.b} × ${card.per} × ${card.ml} = ${totalMl} 毫升 = ${liters} 升。`,
  }
}

// 负数：温差
const mathNeg2: Maker = (id) => {
  const card = pick([
    { hi: '三亚', th: 26, lo: '哈尔滨', tl: -12 },
    { hi: '广州', th: 18, lo: '漠河', tl: -18 },
    { hi: '昆明', th: 8, lo: '沈阳', tl: -9 },
    { hi: '北京', th: -2, lo: '呼伦贝尔', tl: -15 },
    { hi: '上海', th: 6, lo: '长春', tl: -20 },
  ])
  const diff = card.th - card.tl
  const built = textChoices(`${diff}℃`, [`${Math.abs(card.th + card.tl)}℃`, `${Math.abs(card.tl)}℃`])
  return {
    id: `m-neg-${id}`,
    kind: 'math',
    badge: '初中预告 · 负数',
    title: '气温对比卡',
    scenario: `${PLAYER}在做天气数据卡：同一天${card.hi} ${card.th}℃，${card.lo} ${card.tl}℃。`,
    prompt: `${card.hi}比${card.lo}高多少摄氏度？`,
    ...built,
    hint: `温差从低的一直数到高的：先从 ${card.tl}℃ 升到 0℃，再升到 ${card.th}℃。`,
    explanation: `${card.th} − (${card.tl}) = ${diff}，${card.hi}比${card.lo}高 ${diff}℃。`,
  }
}

// 统计图（读图综合）
const mathChart: Maker = (id) => {
  const card = pick([
    { d: [18, 24, 16, 30, 22], sum: 110, avg: 22, max: 30, min: 16, pa: 3, pb: 1 },
    { d: [25, 30, 20, 35, 40], sum: 150, avg: 30, max: 40, min: 20, pa: 4, pb: 0 },
    { d: [12, 20, 16, 24, 28], sum: 100, avg: 20, max: 28, min: 12, pa: 4, pb: 2 },
    { d: [30, 45, 35, 50, 40], sum: 200, avg: 40, max: 50, min: 30, pa: 3, pb: 2 },
  ])
  const bars = WEEK.map((w, i) => `周${w} ${card.d[i]}`).join('  |  ')
  const ask = pick(['sum', 'avg', 'diff', 'pair'] as const)
  let prompt = ''
  let built: { choices: Choice[]; answer: string }
  let explanation = ''
  if (ask === 'sum') {
    prompt = '这一周一共卖出多少杯？'
    built = numChoices(card.sum, ' 杯', [card.avg, card.max, card.sum - 10])
    explanation = `把五天加起来：${card.d.join(' + ')} = ${card.sum} 杯。`
  } else if (ask === 'avg') {
    prompt = '平均每天卖出多少杯？'
    built = numChoices(card.avg, ' 杯', [card.sum, card.max, card.avg + 2])
    explanation = `总数 ${card.sum} ÷ 5 天 = ${card.avg} 杯，要除以天数，不能把总数当答案。`
  } else if (ask === 'diff') {
    prompt = '卖得最多的一天比最少的一天多几杯？'
    built = numChoices(card.max - card.min, ' 杯', [card.max, card.max + card.min, card.min])
    explanation = `最多 ${card.max} 杯，最少 ${card.min} 杯，${card.max} − ${card.min} = ${card.max - card.min} 杯。`
  } else {
    const va = card.d[card.pa]
    const vb = card.d[card.pb]
    prompt = `周${WEEK[card.pa]}比周${WEEK[card.pb]}多卖几杯？`
    built = numChoices(va - vb, ' 杯', [va, vb, va + vb])
    explanation = `周${WEEK[card.pa]} ${va} 杯，周${WEEK[card.pb]} ${vb} 杯，${va} − ${vb} = ${va - vb} 杯。`
  }
  return {
    id: `m-chart-${id}`,
    kind: 'math',
    badge: '城市策划 · 统计',
    title: '销量统计图',
    scenario: `${PLAYER}是小卖部的数据分析员，本周酸梅汤销量(杯)：\n${bars}`,
    prompt,
    ...built,
    hint: `先从统计图里读准每天的数，再按问题计算。`,
    explanation,
  }
}

// ===========================================================================
// 语文
// ===========================================================================

const cnNotice: Maker = (id) => {
  const event = pick(['班级义卖会', '图书漂流活动', '科技节布展', '合唱排练'])
  const day = pick(WEEK)
  const time = pick(['上午 9:00', '下午 2:30', '下午 3:00', '上午 10:00'])
  const place = pick(['多功能厅', '图书馆', '六(2)班教室', '报告厅'])
  const item = pick(['水杯', '马克笔', '一本旧书', '剪刀和胶带'])
  const correctWrong = pick([
    `活动改在周${pick(WEEK.filter((w) => w !== day))}`,
    `要带的是${pick(['雨伞', '画板', '零食'])}`,
    `地点在${pick(['操场', '体育馆', '校门口'])}`,
  ])
  const built = textChoices(correctWrong, [
    `活动在${place}举行`,
    `要带${item}`,
  ])
  return {
    id: `c-notice-${id}`,
    kind: 'chinese',
    badge: '档案室 · 通知',
    title: '通知纠错员',
    scenario: `通知：${event}定于周${day}${time}在${place}举行，请提前 10 分钟到场，记得带${item}。——老班 ${HEAD_TEACHER}`,
    prompt: `${PLAYER}负责核对，下面哪条说法和通知不符？`,
    ...built,
    hint: `逐条回到通知里对照时间、地点、物品，找出对不上的那条。`,
    explanation: `通知写的是周${day}、在${place}、带${item}，所以「${correctWrong}」与通知不符。`,
  }
}

const cnMainIdea: Maker = (id) => {
  const name = mate()
  const card = freshPick('mainidea', [
    {
      text: `毛竹前四年只长三厘米，第五年起每天能蹿三十厘米。原来那四年里，它的根已经在土里悄悄铺开了几百平方米。`,
      right: '扎实的积累是后来爆发的底气',
      wrongs: ['毛竹是长得最快的植物', '竹根能铺开几百平方米'],
      why: '数字只是例子，中心是「看不见的积累很重要」。',
    },
    {
      text: `义卖那天突降大雨，${name}和同学没有慌：先把摊位挪进走廊，再分头通知各班，义卖照常进行。`,
      right: '遇到突发情况，冷静想办法最重要',
      wrongs: ['下雨天不适合办义卖', '走廊比操场更宽敞'],
      why: '重点是「没慌、想办法」，不是雨本身。',
    },
    {
      text: `${name}第一次主持升旗，前一晚对着镜子把开场词练了十几遍。第二天站上台，一点也不紧张。`,
      right: '充分的准备让人更有底气',
      wrongs: ['主持升旗非常困难', '对着镜子说话很有趣'],
      why: '「练十几遍」和「不紧张」是因果，中心在准备。',
    },
    {
      text: `搬家的蚂蚁排成长队，有的扛粮食，有的抬幼虫，有的在两侧巡逻。一个下午，整窝蚂蚁全部安全转移。`,
      right: '分工合作能办成大事',
      wrongs: ['蚂蚁喜欢在下午搬家', '蚂蚁的队伍排得很长'],
      why: '「有的……有的……」写分工，结尾写合作的成果。',
    },
    {
      text: `${name}的字以前歪歪扭扭。这学期他每天坚持练十分钟，一个月后，作业本上的字已经工整得让老师惊讶。`,
      right: '坚持每天一点点，就能带来明显的改变',
      wrongs: ['练字必须用很长时间', '老师很容易感到惊讶'],
      why: '中心是「每天坚持带来改变」，时间和老师都只是陪衬。',
    },
    {
      text: `图书角原本乱糟糟的。${name}把书按颜色和类别重新摆放，还做了指引牌。现在同学几秒就能找到想看的书。`,
      right: '用心整理能让事情变得更高效',
      wrongs: ['图书角的书非常多', '彩色的书更好看'],
      why: '重点是整理带来的效率，不是书多或好看。',
    },
    {
      text: `小溪一路上遇到石头、遇到弯道，却从不停下，绕一绕、让一让，最终还是汇入了大海。`,
      right: '遇到阻碍不放弃，总能抵达目标',
      wrongs: ['小溪喜欢绕弯路', '大海是所有水的家'],
      why: '石头和弯道是阻碍，中心是「不停下、终抵达」。',
    },
    {
      text: `第一次做蛋糕，${name}把盐当成了糖。家人尝了一口都皱眉，他却笑着记下：下次一定看清瓶子上的字。`,
      right: '从失误里吸取教训，比失误本身更重要',
      wrongs: ['做蛋糕很容易失败', '盐和糖长得很像'],
      why: '中心是「从失误中学到东西」，而不是失误本身。',
    },
  ])
  const built = textChoices(card.right, card.wrongs)
  return {
    id: `c-idea-${id}`,
    kind: 'chinese',
    badge: '档案室 · 提炼',
    title: '一句话主编',
    scenario: card.text,
    prompt: `${PLAYER}是栏目主编，要给这段话配一句中心句，选哪句最合适？`,
    ...built,
    hint: `问自己：这段话最想让人记住什么？细节、举例都不是中心。`,
    explanation: card.why,
  }
}

const cnInfer: Maker = (id) => {
  const card = freshPick('infer', [
    {
      text: `${mate()}走进教室，把湿透的伞收进墙角，又掏出纸巾擦了擦镜片上的水珠。`,
      right: '外面正在下雨',
      wrongs: ['教室里在浇花', '他刚洗完脸'],
      why: '伞湿透、镜片有水珠，都指向外面下雨——这是从细节推断出来的。',
    },
    {
      text: `灯还亮着，桌上的奶茶只剩一半，作业本摊开停在第三题，椅子上搭着外套。`,
      right: '主人很可能只是临时离开，一会儿会回来',
      wrongs: ['这间屋子很久没人住了', '主人已经把作业全写完了'],
      why: '灯亮、奶茶没喝完、外套还在，说明人只是暂时走开。',
    },
    {
      text: `${mate()}一进门就把奖状小心地贴在墙上，嘴角藏不住地往上扬，还哼起了歌。`,
      right: '他这次比赛取得了好成绩',
      wrongs: ['他考试没考好', '他在生别人的气'],
      why: '贴奖状、嘴角上扬、哼歌，都说明他很高兴、比赛拿了好名次。',
    },
    {
      text: `${mate()}盯着窗外的篮球场叹了口气，把摊开的书又翻回第一页，笔在本子上戳出一个个小点。`,
      right: '他有点走神，没怎么看进去书',
      wrongs: ['他正在认真做笔记', '他已经把书全背下来了'],
      why: '盯着球场、翻回第一页、戳小点，都说明他心思没在书上。',
    },
    {
      text: `餐桌上摆着两副碗筷、还冒热气的两碗面，门口却整整齐齐放着一双没人穿的拖鞋。`,
      right: '家里还有一个人，刚出门一会儿',
      wrongs: ['这家人已经搬走了', '这顿饭是昨天剩下的'],
      why: '两副碗筷、热气、多出的拖鞋，都说明另一个人只是临时离开。',
    },
    {
      text: `${mate()}把外套裹得紧紧的，搓着手呵了口气，呵出的白气在面前散开。`,
      right: '天气很冷',
      wrongs: ['他刚跑完步很热', '屋里开着暖气'],
      why: '裹外套、搓手、呵出白气，都说明气温很低。',
    },
    {
      text: `走廊地面有一串由大变小、渐渐变干的湿脚印，一直通向洗手间的门口。`,
      right: '有人刚光脚或湿着脚走进了洗手间',
      wrongs: ['洗手间的水管爆了', '有人在走廊里拖了地'],
      why: '脚印成串、由湿变干、指向门口，说明是有人走过去留下的。',
    },
  ])
  const built = textChoices(card.right, card.wrongs)
  return {
    id: `c-infer-${id}`,
    kind: 'chinese',
    badge: '初中预告 · 推断',
    title: '线索推断社',
    scenario: card.text,
    prompt: `${PLAYER}是推理社社长，文字没直说，但能推断出什么？`,
    ...built,
    hint: `作者没有明说结论，要靠句子里的几个细节一起推。`,
    explanation: card.why,
  }
}

const cnIdiom: Maker = (id) => {
  const card = freshPick('idiom', [
    { text: '比赛只剩最后一分钟，比分紧咬，观众都（  ）地盯着球场。', right: '全神贯注', wrongs: ['漫不经心', '七嘴八舌'], why: '注意力高度集中用「全神贯注」。' },
    { text: '他平时积累了很多素材，写起文章来（  ）。', right: '得心应手', wrongs: ['手忙脚乱', '守株待兔'], why: '积累充分所以顺手，用「得心应手」。' },
    { text: '面对突然的提问，她（  ），很快给出答案。', right: '从容不迫', wrongs: ['惊慌失措', '张冠李戴'], why: '不慌不忙叫「从容不迫」。' },
    { text: '做事不能（  ），三天打鱼两天晒网是干不成事的。', right: '半途而废', wrongs: ['持之以恒', '一鼓作气'], why: '对应「三天打鱼两天晒网」的毛病是「半途而废」。' },
    { text: '他把那次旅行讲得（  ），同学们听得入了迷。', right: '绘声绘色', wrongs: ['索然无味', '异口同声'], why: '讲得生动形象叫「绘声绘色」。' },
    { text: '这份计划考虑得（  ），连下雨的预案都想到了。', right: '面面俱到', wrongs: ['顾此失彼', '画蛇添足'], why: '各方面都照顾到，用「面面俱到」。' },
    { text: '上课铃一响，他才（  ）地想起作业还躺在家里的书桌上。', right: '恍然大悟', wrongs: ['胸有成竹', '深思熟虑'], why: '突然明白过来叫「恍然大悟」。' },
    { text: '值日表刚贴出来，大家就（  ），七嘴八舌地讨论开了。', right: '议论纷纷', wrongs: ['鸦雀无声', '一声不吭'], why: '你一言我一语地讨论叫「议论纷纷」。' },
    { text: '他吹牛说能背下整本字典，结果第一页就卡住，真是（  ）。', right: '自不量力', wrongs: ['量力而行', '实事求是'], why: '高估自己、办不到还硬撑叫「自不量力」。' },
    { text: '为了赶上交稿，他熬了两个通宵，终于（  ）地完成了海报。', right: '废寝忘食', wrongs: ['游手好闲', '无所事事'], why: '忙到顾不上吃饭睡觉叫「废寝忘食」。' },
    { text: '听到自己被选为升旗手，他高兴得（  ）。', right: '手舞足蹈', wrongs: ['垂头丧气', '愁眉苦脸'], why: '又蹦又跳、特别开心叫「手舞足蹈」。' },
    { text: '这两幅画乍一看一模一样，仔细比才发现（  ）的小差别。', right: '大同小异', wrongs: ['天壤之别', '截然不同'], why: '大体相同、只有小区别叫「大同小异」。' },
    { text: '他做事总爱（  ），刚开了头又跑去做别的，结果都没做完。', right: '三心二意', wrongs: ['一心一意', '全力以赴'], why: '心思不专一叫「三心二意」。' },
    { text: '老师一句鼓励，让原本想放弃的他又（  ）地坚持了下来。', right: '重整旗鼓', wrongs: ['偃旗息鼓', '半途而废'], why: '重新振作、再次努力叫「重整旗鼓」。' },
  ])
  const built = textChoices(card.right, card.wrongs)
  return {
    id: `c-idiom-${id}`,
    kind: 'chinese',
    badge: '档案室 · 用词',
    title: '文案润色台',
    scenario: card.text,
    prompt: `${CHINESE_TEACHER}请${PLAYER}润色，括号里填哪个词最合适？`,
    ...built,
    hint: `把每个词放进句子读一遍，意思和语气都要顺。`,
    explanation: card.why,
  }
}

const cnClassical: Maker = (id) => {
  const card = freshPick('classical', [
    { text: '温故而知新', right: '回顾旧知识，能有新的体会', wrongs: ['旧东西放久会变新', '故事听多了就懂新道理'] },
    { text: '凡事预则立，不预则废', right: '做事先有准备就容易成功，没准备就容易失败', wrongs: ['任何事预报了就成立', '做事要先清理废品'] },
    { text: '学而不思则罔，思而不学则殆', right: '只学不想会糊涂，只想不学会疑惑无所得', wrongs: ['学习和思考不能同时进行', '想得太多就会很危险'] },
    { text: '己所不欲，勿施于人', right: '自己不愿意的，不要强加给别人', wrongs: ['自己想要的要先给别人', '不喜欢的人不要理睬'] },
    { text: '千里之行，始于足下', right: '再远的路也要从脚下第一步走起', wrongs: ['走一千里路要从买鞋开始', '路太远了不如不走'] },
    { text: '亡羊补牢，未为迟也', right: '出了问题及时补救，还不算晚', wrongs: ['羊丢了修圈已没用', '迟到的人要修羊圈'] },
    { text: '三人行，必有我师焉', right: '几个人同行，里面总有值得我学习的人', wrongs: ['三个人走路必须带老师', '人多了就要排队走'] },
    { text: '知之为知之，不知为不知', right: '懂就说懂，不懂就说不懂，别不懂装懂', wrongs: ['知道的事越多越聪明', '知道了也别告诉别人'] },
    { text: '业精于勤，荒于嬉', right: '学业靠勤奋才能精进，贪玩就会荒废', wrongs: ['工作精细就会很累', '玩游戏能让人变厉害'] },
    { text: '尺有所短，寸有所长', right: '各有长处也各有短处，要取长补短', wrongs: ['尺子总比寸长', '长的东西一定更好'] },
    { text: '不积跬步，无以至千里', right: '不一步步积累，就走不到千里之外', wrongs: ['不跑步就到不了一千里', '路太远了走不到头'] },
    { text: '海纳百川，有容乃大', right: '像大海容纳众多河流那样，能包容才显得宽广', wrongs: ['大海里有一百条河', '海越大装的水越多'] },
  ])
  const built = textChoices(card.right, card.wrongs)
  return {
    id: `c-classic-${id}`,
    kind: 'chinese',
    badge: '初中预告 · 文言',
    title: '古文解码卡',
    scenario: `${CHINESE_TEACHER}写下一句：「${card.text}」`,
    prompt: `${PLAYER}抽到这张解码卡，它的意思是？`,
    ...built,
    hint: `抓住句子里最关键的一两个字，逐字猜大意。`,
    explanation: `「${card.text}」的意思是：${card.right}。`,
  }
}

const cnRelate: Maker = (id) => {
  const card = freshPick('relate', [
    { text: '（  ）天气预报说有雨，我们（  ）把活动改到了室内。', right: '因为……所以……', wrongs: ['虽然……但是……', '如果……就……'], why: '前是原因后是结果，用「因为……所以……」。' },
    { text: '（  ）多读几遍，你（  ）能明白这段话的意思。', right: '只要……就……', wrongs: ['因为……所以……', '不但……而且……'], why: '前是条件后是结果，用「只要……就……」。' },
    { text: '这本书（  ）内容有趣，（  ）插图也很精美。', right: '不但……而且……', wrongs: ['虽然……但是……', '与其……不如……'], why: '两点并列递进，用「不但……而且……」。' },
    { text: '（  ）任务再难，我们（  ）不会放弃。', right: '无论……都……', wrongs: ['只有……才……', '因为……所以……'], why: '不管什么情况结果都一样，用「无论……都……」。' },
    { text: '他（  ）在班里成绩好，（  ）很乐意帮同学讲题。', right: '不但……还……', wrongs: ['即使……也……', '宁可……也不……'], why: '两个优点并列递进，用「不但……还……」。' },
    { text: '（  ）你认真检查一遍，（  ）能发现这个小错误。', right: '只有……才……', wrongs: ['虽然……但是……', '不是……而是……'], why: '强调唯一条件，用「只有……才……」。' },
    { text: '（  ）外面下着大雪，他（  ）坚持去图书馆还书。', right: '虽然……却……', wrongs: ['只要……就……', '因为……所以……'], why: '前后意思相反，用表转折的「虽然……却……」。' },
    { text: '这次失误（  ）不是你一个人的责任，（  ）需要大家一起改进。', right: '既……也……', wrongs: ['不是……就是……', '与其……不如……'], why: '两层意思并列，用「既……也……」。' },
    { text: '（  ）想在比赛中拿好成绩，（  ）平时要多练习。', right: '要想……就……', wrongs: ['尽管……还是……', '一……就……'], why: '前是目的后是条件，用「要想……就……」。' },
  ])
  const built = textChoices(card.right, card.wrongs)
  return {
    id: `c-relate-${id}`,
    kind: 'chinese',
    badge: '档案室 · 关联',
    title: '语句连接台',
    scenario: card.text,
    prompt: `${PLAYER}在校对稿子，两个括号里填哪组关联词最通顺？`,
    ...built,
    hint: `先理清前后两句是什么关系：因果、条件、并列，还是转折。`,
    explanation: card.why,
  }
}

// ===========================================================================
// 英语
// ===========================================================================

const EN_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const EN_TIMES = ['3:00 p.m.', '9:30 a.m.', '2:10 p.m.', '4:00 p.m.']
const EN_ROOMS = ['Room 201', 'the library', 'the music room', 'Room 305']

const enNotice: Maker = (id) => {
  const event = pick(['class meeting', 'talent show', 'book fair', 'basketball game'])
  const day = pick(EN_DAYS)
  const time = pick(EN_TIMES)
  const room = pick(EN_ROOMS)
  const askWhen = Math.random() < 0.5
  const built = askWhen
    ? textChoices(`${day} ${time}`, shuffle(EN_TIMES.filter((t) => t !== time)).map((t) => `${day} ${t}`))
    : textChoices(room, shuffle(EN_ROOMS.filter((r) => r !== room)))
  return {
    id: `e-notice-${id}`,
    kind: 'english',
    badge: '国际频道 · 公告',
    title: '英文公告栏',
    scenario: `NOTICE\nThe ${event} will be on ${day} at ${time} in ${room}.\nPlease don't be late!  — Mr. Zhang`,
    prompt: askWhen
      ? `${PLAYER}帮同学确认：活动是什么时间？`
      : `${PLAYER}帮同学确认：活动在哪里举行？`,
    ...built,
    hint: askWhen ? '找 on 和 at 后面的词：日期和时间。' : '找 in 后面的词：地点。',
    explanation: askWhen ? `on ${day} at ${time}，就是${day}的 ${time}。` : `in ${room}，地点是 ${room}。`,
  }
}

const enEmail: Maker = (id) => {
  const name = mate()
  const day = pick(EN_DAYS)
  const time = pick(EN_TIMES)
  const thing = pick([
    ['notebook', '笔记本'],
    ['camera', '相机'],
    ['poster', '海报'],
    ['markers', '马克笔'],
  ])
  const askThing = Math.random() < 0.5
  const built = askThing
    ? textChoices(thing[1], shuffle(['雨伞', '尺子', '橡皮', '水壶']))
    : textChoices(`${day} ${time}`, shuffle(EN_TIMES.filter((t) => t !== time)).map((t) => `${day} ${t}`))
  return {
    id: `e-mail-${id}`,
    kind: 'english',
    badge: '国际频道 · 邮件',
    title: '小队邮件箱',
    scenario: `From: ${name}\nTo: Yiyi\n\nHi Yiyi!\nOur team will meet on ${day} at ${time}.\nPlease bring your ${thing[0]}. See you!`,
    prompt: askThing ? `${PLAYER}读完邮件，需要带什么去？` : `${PLAYER}读完邮件，小队几点碰头？`,
    ...built,
    hint: askThing ? '看 bring your 后面的词。' : '看 on 和 at 后面的词。',
    explanation: askThing
      ? `bring your ${thing[0]}，${thing[0]} 就是${thing[1]}。`
      : `on ${day} at ${time}，是${day}的 ${time}。`,
  }
}

// 英文购物（多步：买若干件再用券）
const enShopping: Maker = (id) => {
  const item = pick([
    ['cap', '帽子', 15],
    ['T-shirt', 'T恤', 25],
    ['toy bear', '玩具熊', 20],
    ['cup', '杯子', 12],
  ] as const)
  const n = rand(2, 4)
  const coupon = pick([5, 8, 10])
  const total = item[2] * n - coupon
  const built = numChoices(total, ' 元', [item[2] * n, item[2] * n + coupon, item[2] * n - coupon * 2])
  return {
    id: `e-shop-${id}`,
    kind: 'english',
    badge: '国际频道 · 购物',
    title: '英文收银台',
    scenario: `Sign: ${item[0]} — ¥${item[2]} each.\nCustomer: "I'll take ${n}, and here is a ¥${coupon} coupon."`,
    prompt: `${PLAYER}是收银员，这位顾客最后要付多少元？`,
    ...built,
    hint: `each 是「每个」，take ${n} 是要 ${n} 个；coupon 是优惠券，最后要减掉。`,
    explanation: `${item[0]} 是${item[1]}，${item[2]} × ${n} = ${item[2] * n} 元，再减 ${coupon} 元券 = ${total} 元。`,
  }
}

// 时刻表交叉查询
const enSchedule: Maker = (id) => {
  const rows = [
    { time: '9:00', act: 'English', cn: '英语' },
    { time: '10:00', act: 'Art', cn: '美术' },
    { time: '11:00', act: 'P.E.', cn: '体育' },
    { time: '2:00', act: 'Music', cn: '音乐' },
  ]
  const target = pick(rows)
  const askAct = Math.random() < 0.5
  const built = askAct
    ? textChoices(target.cn, shuffle(rows.filter((r) => r.time !== target.time).map((r) => r.cn)))
    : textChoices(target.time, shuffle(rows.filter((r) => r.act !== target.act).map((r) => r.time)))
  const table = rows.map((r) => `${r.time}  ${r.act}`).join('\n')
  return {
    id: `e-sched-${id}`,
    kind: 'english',
    badge: '国际频道 · 日程',
    title: '英文课程表',
    scenario: `Timetable\n${table}`,
    prompt: askAct
      ? `${PLAYER}查课程表：${target.time} 是什么课？`
      : `${PLAYER}查课程表：${target.act} 课是几点？`,
    ...built,
    hint: askAct ? '在左边找到这个时间，看右边对应的课。' : '在右边找到这门课，看左边对应的时间。',
    explanation: askAct
      ? `${target.time} 对应 ${target.act}，就是${target.cn}课。`
      : `${target.act}（${target.cn}）排在 ${target.time}。`,
  }
}

// 英文短文推断
const enPassage: Maker = (id) => {
  const card = freshPick('passage', [
    {
      text: `Tom puts on his coat, takes an umbrella, and looks at the grey sky. "I need my boots, too," he says.`,
      q: '从短文能推断出当时的天气怎么样？',
      right: '阴天，很可能要下雨',
      wrongs: ['晴天，阳光很好', '正在下雪'],
      why: 'umbrella(伞)、grey sky(灰天)、boots(雨靴) 都指向阴雨天。',
    },
    {
      text: `Lucy blows out the candles, opens the box from her friends, and everyone sings to her.`,
      q: 'Lucy 最可能在做什么？',
      right: '在过生日',
      wrongs: ['在上数学课', '在打扫教室'],
      why: 'candles(蜡烛)、sing to her、box from friends(礼物) 都说明在庆祝生日。',
    },
    {
      text: `The shop is dark. The lights are off and a sign on the door says "See you tomorrow!"`,
      q: '这家店现在的状态是？',
      right: '已经关门了',
      wrongs: ['正在营业', '在打折促销'],
      why: 'dark、lights off、"See you tomorrow" 都说明店已打烊。',
    },
    {
      text: `Sam looks at the menu, but everything is in French. He doesn't understand it, so he just points at a picture.`,
      q: 'Sam 现在遇到了什么麻烦？',
      right: '他看不懂菜单',
      wrongs: ['他没带钱', '餐厅已经关门'],
      why: "in French、doesn't understand、points at a picture 都说明他看不懂菜单。",
    },
    {
      text: `The sky turns dark. Birds fly away quickly and the wind becomes very strong. People start to run home.`,
      q: '接下来最可能发生什么？',
      right: '一场暴风雨就要来了',
      wrongs: ['马上要天晴了', '人们要去公园野餐'],
      why: 'dark sky、strong wind、people run home 都是暴风雨将至的信号。',
    },
    {
      text: `Anna's bag is full of books. She is holding a library card and walking into a quiet building with many shelves.`,
      q: 'Anna 最可能要去哪里？',
      right: '图书馆',
      wrongs: ['游泳馆', '电影院'],
      why: 'books、library card、quiet building with shelves 都指向图书馆。',
    },
    {
      text: `Ben keeps looking at the clock. His leg is shaking and he checks the door again and again.`,
      q: '从短文能看出 Ben 现在的心情是？',
      right: '紧张、在等什么人或什么事',
      wrongs: ['很困、想睡觉', '很无聊、不想动'],
      why: '反复看钟、抖腿、盯着门，都说明他既紧张又焦急地在等。',
    },
    {
      text: `Mr. Green opens the window, smells the fresh air and says, "Winter is finally over!" The trees are turning green.`,
      q: '现在最可能是什么季节？',
      right: '春天',
      wrongs: ['冬天', '深秋'],
      why: 'Winter is over、fresh air、trees turning green 都说明春天到了。',
    },
  ])
  const built = textChoices(card.right, card.wrongs)
  return {
    id: `e-pass-${id}`,
    kind: 'english',
    badge: '初中预告 · 短文',
    title: '英文短文社',
    scenario: card.text,
    prompt: `${PLAYER}读这段英文，${card.q}`,
    ...built,
    hint: `短文没直说答案，要抓住几个关键英文词一起判断。`,
    explanation: card.why,
  }
}

// ===========================================================================
// 科学 / 计算机
// ===========================================================================

const sciExperiment: Maker = (id) => {
  const card = freshPick('experiment', [
    {
      goal: '比较机翼大小对纸飞机飞行距离的影响',
      right: '只改机翼大小，用同样的纸、同样的力气投掷',
      wrongs: ['机翼和纸张厚度一起换着试', '每次随便换个人来扔'],
    },
    {
      goal: '比较光照对绿豆苗生长的影响',
      right: '两盆一样的豆苗，一盆放阳台一盆放柜里，浇一样多的水',
      wrongs: ['给阳台那盆多浇些水', '两盆都放在阳台上'],
    },
    {
      goal: '比较斜坡高度对小车滑行距离的影响',
      right: '同一辆小车，只改变斜坡的高度',
      wrongs: ['换更重的小车同时加高斜坡', '每次在不同地面上滑'],
    },
    {
      goal: '比较水温对方糖溶解快慢的影响',
      right: '两杯水量一样，只让水温不同，各放一块同样的方糖',
      wrongs: ['一杯水多一杯水少，水温也不一样', '一杯放方糖、一杯放冰糖'],
    },
    {
      goal: '比较肥料多少对番茄苗长高的影响',
      right: '几盆一样的番茄苗，只改施肥的量，阳光和浇水都一样',
      wrongs: ['施肥多的那盆顺便多晒太阳', '每盆换不同种类的苗来种'],
    },
    {
      goal: '比较橡皮筋拉的长短对小车弹射距离的影响',
      right: '同一辆车、同一根橡皮筋，只改变往后拉的长度',
      wrongs: ['每次换一根不同的橡皮筋', '拉得长就同时把车也换重一点'],
    },
    {
      goal: '比较盐放多少对鸡蛋能否浮起来的影响',
      right: '几杯水量相同的水，只改变加盐的多少',
      wrongs: ['一杯热水一杯冷水，盐也加得不一样', '一杯放鸡蛋、一杯放乒乓球'],
    },
  ])
  const built = textChoices(card.right, card.wrongs)
  return {
    id: `s-exp-${id}`,
    kind: 'science',
    badge: '极客角 · 对比',
    title: '实验设计部',
    scenario: `${PLAYER}是科学小组组长，小组想${card.goal}。`,
    prompt: `哪种安排才能比出真正的结果？`,
    ...built,
    hint: `对比实验一次只能改一个条件，其余必须完全一样。`,
    explanation: `只改一个条件，结果才能归到它头上——这叫控制变量。`,
  }
}

const sciFlow: Maker = (id) => {
  const variant = pick(['nest', 'condition', 'sequence'] as const)
  if (variant === 'nest') {
    const outer = pick([2, 3])
    const inner = pick([3, 4])
    const step = pick([2, 5])
    const ans = outer * inner * step
    const built = numChoices(ans, '', [outer + inner, inner * step, ans + step])
    return {
      id: `s-flow-${id}`,
      kind: 'science',
      badge: '极客角 · 指令',
      title: '机器人调试台',
      scenario: `${PLAYER}给机器人写指令：数字从 0 开始，重复 ${outer} 次「重复 ${inner} 次：每次加 ${step}」。`,
      prompt: `指令跑完，数字是多少？`,
      ...built,
      hint: `里层加了 ${inner} 次，外层又重复 ${outer} 次，一共加了 ${outer} × ${inner} 次。`,
      explanation: `一共加 ${outer} × ${inner} = ${outer * inner} 次，每次 ${step}：×${step} = ${ans}。`,
    }
  }
  if (variant === 'condition') {
    const card = pick([
      { cond: '人数超过 30', yes: '报告厅', no: '教室', now: '只来了 25 人', answer: '教室' },
      { cond: '电量低于 20%', yes: '回去充电', no: '继续巡逻', now: '电量还有 80%', answer: '继续巡逻' },
      { cond: '下雨', yes: '多功能厅', no: '操场', now: '今天是晴天', answer: '操场' },
    ])
    const built = textChoices(card.answer, [card.answer === card.yes ? card.no : card.yes, '原地待命'])
    return {
      id: `s-flow-${id}`,
      kind: 'science',
      badge: '极客角 · 指令',
      title: '机器人调试台',
      scenario: `${PLAYER}写的指令：如果${card.cond}，就去${card.yes}；否则就${card.no}。\n现在：${card.now}。`,
      prompt: `机器人会怎么做？`,
      ...built,
      hint: `先判断条件成立不成立，再选对应的分支。`,
      explanation: `条件「${card.cond}」不成立，走「否则」这一支：${card.answer}。`,
    }
  }
  const s = rand(4, 9)
  const m = rand(2, 5)
  const ans = s * 2 - m
  const built = numChoices(ans, '', [s * 2 + m, (s - m) * 2, s * 2])
  return {
    id: `s-flow-${id}`,
    kind: 'science',
    badge: '极客角 · 指令',
    title: '机器人调试台',
    scenario: `${PLAYER}输入指令：从数字 ${s} 开始，第一步乘 2，第二步减 ${m}。`,
    prompt: `最后输出多少？`,
    ...built,
    hint: `按步骤来，先乘后减，顺序不能换。`,
    explanation: `${s} × 2 = ${s * 2}，再减 ${m} = ${ans}。`,
  }
}

const sciClassify: Maker = (id) => {
  const card = freshPick('classify', [
    { group: '哺乳动物', members: ['鲸', '蝙蝠', '海豚'], odd: '企鹅', oddWhy: '企鹅是鸟类' },
    { group: '昆虫', members: ['蚂蚁', '蜜蜂', '瓢虫'], odd: '蜘蛛', oddWhy: '蜘蛛有八条腿，不是昆虫' },
    { group: '导体', members: ['铁钉', '铜线', '铝勺'], odd: '橡皮', oddWhy: '橡皮不导电' },
    { group: '气体', members: ['氧气', '二氧化碳', '水蒸气'], odd: '冰块', oddWhy: '冰块是固体' },
    { group: '质数', members: ['7', '11', '13'], odd: '15', oddWhy: '15 = 3 × 5，是合数' },
    { group: '行星', members: ['火星', '木星', '金星'], odd: '月球', oddWhy: '月球是地球的卫星，不是行星' },
    { group: '液体', members: ['牛奶', '果汁', '食用油'], odd: '面粉', oddWhy: '面粉是固体粉末' },
    { group: '偶数', members: ['24', '36', '50'], odd: '27', oddWhy: '27 是奇数' },
    { group: '能被 3 整除的数', members: ['18', '27', '42'], odd: '20', oddWhy: '20 不能被 3 整除' },
    { group: '输入设备', members: ['键盘', '鼠标', '麦克风'], odd: '打印机', oddWhy: '打印机是输出设备' },
    { group: '凭电池工作的', members: ['手电筒', '遥控器', '电子表'], odd: '风筝', oddWhy: '风筝靠风飞，不用电池' },
  ])
  const options = shuffle([...card.members, card.odd])
  return {
    id: `s-cls-${id}`,
    kind: 'science',
    badge: '极客角 · 归档',
    title: '分类整理局',
    prompt: `${PLAYER}在给资料卡分组，哪一张和其他三张不是一类？`,
    choices: options.map((text) => c(text, text)),
    answer: card.odd,
    hint: `先找出另外三张的共同点。`,
    explanation: `${card.members.join('、')}都属于${card.group}，而${card.odd}不是——${card.oddWhy}。`,
  }
}

const sciInfo: Maker = (id) => {
  const card = freshPick('info', [
    {
      msg: '群里转发：「明天全市停水，赶紧囤水！」但水务公司官网没有任何通知。',
      right: '先查官方消息，确认前不转发',
      wrongs: ['马上转发提醒所有人', '立刻去超市抢水'],
    },
    {
      msg: '短视频说：「某饮料连喝七天能长高十厘米。」',
      right: '不可信，长高没有这种捷径',
      wrongs: ['买来连喝七天试试', '转发给想长高的同学'],
    },
    {
      msg: '陌生号码短信：「恭喜中奖，点链接领大奖！」',
      right: '不点链接，并告诉家长',
      wrongs: ['先点开看看是什么奖', '回复问怎么领奖'],
    },
    {
      msg: '网文说「章鱼有三颗心脏」，小组想确认真假。',
      right: '查权威科普网站或图书核实',
      wrongs: ['配图很精美，直接相信', '投票，多数人信就算真'],
    },
    {
      msg: '同学转来一张「某明星去世」的截图，但所有正规新闻网站都查不到。',
      right: '没有正规来源前，不信也不传',
      wrongs: ['先转到家庭群里再说', '截图这么清楚肯定是真的'],
    },
    {
      msg: '弹窗广告说：「你的手机中病毒了，点这里立即清理！」',
      right: '不点弹窗，直接关掉',
      wrongs: ['赶紧点进去清理', '按提示下载那个清理软件'],
    },
    {
      msg: '一篇文章标题是「震惊！白开水居然不能喝」，点进去全是卖净水器的。',
      right: '这是博眼球的标题党，不能当真',
      wrongs: ['赶紧把家里的水都倒掉', '马上下单买一台净水器'],
    },
    {
      msg: '游戏里有人私信：「加我领免费皮肤，先把账号密码发我。」',
      right: '绝不发密码，并告诉家长',
      wrongs: ['先发个密码试试能不能领', '把同学的账号也一起发过去'],
    },
    {
      msg: '小组要在作业里引用一个数据，找到两个网站，一个是官方统计局，一个是不知名论坛。',
      right: '采用官方统计局的数据',
      wrongs: ['用论坛的，因为先搜到它', '两个平均一下'],
    },
  ])
  const built = textChoices(card.right, card.wrongs)
  return {
    id: `s-info-${id}`,
    kind: 'science',
    badge: '极客角 · 鉴别',
    title: '消息核实站',
    scenario: card.msg,
    prompt: `${PLAYER}是消息核实员，最靠谱的做法是？`,
    ...built,
    hint: `看到耸动消息先问三件事：谁说的？有证据吗？官方证实了吗？`,
    explanation: `判断真假要看来源和证据，官方渠道和权威资料最可靠。`,
  }
}

const sciCode: Maker = (id) => {
  const variant = pick(['shift', 'binary'] as const)
  if (variant === 'shift') {
    const shift = pick([1, 2, 3])
    const base = pick(['CAT', 'DOG', 'SUN', 'MAP', 'BUS', 'BOX', 'CUP', 'KEY', 'FOX', 'PEN', 'ICE', 'JAM'])
    const encode = (s: string) =>
      s
        .split('')
        .map((ch) => String.fromCharCode(((ch.charCodeAt(0) - 65 + shift) % 26) + 65))
        .join('')
    const answer = encode(base)
    const wrong1 = base
      .split('')
      .map((ch) => String.fromCharCode(((ch.charCodeAt(0) - 65 + shift + 1) % 26) + 65))
      .join('')
    const wrong2 = base
      .split('')
      .map((ch) => String.fromCharCode(((ch.charCodeAt(0) - 65 - shift + 26) % 26) + 65))
      .join('')
    const built = textChoices(answer, [wrong1, wrong2])
    return {
      id: `s-code-${id}`,
      kind: 'science',
      badge: '极客角 · 密码',
      title: '密码特工站',
      scenario: `${PLAYER}在用「字母后移」加密：每个字母都往后移 ${shift} 位（A→${String.fromCharCode(65 + shift)}）。`,
      prompt: `单词 ${base} 加密后是什么？`,
      ...built,
      hint: `每个字母都按字母表往后数 ${shift} 个，到 Z 之后再从 A 接着数。`,
      explanation: `每个字母后移 ${shift} 位：${base} → ${answer}。`,
    }
  }
  const card = pick([
    { dec: 5, bin: '101' },
    { dec: 6, bin: '110' },
    { dec: 9, bin: '1001' },
    { dec: 10, bin: '1010' },
    { dec: 12, bin: '1100' },
  ])
  const built = textChoices(card.bin, [(card.dec + 1).toString(2), (card.dec - 1).toString(2)])
  return {
    id: `s-code-${id}`,
    kind: 'science',
    badge: '极客角 · 编码',
    title: '二进制译码台',
    scenario: `${PLAYER}在学计算机用的二进制：它只有 0 和 1，从右往左每位代表 1、2、4、8……`,
    prompt: `十进制的 ${card.dec} 写成二进制是多少？`,
    ...built,
    hint: `把 ${card.dec} 拆成 8、4、2、1 里几个数的和，用到的位写 1。`,
    explanation: `${card.dec} = ${card.bin}（二进制）。`,
  }
}

// ===========================================================================
// 茶水间（穿插小卡，不计分）
// ===========================================================================

// 真的假的：事实都经过核实，real=true 表示「真的」。joke 是搞笑的第三个选项。
const TRUE_FALSE: { fact: string; real: boolean; why: string; joke: string }[] = [
  { fact: '章鱼有三颗心脏。', real: true, why: '真的：两颗给鳃供血，一颗负责全身血液循环。', joke: '只有星期三才跳' },
  { fact: '蜂蜜保存得当，放很多年也几乎不会坏。', real: true, why: '真的：蜂蜜含水极少又偏酸，细菌很难存活。', joke: '只有放冰箱才不会坏' },
  { fact: '长颈鹿和人脖子里都是 7 块颈椎骨。', real: true, why: '真的：哺乳动物大多 7 块，长颈鹿只是每块特别长。', joke: '长颈鹿有 70 块' },
  { fact: '闪电那一瞬间的温度，比太阳表面还高。', real: true, why: '真的：闪电可达上万摄氏度，比太阳表面还烫。', joke: '和洗澡水差不多' },
  { fact: '北极熊的皮肤其实是黑色的。', real: true, why: '真的：黑皮肤更吸热，毛是半透明的中空管，看起来才发白。', joke: '北极熊是透明的隐形熊' },
  { fact: '鲨鱼比地球上第一棵树出现得还早。', real: true, why: '真的：鲨鱼已经在海里游了好几亿年，比树还古老。', joke: '鲨鱼是上个月才进化出来的' },
  { fact: '鸵鸟的眼睛比它的大脑还大。', real: true, why: '真的：鸵鸟眼睛大得惊人，脑子反而小小一颗。', joke: '鸵鸟根本没长眼睛' },
  { fact: '香蕉在植物学上其实算一种浆果。', real: true, why: '真的：按植物学定义香蕉是浆果，而草莓反倒不是。', joke: '香蕉其实是蔬菜' },
  { fact: '人的左肺比右肺小一点。', real: true, why: '真的：左边要给心脏让地方，所以左肺小一些。', joke: '人只有一个肺' },
  { fact: '蓝鲸是地球上出现过的最大动物，比恐龙还大。', real: true, why: '真的：蓝鲸的体重超过已知任何恐龙。', joke: '蓝鲸和金鱼差不多大' },
  { fact: '月球上是真空，面对面大喊也听不见。', real: true, why: '真的：没有空气传声，宇航员只能靠无线电对讲。', joke: '月球上回声特别响' },
  { fact: '企鹅是鸟，可它一辈子都不会飞。', real: true, why: '真的：企鹅是鸟类，翅膀进化成了划水的鳍。', joke: '企鹅能飞越南极' },
  { fact: '土星太轻了，理论上能浮在一大盆水上。', real: true, why: '真的：土星的平均密度比水还小。', joke: '土星比铁球还沉' },
  { fact: '海星没有大脑。', real: true, why: '真的：海星靠分布在全身的神经网络活动，没有大脑。', joke: '海星有五个大脑' },
  { fact: '老虎剃光毛之后，皮肤上也有条纹。', real: true, why: '真的：条纹连皮肤都印着，不只是长在毛上。', joke: '条纹是饲养员画上去的' },
  { fact: '金鱼的记忆只有三秒。', real: false, why: '假的：研究发现金鱼能记住事情好几个月。', joke: '夏天三秒、冬天五秒' },
  { fact: '人打喷嚏的时候，心脏会停跳一下。', real: false, why: '假的：心跳并不会因为打喷嚏而停止。', joke: '会停整整一分钟' },
  { fact: '在太空里用肉眼能看到的人造建筑，只有长城。', real: false, why: '假的：这是流传很广的误传，肉眼其实很难看清长城。', joke: '还能看到学校操场' },
  { fact: '鸵鸟一害怕就把头埋进沙子里。', real: false, why: '假的：这是误传，它只是低头察看或翻动鸟蛋。', joke: '它会把全身都埋起来' },
  { fact: '人一辈子只用了大脑的 10%。', real: false, why: '假的：这早被辟谣，大脑各区域都在工作。', joke: '只用了 1%' },
  { fact: '骆驼的驼峰里装的是水。', real: false, why: '假的：驼峰里装的是脂肪，可不是一袋水。', joke: '装的是沙子' },
  { fact: '地球一年绕着太阳转 365 圈。', real: false, why: '假的：一年地球只绕太阳转 1 圈，约 365 天。', joke: '一年转 12 圈' },
]

// 脑筋急转弯 / 吐槽 / 冷知识
const FUN_CARDS: { title: string; scenario?: string; prompt: string; right: string; wrongs: [string, string]; why: string }[] = [
  { title: '脑筋急转弯', prompt: '什么数字最听话？', right: '100（百依百顺）', wrongs: ['1（一马当先）', '0（一无所有）'], why: '一「百」依「百」顺，所以是 100。' },
  { title: '脑筋急转弯', prompt: '什么东西越分越多？', right: '快乐', wrongs: ['蛋糕', '零花钱'], why: '快乐分给别人，自己不会变少，反而更多。' },
  { title: '脑筋急转弯', prompt: '什么东西天气越热，它爬得越高？', right: '温度计', wrongs: ['爬山虎', '蚂蚁'], why: '天越热，温度计里的水银柱就升得越高。' },
  { title: '脑筋急转弯', prompt: '什么海里一滴水都没有？', right: '脑海', wrongs: ['大海', '黄海'], why: '「脑海」里装的是想法，不是水。' },
  { title: '脑筋急转弯', prompt: '什么车天天转却寸步难行？', right: '风车', wrongs: ['公交车', '自行车'], why: '风车原地转个不停，却一步都走不了。' },
  { title: '脑筋急转弯', prompt: '一年四季都开、还从不用浇水的花是什么？', right: '塑料花', wrongs: ['桃花', '向日葵'], why: '塑料花当然不挑季节、也不用浇水。' },
  { title: '吐槽时间', scenario: `${MATH_TEACHER}说：「这道题我只讲一遍。」结果一连讲了五遍。`, prompt: '闫一依心里想？', right: '老师真好，我假装第一次听', wrongs: ['第一遍就开始走神', '举手要求讲第六遍'], why: '老师其实是怕大家没听懂，会心一笑继续就好。' },
  { title: '吐槽时间', scenario: '体育老师大手一挥：「这节课自由活动！」', prompt: '全班最后自由地干了什么？', right: '回教室自由地写作业', wrongs: ['自由地睡了一觉', '自由地考了一场试'], why: '「自由活动」的尽头，往往是补作业，笑一下继续。' },
  { title: '吐槽时间', scenario: `考试前 ${HEAD_TEACHER} 班上的同学都说「我一点没复习」，结果个个考得不错。`, prompt: '闫一依的对策是？', right: '笑而不语，自己照样认真准备', wrongs: ['从此再不信这句话', '也跟着不复习'], why: '别人嘴上说不复习，桌上的笔记可一点没少——做好自己的就行。' },
  { title: '冷知识', scenario: '一天之内，钟面上时针和分针会重合好几次。', prompt: '一共重合几次？', right: '22 次', wrongs: ['24 次', '12 次'], why: '12 小时里重合 11 次，一整天就是 22 次。' },
]

const SPARK_INTROS = [
  (s: string, f: string) => `${s}拍着胸脯保证：${f}`,
  (s: string, f: string) => `${s}压低声音说：${f}`,
  (s: string, f: string) => `茶水间情报站：${f}（消息来自 ${s}）`,
  (s: string, f: string) => `${s}赌一包辣条：${f}`,
  (s: string, f: string) => `${s}神秘兮兮地凑过来：${f}`,
]

const sparkQuestion: Maker = (id) => {
  const [a, b] = twoMates()
  if (Math.random() < 0.6) {
    const card = freshPick('spark-tf', TRUE_FALSE)
    const intro = pick(SPARK_INTROS)
    const right = card.real ? '真的' : '假的'
    const built = textChoices(right, [card.real ? '假的' : '真的', card.joke])
    return {
      id: `spark-${id}`,
      kind: 'spark',
      badge: '茶水间 · 真的假的',
      title: '真的假的',
      scenario: intro(a, card.fact),
      prompt: '这是真的，还是假的？',
      ...built,
      hint: '茶水间小卡不计分，大胆猜。',
      explanation: card.why,
    }
  }
  const card = freshPick('spark-fun', FUN_CARDS)
  const built = textChoices(card.right, card.wrongs)
  return {
    id: `spark-${id}`,
    kind: 'spark',
    badge: '茶水间',
    title: card.title,
    scenario: card.scenario ?? (Math.random() < 0.5 ? `${a}突然发问——` : `${b}举手抢答——`),
    prompt: card.prompt,
    ...built,
    hint: '茶水间小卡不计分，放松一下。',
    explanation: card.why,
  }
}

// ===========================================================================
// 组卷
// ===========================================================================

const MATH_MAKERS: Maker[] = [
  mathRatioShare,
  mathFracRemain,
  mathFracOf,
  mathScale,
  mathCompare,
  mathPercentApp,
  mathReverse,
  mathMultiple,
  mathAverage2,
  mathAreaCombo,
  mathMeet,
  mathUnit2,
  mathNeg2,
  mathChart,
]

const CHINESE_MAKERS: Maker[] = [cnNotice, cnMainIdea, cnInfer, cnIdiom, cnClassical, cnRelate]

const ENGLISH_MAKERS: Maker[] = [enNotice, enEmail, enShopping, enSchedule, enPassage]

const SCIENCE_MAKERS: Maker[] = [sciExperiment, sciFlow, sciClassify, sciInfo, sciCode]

const PLANNER_MAKERS: Maker[] = [
  mathRatioShare,
  mathFracOf,
  mathScale,
  mathCompare,
  mathPercentApp,
  mathMultiple,
  mathAverage2,
  mathAreaCombo,
  mathMeet,
  mathUnit2,
  mathChart,
]

const PREVIEW_MAKERS: Maker[] = [
  mathFracRemain,
  mathReverse,
  mathNeg2,
  cnInfer,
  cnClassical,
  enPassage,
  sciCode,
]

function cycled(makers: Maker[]): Maker {
  const order = shuffle(makers)
  let i = 0
  return (id) => order[i++ % order.length](id)
}

export function buildBureauQuestions(mode: BureauMode, count: number): BureauQuestion[] {
  const math = cycled(MATH_MAKERS)
  const chinese = cycled(CHINESE_MAKERS)
  const english = cycled(ENGLISH_MAKERS)
  const science = cycled(SCIENCE_MAKERS)
  const planner = cycled(PLANNER_MAKERS)
  const archive = cycled([...CHINESE_MAKERS, ...ENGLISH_MAKERS])
  const preview = cycled(PREVIEW_MAKERS)

  const questions = Array.from({ length: count }, (_, idx) => {
    if (idx > 0 && idx % 4 === 3) return sparkQuestion(idx)
    if (mode === 'planner') return planner(idx)
    if (mode === 'archive') return archive(idx)
    if (mode === 'preview') return preview(idx)
    const roll = Math.random()
    if (roll < 0.6) return math(idx)
    if (roll < 0.75) return chinese(idx)
    if (roll < 0.9) return english(idx)
    return science(idx)
  })

  return shuffle(questions)
}
