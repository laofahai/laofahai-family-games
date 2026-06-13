import type {
  DetectiveQuestion,
  ShopItem,
  ShopQuestion,
  SparkQuestion,
  TownMode,
  TownQuestion,
  VerticalQuestion,
} from '../types'
import {
  c,
  formatMoney,
  moneyChoices,
  moneyExpr,
  numberChoices,
  operationChoices,
  pick,
  rand,
  shuffle,
} from '@/games/shared/question-utils'
import { pickUnseen } from '@/platform/progress'

interface Thing {
  name: string
  unit: string
  emoji?: string
}

const things: Thing[] = [
  { name: '苹果', unit: '个' },
  { name: '草莓', unit: '颗' },
  { name: '贴纸', unit: '张' },
  { name: '糖果', unit: '颗' },
  { name: '铅笔', unit: '支' },
  { name: '本子', unit: '本' },
  { name: '小花', unit: '朵' },
  { name: '小鱼', unit: '条' },
  { name: '积木', unit: '块' },
  { name: '星星卡', unit: '张' },
  { name: '小饼干', unit: '块' },
  { name: '跳绳次数', unit: '下' },
]

const PLAYER_NAME = '闫顺儿'
const MATH_TEACHER_NAME = '朱老师'
const CHINESE_TEACHER_NAME = '陈老师'
const classmates = [
  '邸飞宇',
  '丁怡铭',
  '范晨宇',
  '范煜林',
  '冯珺涵',
  '高锦轩',
  '高梓皓',
  '郭欣妍',
  '郭智旭',
  '韩一菲',
  '林子文',
  '刘霄',
  '卢昱润',
  '马晨硕',
  '潘芊语',
  '逄钧然',
  '戚艺曦',
  '齐玉林',
  '施政宇',
  '宋翔赫',
  '宋梓宸',
  '王博冉',
  '王晗伊',
  '王浩宇',
  '王佳雯',
  '王婧瑄',
  '王俊哲',
  '王姝心',
  '王兴琰',
  '王雨航',
  '王御阳',
  '吴恺澄',
  '徐嘉泽',
  '闫鑫怡',
  '殷中和',
  '臧晨希',
  '张力文',
  '张轩宁',
  '张怡甜',
  '张韵渲',
  '赵蕴涵',
  '郑皓俊',
  '钟嘉馨',
  '周源',
]

const people = [
  PLAYER_NAME,
  '姐姐',
  '妈妈',
  '爸爸',
  MATH_TEACHER_NAME,
  CHINESE_TEACHER_NAME,
  '班长',
  ...classmates,
]

function randomClassmate(): string {
  return pick(classmates)
}

function takeAwayScenes() {
  const classmate = randomClassmate()
  return [
    { actor: MATH_TEACHER_NAME, action: `发给${classmate}`, ask: `${MATH_TEACHER_NAME}手里还剩` },
    { actor: CHINESE_TEACHER_NAME, action: `发给${classmate}`, ask: `${CHINESE_TEACHER_NAME}手里还剩` },
    { actor: `小店老板${PLAYER_NAME}`, action: '卖出去', ask: '店里还剩' },
    { actor: '班长', action: '分给小组', ask: '班长还剩' },
    { actor: '妈妈', action: '拿去装盘', ask: '桌上还剩' },
    { actor: '图书管理员', action: '借出去', ask: '书架上还剩' },
    { actor: PLAYER_NAME, action: `送给${classmate}`, ask: '她还剩' },
  ]
}

function joinScenes() {
  return [
    { owner: `${MATH_TEACHER_NAME}的讲台上`, giver: `${randomClassmate()}又交上来`, ask: '讲台上一共有' },
    { owner: `${CHINESE_TEACHER_NAME}的讲台上`, giver: `${randomClassmate()}又交上来`, ask: '讲台上一共有' },
    { owner: `${PLAYER_NAME}的小店里`, giver: '爸爸又补货', ask: '小店里一共有' },
    { owner: '班级图书角', giver: '妈妈又捐来', ask: '图书角一共有' },
    { owner: '姐姐的盒子里', giver: `${PLAYER_NAME}又放进去`, ask: '盒子里一共有' },
    { owner: '餐桌上', giver: '爸爸又拿来', ask: '餐桌上一共有' },
  ]
}

const missingScenes = [
  { planner: MATH_TEACHER_NAME, verb: '准备', targetName: '闯关卡' },
  { planner: CHINESE_TEACHER_NAME, verb: '准备', targetName: '故事卡' },
  { planner: '班长', verb: '收齐', targetName: '小组任务' },
  { planner: `小店老板${PLAYER_NAME}`, verb: '备货', targetName: '下午营业' },
  { planner: '妈妈', verb: '准备', targetName: '晚饭' },
  { planner: '图书管理员', verb: '整理', targetName: '书架' },
]

const twoStepScenes = [
  { place: '小店货架上', more: '又补上', away: '卖出去', ask: '货架上现在有' },
  { place: `${MATH_TEACHER_NAME}讲台上`, more: '又收上来', away: '发下去', ask: '讲台上现在有' },
  { place: `${CHINESE_TEACHER_NAME}讲台上`, more: '又收上来', away: '发下去', ask: '讲台上现在有' },
  { place: '班级图书角', more: '又捐来', away: '借出去', ask: '图书角现在有' },
  { place: '家里的盘子里', more: '又放进来', away: '吃掉', ask: '盘子里现在有' },
  { place: `${PLAYER_NAME}的盒子里`, more: '又得到', away: '送出去', ask: '盒子里现在有' },
]

