import { PLAYER } from './people'
import { c, freshPick, numChoices, pick, rand, shuffle, textChoices, type Maker } from './_shared'

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

export const SCIENCE_MAKERS: Maker[] = [sciExperiment, sciFlow, sciClassify, sciInfo, sciCode]

// 单独导出供组卷 PREVIEW_MAKERS 复用
export { sciCode }
