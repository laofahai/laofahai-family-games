import type { BattleQuestion } from '../core'

export const items: BattleQuestion[] = [
  // ===== 借东西不还 =====
  {
    id: 'high-social-001',
    subject: 'social',
    prompt: '你借给同桌的笔，过了一周他还没还，每次问他都说“忘带了”。最聪明又不伤感情的做法是？',
    choices: [
      { id: 'a', text: '当众喊“你又赖账”，让大家都听见' },
      { id: 'b', text: '笑着说“明天记得带哈，我画画要用，给你设个闹钟提醒？”' },
      { id: 'c', text: '从此再也不理他' },
    ],
    answer: 'b',
    explanation: '给个具体时间点和理由，再帮他“记住”，既要回了东西又没撕破脸。',
  },
  {
    id: 'high-social-002',
    subject: 'social',
    prompt: '同学想借你刚买的新书，可你还没看完。怎么回应最得体？',
    choices: [
      { id: 'a', text: '“不借，自己买去”' },
      { id: 'b', text: '“我先看完，周五给你，行不行？”' },
      { id: 'c', text: '勉强借了，心里却一直生气' },
    ],
    answer: 'b',
    explanation: '不必硬撑着借出去，说清自己的安排、再给个时间，是真诚也是边界。',
  },
  {
    id: 'high-social-003',
    subject: 'social',
    prompt: '你总借东西忘了还，朋友有点不高兴了。最负责的做法是？',
    choices: [
      { id: 'a', text: '说“多大点事，至于吗”' },
      { id: 'b', text: '主动说“对不起拖太久了”，并立刻还回去' },
      { id: 'c', text: '装作没这回事' },
    ],
    answer: 'b',
    explanation: '借了要还、错了要认，主动归还比一百句解释都管用。',
  },
  // ===== 排队插队 =====
  {
    id: 'high-social-004',
    subject: 'social',
    prompt: '排队打饭时，有人直接插到你前面。怎么提醒最机智、不吵架？',
    choices: [
      { id: 'a', text: '一把把他推开' },
      { id: 'b', text: '微笑提醒“后面排队哦，我也等好一会儿啦”' },
      { id: 'c', text: '什么都不说，憋着生气' },
    ],
    answer: 'b',
    explanation: '语气友好但立场清楚，多数人被礼貌点到都会不好意思地排回去。',
  },
  {
    id: 'high-social-005',
    subject: 'social',
    prompt: '低年级小同学不懂事插了队。比较好的处理是？',
    choices: [
      { id: 'a', text: '凶他一顿让他长记性' },
      { id: 'b', text: '蹲下来轻声说“小朋友，我们要从后面排队哦”' },
      { id: 'c', text: '推他出去' },
    ],
    answer: 'b',
    explanation: '对更小的孩子，耐心解释规则比凶巴巴更有用，也是大哥哥大姐姐的样子。',
  },
  {
    id: 'high-social-006',
    subject: 'social',
    prompt: '朋友招手让你“来我这儿插个队”，可后面还有很多人在等。你怎么做最妥当？',
    choices: [
      { id: 'a', text: '赶紧钻过去，反正有人罩着' },
      { id: 'b', text: '说“谢啦，我还是去后面排，不然别人该有意见了”' },
      { id: 'c', text: '骂朋友多管闲事' },
    ],
    answer: 'b',
    explanation: '不占这个便宜既公平又顾全别人，还能婉拒得让朋友不尴尬。',
  },
  // ===== 分组 =====
  {
    id: 'high-social-007',
    subject: 'social',
    prompt: '分组时有个同学没人愿意带，被晾在一边。最善意的做法是？',
    choices: [
      { id: 'a', text: '跟着大家一起躲开他' },
      { id: 'b', text: '主动说“来我们组吧，正好缺个人”' },
      { id: 'c', text: '假装没看见' },
    ],
    answer: 'b',
    explanation: '一句邀请就能让一个人不被孤立，这是真正的善良和勇气。',
  },
  {
    id: 'high-social-008',
    subject: 'social',
    prompt: '你想和最好的朋友同一组，但老师已经分好了别的组。怎么应对最成熟？',
    choices: [
      { id: 'a', text: '赌气不参与活动' },
      { id: 'b', text: '接受安排，跟新组员好好合作，课后再约朋友玩' },
      { id: 'c', text: '一直缠着老师非要换组' },
    ],
    answer: 'b',
    explanation: '不是所有事都能如愿，能跟不熟的人也合作得来，是很厉害的能力。',
  },
  {
    id: 'high-social-009',
    subject: 'social',
    prompt: '小组里有个同学总不出力，光想拿大家的成果。怎么处理比较聪明？',
    choices: [
      { id: 'a', text: '当面骂他懒鬼' },
      { id: 'b', text: '私下问他“你想负责哪部分？画画还是查资料？”给他具体任务' },
      { id: 'c', text: '什么都自己扛，心里默默记仇' },
    ],
    answer: 'b',
    explanation: '给一个明确又好上手的任务，比指责更能让人真正动起来。',
  },
  // ===== 值日 =====
  {
    id: 'high-social-010',
    subject: 'social',
    prompt: '今天轮到你和另一个同学值日，他却偷偷溜走了。最得体的做法是？',
    choices: [
      { id: 'a', text: '也跟着不扫了，谁怕谁' },
      { id: 'b', text: '先把自己那份做完，明天提醒他“今天我替你顶了，下次到你哦”' },
      { id: 'c', text: '马上去老师那儿告状，添油加醋' },
    ],
    answer: 'b',
    explanation: '该做的先做好，再温和地把约定挑明，比直接告状更显风度也更有效。',
  },
  {
    id: 'high-social-011',
    subject: 'social',
    prompt: '你值日时不小心把垃圾桶碰倒了，撒了一地。最该做的是？',
    choices: [
      { id: 'a', text: '趁没人看见赶紧溜' },
      { id: 'b', text: '自己收拾干净，需要帮忙就喊一声同学' },
      { id: 'c', text: '怪是垃圾桶放得不对' },
    ],
    answer: 'b',
    explanation: '自己弄的自己收拾，必要时请人帮忙——担责任不丢人，逃避才丢人。',
  },
  {
    id: 'high-social-012',
    subject: 'social',
    prompt: '值日搭档干得很认真，把活儿都揽了，连你的那份也做了。你最好怎么说？',
    choices: [
      { id: 'a', text: '“正好，省我事了”就走人' },
      { id: 'b', text: '“谢谢你！剩下的我来，下次我请你喝牛奶”' },
      { id: 'c', text: '什么都不说，下次还指望他' },
    ],
    answer: 'b',
    explanation: '别人的好意要看见、要道谢，再把活儿接回来，合作才长久。',
  },
  // ===== 闹别扭和好 =====
  {
    id: 'high-social-013',
    subject: 'social',
    prompt: '你和好朋友吵架了，三天没说话，但你其实挺想和好。最勇敢的一步是？',
    choices: [
      { id: 'a', text: '一直等对方先开口' },
      { id: 'b', text: '主动发个消息“那天我也有不对，我们还是好朋友吧”' },
      { id: 'c', text: '到处说他的坏话出气' },
    ],
    answer: 'b',
    explanation: '先迈一步道歉不是认输，而是更看重这段友谊——这需要勇气。',
  },
  {
    id: 'high-social-014',
    subject: 'social',
    prompt: '朋友来跟你道歉，可你还有点气。怎么回应最大气？',
    choices: [
      { id: 'a', text: '“晚了，我不想理你”' },
      { id: 'b', text: '“没事啦，我也有不对，过去就过去了”' },
      { id: 'c', text: '冷冷地“哦”一声' },
    ],
    answer: 'b',
    explanation: '别人鼓起勇气道歉时，给个台阶接住，是一种温柔的强大。',
  },
  {
    id: 'high-social-015',
    subject: 'social',
    prompt: '两个好朋友因为误会闹翻，都来找你诉苦。你最该做的是？',
    choices: [
      { id: 'a', text: '选一边站，帮一个去骂另一个' },
      { id: 'b', text: '两边都听听，帮他们把误会说清楚，劝他们当面谈' },
      { id: 'c', text: '把两人说的话互相传，越传越乱' },
    ],
    answer: 'b',
    explanation: '当“和事佬”要公正、要传真话，目标是化解误会而不是火上浇油。',
  },
  // ===== 拌嘴机智回应 =====
  {
    id: 'high-social-016',
    subject: 'social',
    prompt: '同学开玩笑说“你今天发型像被雷劈过”。既不生气又能漂亮回击的是？',
    choices: [
      { id: 'a', text: '“你才像，你全家都像”' },
      { id: 'b', text: '哈哈一笑“那我可是有电的人，离我远点哦”' },
      { id: 'c', text: '当场哭出来' },
    ],
    answer: 'b',
    explanation: '把玩笑接住再幽默地抛回去，既化解尴尬又显得自信，谁都不受伤。',
  },
  {
    id: 'high-social-017',
    subject: 'social',
    prompt: '有人故意激你“就你那分数也敢说会做题？”最聪明的回应是？',
    choices: [
      { id: 'a', text: '“关你什么事”然后扭头就走' },
      { id: 'b', text: '平静地说“这题我确实会，要不我讲给你听？”' },
      { id: 'c', text: '气得把卷子撕了' },
    ],
    answer: 'b',
    explanation: '用实力和善意回应挑衅，比对骂更有底气，对方往往就没词了。',
  },
  {
    id: 'high-social-018',
    subject: 'social',
    prompt: '同学拌嘴时说了句过分的话，你看出他其实是嘴硬。最成熟的做法是？',
    choices: [
      { id: 'a', text: '马上回敬一句更狠的' },
      { id: 'b', text: '深呼吸一下，说“你是不是今天有啥不开心？我们别吵了”' },
      { id: 'c', text: '记仇等机会报复' },
    ],
    answer: 'b',
    explanation: '看穿对方的情绪、先停下争吵，常常能把一场火药味变成关心。',
  },
  {
    id: 'high-social-019',
    subject: 'social',
    prompt: '小组讨论时你和同学意见不合，争得脸红脖子粗。怎么收场最好？',
    choices: [
      { id: 'a', text: '谁声音大谁说了算' },
      { id: 'b', text: '说“我们各有道理，要不两个方案都列出来，让大家投票”' },
      { id: 'c', text: '直接退出不干了' },
    ],
    answer: 'b',
    explanation: '意见不同很正常，把分歧交给规则（比如投票）来定，比吵赢更服众。',
  },
  // ===== 综合·相处之道 =====
  {
    id: 'high-social-020',
    subject: 'social',
    prompt: '你不小心听到同学在背后议论你的缺点。最聪明的态度是？',
    choices: [
      { id: 'a', text: '冲过去大吵一架' },
      { id: 'b', text: '先想想有没有道理，有则改之，没必要的话就一笑而过' },
      { id: 'c', text: '也偷偷去说他坏话' },
    ],
    answer: 'b',
    explanation: '别人的话当镜子用：有用的留下，没用的放下，不必为闲话伤了自己。',
  },
  {
    id: 'high-social-021',
    subject: 'social',
    prompt: '新转来的同学一个人吃饭、不太敢说话。你能做的最暖的事是？',
    choices: [
      { id: 'a', text: '觉得跟自己没关系' },
      { id: 'b', text: '主动坐过去“嗨，我叫……要不要一起吃？”' },
      { id: 'c', text: '远远地观察他' },
    ],
    answer: 'b',
    explanation: '一句主动的招呼，可能就是别人在新环境里收到的第一份温暖。',
  },
  {
    id: 'high-social-022',
    subject: 'social',
    prompt: '同学考砸了很难过，跑来跟你哭。最贴心的回应是？',
    choices: [
      { id: 'a', text: '“我早说你不努力吧”' },
      { id: 'b', text: '先陪着听他说，再说“这次没考好没关系，下次一起加油”' },
      { id: 'c', text: '“别哭了，烦不烦”' },
    ],
    answer: 'b',
    explanation: '难过的人最需要的是被听见和被鼓励，而不是被评判。',
  },
]