const shopCatalog: ShopItem[] = [
  { name: '铅笔', price: 2, emoji: '✏️' },
  { name: '自动铅笔芯', price: 1.5, emoji: '✏️' },
  { name: '橡皮', price: 3, emoji: '🧽' },
  { name: '彩色橡皮', price: 3.5, emoji: '🧽' },
  { name: '本子', price: 5, emoji: '📘' },
  { name: '贴纸包', price: 4, emoji: '🎟️' },
  { name: '小贴纸', price: 2.5, emoji: '⭐' },
  { name: '小印章', price: 7, emoji: '🔖' },
  { name: '果汁', price: 6, emoji: '🧃' },
  { name: '酸梅汤', price: 3.5, emoji: '🥤' },
  { name: '牛奶', price: 4, emoji: '🥛' },
  { name: '包子', price: 3, emoji: '🥟' },
  { name: '小馒头', price: 1.5, emoji: '🥟' },
  { name: '蛋挞', price: 5, emoji: '🥧' },
  { name: '冰淇淋', price: 8, emoji: '🍦' },
  { name: '小发夹', price: 9, emoji: '🌼' },
  { name: '角色卡', price: 10, emoji: '🃏' },
  { name: '弹力球', price: 6, emoji: '🏀' },
  { name: '酸奶', price: 5, emoji: '🥣' },
  { name: '饼干', price: 6.5, emoji: '🍪' },
  { name: '水彩笔', price: 12, emoji: '🖍️' },
  { name: '小发圈', price: 6, emoji: '🎀' },
  { name: '便利贴', price: 4, emoji: '📝' },
]

const buyerNames = [PLAYER_NAME, '姐姐', '妈妈', '爸爸', MATH_TEACHER_NAME, ...classmates]

const shopPlaces = ['文具店', '小卖部', '零食铺', '玩具摊', '班级义卖摊']


function sparkQuestion(id: number): SparkQuestion {
  const name = randomClassmate()
  const cards = [
    {
      flavor: 'riddle' as const,
      title: '脑筋急转弯',
      prompt: `${name}问：什么东西越洗越脏？`,
      answer: 'water',
      answerChoices: [c('water', '水'), c('towel', '毛巾'), c('soap', '肥皂')],
      explanation: '答案是水，因为洗东西时水会变脏。',
    },
    {
      flavor: 'riddle' as const,
      title: '脑筋急转弯',
      prompt: `${CHINESE_TEACHER_NAME}问：什么门永远关不上？`,
      answer: 'goal',
      answerChoices: [c('goal', '球门'), c('wood', '木门'), c('school', '校门')],
      explanation: '答案是球门，它不是用来开关的门。',
    },
    {
      flavor: 'joke' as const,
      title: '轻松一句',
      prompt: `${PLAYER_NAME}当老板第一天，${name}说：“老板，我买一块橡皮。”${PLAYER_NAME}说：“可以，但不能把记性也擦没。”`,
      answer: 'ok',
      answerChoices: [c('ok', '笑一下，继续'), c('again', '再买一块'), c('wrong', '记性不用带')],
      explanation: '休息一下，继续闯关。',
    },
    {
      flavor: 'sentence' as const,
      title: '一句话',
      prompt: `${MATH_TEACHER_NAME}说：会列竖式的人，不是算得快，是不容易看错位。`,
      answer: 'place',
      answerChoices: [c('place', '个位对个位，十位对十位'), c('fast', '越快越好'), c('guess', '看感觉选')],
      explanation: '竖式最重要的是相同数位对齐。',
    },
    {
      flavor: 'sentence' as const,
      title: '一句话',
      prompt: `${CHINESE_TEACHER_NAME}说：题目读两遍，不是慢，是在给大脑开灯。`,
      answer: 'read',
      answerChoices: [c('read', '先读懂再动笔'), c('skip', '跳过题目'), c('copy', '只看数字')],
      explanation: '读题时要看清楚问的是什么。',
    },
  ]
  const card = pickUnseen('shiliu:spark', cards, (c) => c.answer, 1)[0] ?? cards[0]
  return {
    id: `spark-${id}-${card.answer}`,
    kind: 'spark',
    title: card.title,
    prompt: card.prompt,
    hint: '这是一张休息卡，短短答一下就好。',
    flavor: card.flavor,
    answer: card.answer,
    answerChoices: card.answerChoices,
    explanation: card.explanation,
  }
}

