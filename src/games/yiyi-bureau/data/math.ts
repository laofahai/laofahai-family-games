import type { Choice } from '../types'
import { MATH_TEACHER, PLAYER } from './people'
import { mate, numChoices, pick, rand, textChoices, WEEK, type Maker } from './_shared'

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

export const MATH_MAKERS: Maker[] = [
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

export const PLANNER_MAKERS: Maker[] = [
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

// 单独导出供组卷 PREVIEW_MAKERS 复用
export { mathFracRemain, mathReverse, mathNeg2 }
