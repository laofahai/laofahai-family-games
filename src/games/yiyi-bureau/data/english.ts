import { PLAYER } from './people'
import { freshPick, mate, numChoices, pick, rand, shuffle, textChoices, type Maker } from './_shared'

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

export const ENGLISH_MAKERS: Maker[] = [enNotice, enEmail, enShopping, enSchedule, enPassage]

// 单独导出供组卷 PREVIEW_MAKERS 复用
export { enPassage }