function verticalQuestion(id: number): VerticalQuestion {
  const add = Math.random() > 0.45
  const top = add ? rand(12, 79) : rand(22, 89)
  const bottom = add ? rand(6, Math.min(19, 99 - top)) : rand(5, Math.min(29, top - 2))
  const answer = add ? top + bottom : top - bottom
  const operator = add ? '+' : '-'
  const onesNeedsCare = add ? (top % 10) + (bottom % 10) >= 10 : (top % 10) < (bottom % 10)
  const [assigner, solver] = shuffle(people).slice(0, 2)
  const scene = pick([
    `${MATH_TEACHER_NAME}让${solver}列竖式算`,
    `${CHINESE_TEACHER_NAME}请${solver}帮忙核对一道竖式`,
    `${assigner}给${solver}出了一道竖式题`,
    `${assigner}请${solver}在黑板上列竖式`,
    `${solver}主动说：这题我要列竖式算`,
  ])
  return {
    id: `v-${id}-${top}-${bottom}-${operator}`,
    kind: 'vertical',
    title: '竖式挑战',
    prompt: `${scene}：${top} ${operator} ${bottom} = ?`,
    hint: onesNeedsCare
      ? add
        ? '个位相加满十，要向十位进 1。'
        : '个位不够减，要向十位借 1。'
      : '先把个位和个位对齐，十位和十位对齐。',
    top,
    bottom,
    operator,
    answerChoices: numberChoices(answer, '', 0, 100, [add ? top + (bottom % 10) : top - (bottom % 10), answer + 10]).map((choice) => ({
      ...choice,
      text: choice.text.trim(),
    })),
    answer: String(answer),
    explanation: add
      ? `${top} + ${bottom} = ${answer}。列竖式时个位对个位，十位对十位${onesNeedsCare ? '，个位满十要进位' : ''}。`
      : `${top} - ${bottom} = ${answer}。列竖式时个位对个位，十位对十位${onesNeedsCare ? '，个位不够减要借位' : ''}。`,
  }
}

function detectiveTakeAway(id: number): DetectiveQuestion {
  const thing = pick(things)
  const scene = pick(takeAwayScenes())
  const start = rand(8, 20)
  const away = rand(2, start - 2)
  const answer = start - away
  return {
    id: `d-away-${id}-${start}-${away}`,
    kind: 'detective',
    title: `${thing.name}少了`,
    prompt: `${scene.actor}有 ${start} ${thing.unit}${thing.name}，${scene.action} ${away} ${thing.unit}。${scene.ask}几${thing.unit}${thing.name}？`,
    hint: '问“还剩”，数量变少，用减法。',
    clues: [
      c('start', `原来有 ${start} ${thing.unit}`),
      c('change', `送出 ${away} ${thing.unit}`),
      c('ask', `问还剩几${thing.unit}`),
      c('noise', scene.actor),
    ],
    correctClueIds: ['start', 'change', 'ask'],
    operationChoices: operationChoices('sub', `${start} - ${away}`, [
      `${start} + ${away}`,
      `${away} - ${start}`,
    ]),
    operationAnswer: 'sub',
    answerChoices: numberChoices(answer, thing.unit, 0, 30, [start + away, away]),
    answer: String(answer),
    explanation: `原来 ${start} ${thing.unit}，少了 ${away} ${thing.unit}，用 ${start} - ${away} = ${answer}。`,
  }
}

function detectiveJoin(id: number): DetectiveQuestion {
  const thing = pick(things)
  const scene = pick(joinScenes())
  const first = rand(3, 12)
  const second = rand(2, 9)
  const answer = first + second
  return {
    id: `d-join-${id}-${first}-${second}`,
    kind: 'detective',
    title: `${thing.name}合起来`,
    prompt: `${scene.owner}有 ${first} ${thing.unit}${thing.name}，${scene.giver} ${second} ${thing.unit}。${scene.ask}几${thing.unit}${thing.name}？`,
    hint: '问“一共”，两部分合起来，用加法。',
    clues: [
      c('first', `原来有 ${first} ${thing.unit}`),
      c('second', `又得到 ${second} ${thing.unit}`),
      c('ask', `问一共几${thing.unit}`),
      c('noise', scene.owner),
    ],
    correctClueIds: ['first', 'second', 'ask'],
    operationChoices: operationChoices('add', `${first} + ${second}`, [
      `${first} - ${second}`,
      `${second} - ${first}`,
    ]),
    operationAnswer: 'add',
    answerChoices: numberChoices(answer, thing.unit, 0, 30, [Math.abs(first - second), answer + 1]),
    answer: String(answer),
    explanation: `原来 ${first} ${thing.unit}，又得到 ${second} ${thing.unit}，合起来是 ${first} + ${second} = ${answer}。`,
  }
}

function detectiveCompare(id: number): DetectiveQuestion {
  const thing = pick(things)
  const small = rand(3, 12)
  const diff = rand(2, 8)
  const big = small + diff
  const firstIsBig = Math.random() > 0.5
  const a = firstIsBig ? big : small
  const b = firstIsBig ? small : big
  const [p1, p2] = shuffle(people).slice(0, 2)
  return {
    id: `d-compare-${id}-${big}-${small}`,
    kind: 'detective',
    title: `比一比`,
    prompt: `${p1}有 ${a} ${thing.unit}${thing.name}，${p2}有 ${b} ${thing.unit}${thing.name}。多的人比少的人多几${thing.unit}？`,
    hint: '问“多几”，是在比较，用大的数减小的数。',
    clues: [
      c('a', `${p1}有 ${a} ${thing.unit}`),
      c('b', `${p2}有 ${b} ${thing.unit}`),
      c('ask', `问多几${thing.unit}`),
      c('noise', `都是${thing.name}`),
    ],
    correctClueIds: ['a', 'b', 'ask'],
    operationChoices: operationChoices('sub', `${big} - ${small}`, [
      `${big} + ${small}`,
      `${small} + ${diff}`,
    ]),
    operationAnswer: 'sub',
    answerChoices: numberChoices(diff, thing.unit, 0, 30, [big + small, small]),
    answer: String(diff),
    explanation: `比较多几${thing.unit}，用大的 ${big} 减小的 ${small}，${big} - ${small} = ${diff}。`,
  }
}

function detectiveMissing(id: number): DetectiveQuestion {
  const thing = pick(things)
  const scene = pick(missingScenes)
  const target = rand(10, 25)
  const done = rand(3, target - 3)
  const answer = target - done
  return {
    id: `d-missing-${id}-${target}-${done}`,
    kind: 'detective',
    title: `还差多少`,
    prompt: `${scene.planner}要为${scene.targetName}${scene.verb} ${target} ${thing.unit}${thing.name}，现在已经有 ${done} ${thing.unit}。还要几${thing.unit}才够？`,
    hint: '问“还要、还差”，用目标数量减已经有的数量。',
    clues: [
      c('target', `一共要 ${target} ${thing.unit}`),
      c('done', `已经有 ${done} ${thing.unit}`),
      c('ask', `问还要几${thing.unit}`),
      c('noise', scene.planner),
    ],
    correctClueIds: ['target', 'done', 'ask'],
    operationChoices: operationChoices('sub', `${target} - ${done}`, [
      `${target} + ${done}`,
      `${done} + ${done}`,
    ]),
    operationAnswer: 'sub',
    answerChoices: numberChoices(answer, thing.unit, 0, 30, [target + done, done]),
    answer: String(answer),
    explanation: `要到 ${target} ${thing.unit}，已经有 ${done} ${thing.unit}，还差 ${target} - ${done} = ${answer}。`,
  }
}

function detectiveLine(id: number): DetectiveQuestion {
  const front = rand(2, 9)
  const back = rand(2, 9)
  const answer = front + back + 1
  const center = pick(people)
  return {
    id: `d-line-${id}-${front}-${back}`,
    kind: 'detective',
    title: '排队小问题',
    prompt: `排队时，${center}前面有 ${front} 人，后面有 ${back} 人。这一队一共有几人？`,
    hint: `别忘了把${center}自己也算进去。`,
    clues: [
      c('front', `前面 ${front} 个`),
      c('back', `后面 ${back} 个`),
      c('self', `${center}自己 1 个`),
      c('ask', '问一共几个'),
    ],
    correctClueIds: ['front', 'back', 'self', 'ask'],
    operationChoices: operationChoices('add', `${front} + ${back} + 1`, [
      `${front} + ${back}`,
      `${Math.max(front, back)} - ${Math.min(front, back)}`,
    ]),
    operationAnswer: 'add',
    answerChoices: numberChoices(answer, '个', 0, 30, [front + back, answer + 1]),
    answer: String(answer),
    explanation: `前面 ${front} 个，后面 ${back} 个，还要加${center}自己 1 个，一共 ${answer} 个。`,
  }
}

function detectiveTwoStep(id: number): DetectiveQuestion {
  const thing = pick(things)
  const scene = pick(twoStepScenes)
  const start = rand(8, 16)
  const more = rand(2, 7)
  const away = rand(2, Math.min(8, start + more - 3))
  const answer = start + more - away
  return {
    id: `d-two-${id}-${start}-${more}-${away}`,
    kind: 'detective',
    title: '先多后少',
    prompt: `${scene.place}原来有 ${start} ${thing.unit}${thing.name}，后来${scene.more} ${more} ${thing.unit}，再${scene.away} ${away} ${thing.unit}。${scene.ask}几${thing.unit}${thing.name}？`,
    hint: '按顺序算：先变多，再变少。',
    clues: [
      c('start', `原来 ${start} ${thing.unit}`),
      c('more', `又得到 ${more} ${thing.unit}`),
      c('away', `送出 ${away} ${thing.unit}`),
      c('ask', `问现在几${thing.unit}`),
    ],
    correctClueIds: ['start', 'more', 'away', 'ask'],
    operationChoices: operationChoices('seq', `${start} + ${more} - ${away}`, [
      `${start} + ${more} + ${away}`,
      `${start} - ${more} - ${away}`,
    ]),
    operationAnswer: 'seq',
    answerChoices: numberChoices(answer, thing.unit, 0, 35, [start + more + away, start + more]),
    answer: String(answer),
    explanation: `先算 ${start} + ${more} = ${start + more}，再算 ${start + more} - ${away} = ${answer}。`,
  }
}

function detectiveRelation(id: number): DetectiveQuestion {
  const thing = pick(things)
  const base = rand(4, 14)
  const diff = rand(2, 7)
  const more = Math.random() > 0.5
  const answer = more ? base + diff : base - diff
  const [knownPerson, targetPerson] = shuffle(people).slice(0, 2)
  return {
    id: `d-relation-${id}-${base}-${diff}-${more ? 'more' : 'less'}`,
    kind: 'detective',
    title: more ? '比他多' : '比他少',
    prompt: `${knownPerson}有 ${base} ${thing.unit}${thing.name}，${targetPerson}比${knownPerson}${more ? '多' : '少'} ${diff} ${thing.unit}。${targetPerson}有几${thing.unit}${thing.name}？`,
    hint: more ? '比别人多，就在别人数量上加。' : '比别人少，就在别人数量上减。',
    clues: [
      c('known', `${knownPerson}有 ${base} ${thing.unit}`),
      c('relation', `${targetPerson}${more ? '多' : '少'} ${diff} ${thing.unit}`),
      c('ask', `问${targetPerson}有几${thing.unit}`),
      c('noise', thing.name),
    ],
    correctClueIds: ['known', 'relation', 'ask'],
    operationChoices: operationChoices(more ? 'add' : 'sub', more ? `${base} + ${diff}` : `${base} - ${diff}`, [
      more ? `${base} - ${diff}` : `${base} + ${diff}`,
      `${base} + ${base}`,
    ]),
    operationAnswer: more ? 'add' : 'sub',
    answerChoices: numberChoices(answer, thing.unit, 0, 30, [base, base + diff]),
    answer: String(answer),
    explanation: `${targetPerson}比${knownPerson}${more ? '多' : '少'} ${diff} ${thing.unit}，所以用 ${more ? `${base} + ${diff}` : `${base} - ${diff}`} = ${answer}。`,
  }
}

function detectiveOriginal(id: number): DetectiveQuestion {
  const thing = pick(things)
  const change = rand(3, 9)
  const now = rand(6, 16)
  const gaveAway = Math.random() > 0.5
  const answer = gaveAway ? now + change : now - change
  const actor = pick([PLAYER_NAME, MATH_TEACHER_NAME, CHINESE_TEACHER_NAME, '班长', `小店老板${PLAYER_NAME}`])
  return {
    id: `d-original-${id}-${now}-${change}-${gaveAway ? 'away' : 'more'}`,
    kind: 'detective',
    title: '倒着想',
    prompt: `${actor}${gaveAway ? `送出 ${change} ${thing.unit}${thing.name}后` : `又得到 ${change} ${thing.unit}${thing.name}后`}，现在有 ${now} ${thing.unit}。原来有几${thing.unit}${thing.name}？`,
    hint: gaveAway ? '送出去后变少了，求原来要倒着加回去。' : '又得到后变多了，求原来要倒着减掉。',
    clues: [
      c('change', `${gaveAway ? '送出' : '又得到'} ${change} ${thing.unit}`),
      c('now', `现在有 ${now} ${thing.unit}`),
      c('ask', `问原来几${thing.unit}`),
      c('noise', actor),
    ],
    correctClueIds: ['change', 'now', 'ask'],
    operationChoices: operationChoices(gaveAway ? 'add' : 'sub', gaveAway ? `${now} + ${change}` : `${now} - ${change}`, [
      gaveAway ? `${now} - ${change}` : `${now} + ${change}`,
      `${change} + ${change}`,
    ]),
    operationAnswer: gaveAway ? 'add' : 'sub',
    answerChoices: numberChoices(answer, thing.unit, 0, 30, [now, now + change]),
    answer: String(answer),
    explanation: gaveAway
      ? `送出后剩 ${now} ${thing.unit}，原来要加回送出的 ${change} ${thing.unit}，${now} + ${change} = ${answer}。`
      : `又得到后有 ${now} ${thing.unit}，原来要减掉后来得到的 ${change} ${thing.unit}，${now} - ${change} = ${answer}。`,
  }
}

function detectivePairChange(id: number): DetectiveQuestion {
  const thing = pick(things)
  const [p1, p2] = shuffle(people).slice(0, 2)
  const a = rand(4, 12)
  const b = rand(3, 10)
  const used = rand(2, Math.min(8, a + b - 3))
  const answer = a + b - used
  return {
    id: `d-pair-change-${id}-${a}-${b}-${used}`,
    kind: 'detective',
    title: '先合再减',
    prompt: `${p1}有 ${a} ${thing.unit}${thing.name}，${p2}有 ${b} ${thing.unit}。两人合在一起后用掉 ${used} ${thing.unit}，还剩几${thing.unit}${thing.name}？`,
    hint: '先把两个人的合起来，再减掉用掉的。',
    clues: [
      c('first', `${p1}有 ${a} ${thing.unit}`),
      c('second', `${p2}有 ${b} ${thing.unit}`),
      c('used', `用掉 ${used} ${thing.unit}`),
      c('ask', `问还剩几${thing.unit}`),
    ],
    correctClueIds: ['first', 'second', 'used', 'ask'],
    operationChoices: operationChoices('seq', `${a} + ${b} - ${used}`, [
      `${a} + ${b} + ${used}`,
      `${Math.max(a, b)} - ${Math.min(a, b)}`,
    ]),
    operationAnswer: 'seq',
    answerChoices: numberChoices(answer, thing.unit, 0, 35, [a + b, a + b + used]),
    answer: String(answer),
    explanation: `先合起来：${a} + ${b} = ${a + b}，再用掉 ${used}，${a + b} - ${used} = ${answer}。`,
  }
}

function detectiveRepeated(id: number): DetectiveQuestion {
  const thing = pick(things)
  const groupCount = pick([2, 3, 4])
  const each = rand(2, 6)
  const answer = groupCount * each
  const owner = pick([MATH_TEACHER_NAME, CHINESE_TEACHER_NAME, '班长', PLAYER_NAME])
  return {
    id: `d-repeated-${id}-${groupCount}-${each}`,
    kind: 'detective',
    title: '每份一样多',
    prompt: `${owner}准备了 ${groupCount} 份${thing.name}，每份有 ${each} ${thing.unit}。一共有几${thing.unit}${thing.name}？`,
    hint: '每份一样多，可以用连加来算。',
    clues: [
      c('groups', `有 ${groupCount} 份`),
      c('each', `每份 ${each} ${thing.unit}`),
      c('ask', `问一共几${thing.unit}`),
      c('noise', owner),
    ],
    correctClueIds: ['groups', 'each', 'ask'],
    operationChoices: operationChoices('repeat', Array.from({ length: groupCount }, () => each).join(' + '), [
      `${groupCount} + ${each}`,
      `${Math.max(groupCount, each)} - ${Math.min(groupCount, each)}`,
    ]),
    operationAnswer: 'repeat',
    answerChoices: numberChoices(answer, thing.unit, 0, 30, [groupCount + each, answer + each]),
    answer: String(answer),
    explanation: `${groupCount} 份，每份 ${each} ${thing.unit}，连加是 ${Array.from({ length: groupCount }, () => each).join(' + ')} = ${answer}。`,
  }
}

function detectiveIrrelevant(id: number): DetectiveQuestion {
  const main = pick(things)
  const noise = pick(things.filter((item) => item.name !== main.name))
  const start = rand(10, 24)
  const other = rand(3, 12)
  const away = rand(2, start - 3)
  const answer = start - away
  const actor = pick([MATH_TEACHER_NAME, CHINESE_TEACHER_NAME, '班长', `小店老板${PLAYER_NAME}`])
  return {
    id: `d-irrelevant-${id}-${start}-${other}-${away}`,
    kind: 'detective',
    title: '找有用信息',
    prompt: `${actor}有 ${start} ${main.unit}${main.name}，还有 ${other} ${noise.unit}${noise.name}。${actor}把${main.name}发出去 ${away} ${main.unit}，还剩几${main.unit}${main.name}？`,
    hint: `${noise.name}不是这题要问的东西，先放一边。`,
    clues: [
      c('main', `${main.name}有 ${start} ${main.unit}`),
      c('noise', `${noise.name}有 ${other} ${noise.unit}`),
      c('away', `${main.name}发出 ${away} ${main.unit}`),
      c('ask', `问${main.name}还剩几${main.unit}`),
    ],
    correctClueIds: ['main', 'away', 'ask'],
    operationChoices: operationChoices('sub', `${start} - ${away}`, [
      `${start} + ${other}`,
      `${start} + ${other} - ${away}`,
    ]),
    operationAnswer: 'sub',
    answerChoices: numberChoices(answer, main.unit, 0, 35, [start + other - away, start + other]),
    answer: String(answer),
    explanation: `这题问的是${main.name}，${noise.name}是干扰信息。${main.name}还剩 ${start} - ${away} = ${answer}。`,
  }
}

function detectiveAskOnePart(id: number): DetectiveQuestion {
  const thing = pick(things)
  const total = rand(12, 28)
  const known = rand(4, total - 4)
  const answer = total - known
  const [p1, p2] = shuffle(people).slice(0, 2)
  return {
    id: `d-one-part-${id}-${total}-${known}`,
    kind: 'detective',
    title: '知道总数求一部分',
    prompt: `${p1}和${p2}一共有 ${total} ${thing.unit}${thing.name}，其中${p1}有 ${known} ${thing.unit}。${p2}有几${thing.unit}${thing.name}？`,
    hint: '知道两个人一共多少，也知道其中一个，求另一个要用减法。',
    clues: [
      c('total', `一共 ${total} ${thing.unit}`),
      c('known', `${p1}有 ${known} ${thing.unit}`),
      c('ask', `问${p2}有几${thing.unit}`),
      c('noise', thing.name),
    ],
    correctClueIds: ['total', 'known', 'ask'],
    operationChoices: operationChoices('sub', `${total} - ${known}`, [
      `${total} + ${known}`,
      `${known} + ${known}`,
    ]),
    operationAnswer: 'sub',
    answerChoices: numberChoices(answer, thing.unit, 0, 35, [total + known, known]),
    answer: String(answer),
    explanation: `两人一共 ${total} ${thing.unit}，${p1}有 ${known} ${thing.unit}，${p2}有 ${total} - ${known} = ${answer}。`,
  }
}

const detectiveFactories = [
  detectiveTakeAway,
  detectiveJoin,
  detectiveCompare,
  detectiveMissing,
  detectiveLine,
  detectiveTwoStep,
  detectiveRelation,
  detectiveOriginal,
  detectivePairChange,
  detectiveRepeated,
  detectiveIrrelevant,
  detectiveAskOnePart,
]

function chooseShopItems(count: number): ShopItem[] {
  return shuffle(shopCatalog).slice(0, count)
}

function shopTotal(id: number): ShopQuestion {
  const [a, b] = chooseShopItems(2)
  const buyer = pick(buyerNames)
  const place = pick(shopPlaces)
  const answer = a.price + b.price
  return {
    id: `s-total-${id}-${a.name}-${b.name}`,
    kind: 'shop',
    title: '买两样',
    budget: Math.max(20, answer + pick([5, 8, 10])),
    budgetLabel: `${buyer}带了`,
    items: [a, b],
    task: `${buyer}买 1 个${a.name}和 1 个${b.name}，一共要几元几角？`,
    focus: 'total',
    prompt: `${buyer}来到${place}。`,
    hint: '买两样东西，一共多少钱，要把两个价格加起来。',
    answerChoices: moneyChoices(answer, [Math.abs(a.price - b.price), answer + 2]),
    answer: String(answer),
    explanation: `${a.name} ${formatMoney(a.price)}，${b.name} ${formatMoney(b.price)}，一共 ${moneyExpr(a.price, '+', b.price, answer)}。`,
  }
}

function shopTwoSame(id: number): ShopQuestion {
  const item = pick(shopCatalog.filter((x) => x.price <= 10))
  const buyer = pick(buyerNames)
  const count = pick([2, 3])
  const answer = item.price * count
  return {
    id: `s-same-${id}-${item.name}-${count}`,
    kind: 'shop',
    title: '买几个一样的',
    budget: Math.max(20, answer + 5),
    budgetLabel: `${buyer}带了`,
    items: [item],
    task: `${buyer}买 ${count} 个${item.name}，一共要几元几角？`,
    focus: 'total',
    prompt: `${buyer}想多买几个。`,
    hint: `${count} 个一样的，可以连加：${Array.from({ length: count }, () => formatMoney(item.price)).join(' + ')}。`,
    answerChoices: moneyChoices(answer, [item.price + count, item.price * (count + 1)]),
    answer: String(answer),
    explanation: `每个 ${formatMoney(item.price)}，买 ${count} 个，一共 ${formatMoney(answer)}。`,
  }
}

function shopChange(id: number): ShopQuestion {
  const [a, b] = chooseShopItems(2)
  const buyer = pick(buyerNames)
  const total = a.price + b.price
  const budget = pick([20, 30, 50].filter((value) => value > total))
  const answer = budget - total
  return {
    id: `s-change-${id}-${budget}-${a.name}-${b.name}`,
    kind: 'shop',
    title: '该找几元',
    budget,
    budgetLabel: `${buyer}付了`,
    items: [a, b],
    task: `${buyer}买${a.name}和${b.name}，付 ${formatMoney(budget)}，应找回几元几角？`,
    focus: 'change',
    prompt: '收银员在等着算找零。',
    hint: '先算花了多少，再用付的钱减掉花的钱。',
    answerChoices: moneyChoices(answer, [total, budget - a.price, budget - b.price]),
    answer: String(answer),
    explanation: `先算花了 ${moneyExpr(a.price, '+', b.price, total)}，再算 ${moneyExpr(budget, '-', total, answer)}。`,
  }
}

function shopBossChange(id: number): ShopQuestion {
  const [a, b] = chooseShopItems(2)
  const customer = pick(buyerNames.filter((name) => name !== PLAYER_NAME))
  const total = a.price + b.price
  const paid = pick([20, 30, 50].filter((value) => value > total))
  const answer = paid - total
  return {
    id: `s-boss-change-${id}-${paid}-${a.name}-${b.name}`,
    kind: 'shop',
    title: `${PLAYER_NAME}当老板`,
    budget: paid,
    budgetLabel: `${customer}付了`,
    items: [a, b],
    task: `${PLAYER_NAME}当老板，${customer}买${a.name}和${b.name}，给了 ${formatMoney(paid)}。${PLAYER_NAME}应该找给${customer}几元几角？`,
    focus: 'change',
    prompt: `今天${PLAYER_NAME}负责收钱找零。`,
    hint: '老板找零也是一样：先算顾客买东西花了多少，再用顾客给的钱减掉。',
    answerChoices: moneyChoices(answer, [total, paid - a.price, paid - b.price]),
    answer: String(answer),
    explanation: `${customer}买东西花了 ${moneyExpr(a.price, '+', b.price, total)}，给了 ${formatMoney(paid)}，${PLAYER_NAME}要找 ${moneyExpr(paid, '-', total, answer)}。`,
  }
}

function shopEnough(id: number): ShopQuestion {
  const [a, b] = chooseShopItems(2)
  const buyer = pick(buyerNames)
  const total = a.price + b.price
  const budget = total + pick([-2, -1, 0, 1, 3])
  const answer = budget >= total ? (budget === total ? 'just' : 'enough') : 'no'
  const diff = Math.abs(budget - total)
  const resultText =
    answer === 'just' ? '刚好够' : answer === 'enough' ? `够，还剩 ${formatMoney(diff)}` : `不够，差 ${formatMoney(diff)}`
  return {
    id: `s-enough-${id}-${budget}-${a.name}-${b.name}`,
    kind: 'shop',
    title: '钱够不够',
    budget,
    budgetLabel: `${buyer}有`,
    items: [a, b],
    task: `${buyer}想买${a.name}和${b.name}，${formatMoney(budget)}够不够？`,
    focus: 'enough',
    prompt: `${buyer}口袋里有 ${formatMoney(budget)}。`,
    hint: '先算两样一共多少钱，再和口袋里的钱比。',
    answerChoices: shuffle([
      c('enough', `够，还剩 ${formatMoney(Math.max(0.5, diff))}`),
      c('no', `不够，差 ${formatMoney(Math.max(0.5, diff))}`),
      c('just', '刚好够'),
    ]),
    answer,
    explanation: `${a.name}和${b.name}一共 ${moneyExpr(a.price, '+', b.price, total)}，${formatMoney(budget)}${resultText}。`,
  }
}

function shopCompare(id: number): ShopQuestion {
  const a = pick(shopCatalog)
  const b = pick(shopCatalog.filter((item) => item.price !== a.price))
  const expensive = a.price >= b.price ? a : b
  const cheap = a.price >= b.price ? b : a
  const answer = expensive.price - cheap.price
  return {
    id: `s-compare-${id}-${a.name}-${b.name}`,
    kind: 'shop',
    title: '哪个贵',
    budget: expensive.price,
    budgetLabel: '较贵的是',
    items: [a, b],
    task: `${expensive.name}比${cheap.name}贵几元几角？`,
    focus: 'compare',
    prompt: `${PLAYER_NAME}在比较两个东西的价格。`,
    hint: '问贵几元，用贵的价格减便宜的价格。',
    answerChoices: moneyChoices(answer, [expensive.price + cheap.price, cheap.price]),
    answer: String(answer),
    explanation: `${expensive.name} ${formatMoney(expensive.price)}，${cheap.name} ${formatMoney(cheap.price)}，贵 ${moneyExpr(expensive.price, '-', cheap.price, answer)}。`,
  }
}

function shopNeedMore(id: number): ShopQuestion {
  const item = pick(shopCatalog.filter((x) => x.price >= 5))
  const buyer = pick(buyerNames)
  const budget = rand(1, item.price - 1)
  const answer = item.price - budget
  return {
    id: `s-need-more-${id}-${item.name}-${budget}`,
    kind: 'shop',
    title: '还差多少钱',
    budget,
    budgetLabel: `${buyer}有`,
    items: [item],
    task: `${buyer}想买${item.name}，还差几元几角？`,
    focus: 'enough',
    prompt: `${buyer}有 ${formatMoney(budget)}，${item.name}卖 ${formatMoney(item.price)}。`,
    hint: '还差的钱 = 商品价格 - 已经有的钱。',
    answerChoices: moneyChoices(answer, [item.price + budget, budget]),
    answer: String(answer),
    explanation: `${item.name} ${formatMoney(item.price)}，${buyer}有 ${formatMoney(budget)}，还差 ${moneyExpr(item.price, '-', budget, answer)}。`,
  }
}

function shopAfterCanBuy(id: number): ShopQuestion {
  const [first, second] = chooseShopItems(2)
  const budget = first.price + second.price + pick([-2, -1, 0, 2, 4])
  const left = budget - first.price
  const answer = left >= second.price ? (left === second.price ? 'just' : 'enough') : 'no'
  const diff = Math.abs(left - second.price)
  const resultText =
    answer === 'just' ? '刚好够' : answer === 'enough' ? `够，还剩 ${formatMoney(diff)}` : `不够，差 ${formatMoney(diff)}`
  return {
    id: `s-after-can-buy-${id}-${budget}-${first.name}-${second.name}`,
    kind: 'shop',
    title: '买完还够吗',
    budget,
    budgetLabel: `${PLAYER_NAME}有`,
    items: [first, second],
    task: `${PLAYER_NAME}先买${first.name}，剩下的钱还够买${second.name}吗？`,
    focus: 'enough',
    prompt: `${PLAYER_NAME}有 ${formatMoney(budget)}。`,
    hint: '先算买第一样后还剩多少，再和第二样的价格比。',
    answerChoices: shuffle([
      c('enough', `够，还剩 ${formatMoney(Math.max(0.5, diff))}`),
      c('no', `不够，差 ${formatMoney(Math.max(0.5, diff))}`),
      c('just', '刚好够'),
    ]),
    answer,
    explanation: `先买${first.name}后还剩 ${moneyExpr(budget, '-', first.price, left)}，${second.name} ${formatMoney(second.price)}，${resultText}。`,
  }
}

function shopBossTwoOrders(id: number): ShopQuestion {
  const [a, b] = chooseShopItems(2)
  const firstCustomer = randomClassmate()
  const secondCustomer = randomClassmate()
  const answer = a.price + b.price
  return {
    id: `s-two-orders-${id}-${a.name}-${b.name}`,
    kind: 'shop',
    title: '老板收两单',
    budget: answer,
    budgetLabel: '一共收',
    items: [a, b],
    task: `${PLAYER_NAME}当老板，${firstCustomer}买了${a.name}，${secondCustomer}买了${b.name}。一共应收几元几角？`,
    focus: 'total',
    prompt: '今天要把两单加在一起。',
    hint: '两单一共多少钱，把两个商品价格加起来。',
    answerChoices: moneyChoices(answer, [Math.abs(a.price - b.price), answer + 5]),
    answer: String(answer),
    explanation: `${firstCustomer}这一单 ${formatMoney(a.price)}，${secondCustomer}这一单 ${formatMoney(b.price)}，一共 ${moneyExpr(a.price, '+', b.price, answer)}。`,
  }
}

const shopFactories = [
  shopTotal,
  shopTwoSame,
  shopChange,
  shopBossChange,
  shopEnough,
  shopCompare,
  shopNeedMore,
  shopAfterCanBuy,
  shopBossTwoOrders,
]

function makeDetectiveQuestion(id: number): DetectiveQuestion {
  return detectiveFactories[id % detectiveFactories.length](id)
}

function makeShopQuestion(id: number): ShopQuestion {
  return shopFactories[id % shopFactories.length](id)
}

export function buildQuestions(mode: TownMode, count: number): TownQuestion[] {
  const questions = Array.from({ length: count }, (_, idx) => {
    if (mode === 'detective') return makeDetectiveQuestion(idx)
    if (mode === 'shop') return makeShopQuestion(idx)
    if (mode === 'vertical') return verticalQuestion(idx)
    if (idx > 0 && idx % 5 === 4) return verticalQuestion(idx)
    if (idx > 0 && idx % 6 === 5) return sparkQuestion(idx)
    return idx % 2 === 0 ? makeDetectiveQuestion(idx) : makeShopQuestion(idx)
  })

  return shuffle(questions)
}
