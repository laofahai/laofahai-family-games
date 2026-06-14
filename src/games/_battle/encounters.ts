// 社交遭遇（同学小怪用）：遇到同学不一定是答题，更多是社交互动——
// 损两句 / 忽悠 / 撒娇 / 套近乎(好朋友) / 给点小零食 / 唠生活小事……
// 选一个回应，同学有不同反应：win=搞定他(让路/成同伴) fail=没搞定(被挡) funny=搞笑。
// 战斗里：win 给敌人造成伤害/直接过；fail 自己受点挫；funny 轻松过场。
// 只用相对/类型导入（叶子数据文件）。⚠️ 内容 agent 会扩充，但保持导出签名不变。

import type { Band } from './core'

export type Outcome = 'win' | 'fail' | 'funny'

export interface EncounterOption {
  id: string
  text: string // 玩家的回应，如「我们是好朋友嘛~」「分你点小零食🍬」
  outcome: Outcome
  reply: string // 同学的反应，如「哈哈行吧，你过吧」
}

export interface Encounter {
  id: string
  band: Band
  prompt: string // 情景，如「同学叉着腰挡在路中间」
  options: EncounterOption[] // 2~4 个回应，至少一个 win
}

// —— 社交遭遇内容库 ——
const BANK: Record<Band, Encounter[]> = {
  // ===== low：一二年级（6-8 岁），简单、天真、口语 =====
  low: [
    {
      id: 'l-enc-001',
      band: 'low',
      prompt: '同学挡在路中间，想跟你比谁跑得快。',
      options: [
        { id: 'a', text: '「我们一起跑，谁赢都鼓掌！」', outcome: 'win', reply: '好呀好呀，冲鸭！' },
        { id: 'b', text: '「让开啦，别挡路！」', outcome: 'fail', reply: '哼，凭什么。' },
        { id: 'c', text: '「我先系个鞋带…其实我没穿鞋带」', outcome: 'funny', reply: '噗，你好怪哦哈哈。' },
      ],
    },
    {
      id: 'l-enc-002',
      band: 'low',
      prompt: '同学的橡皮掉地上了，他正趴着找。',
      options: [
        { id: 'a', text: '帮他一起捡起来递过去', outcome: 'win', reply: '谢谢你！你人真好~' },
        { id: 'b', text: '假装没看见走过去', outcome: 'fail', reply: '哼，不理你了。' },
        { id: 'c', text: '「我帮你找！」结果踩到了橡皮', outcome: 'funny', reply: '啊——它被你踩扁啦哈哈！' },
      ],
    },
    {
      id: 'l-enc-003',
      band: 'low',
      prompt: '同学举着半块饼干：「你想吃吗？」',
      options: [
        { id: 'a', text: '「谢谢！我也分你一颗糖🍬」', outcome: 'win', reply: '嘿嘿，我们换着吃，好朋友！' },
        { id: 'b', text: '一把抢过来塞嘴里', outcome: 'fail', reply: '喂！那是我的呀！' },
      ],
    },
    {
      id: 'l-enc-004',
      band: 'low',
      prompt: '同学嘟着嘴：「你昨天没跟我玩滑梯。」',
      options: [
        { id: 'a', text: '「对不起嘛，今天我们一起玩！」', outcome: 'win', reply: '好！那拉钩钩~' },
        { id: 'b', text: '「滑梯又不是你家的。」', outcome: 'fail', reply: '哼，我才不跟你玩。' },
        { id: 'c', text: '「因为我变成乌龟啦，爬得超级慢」', outcome: 'funny', reply: '噗，乌龟也要一起玩呀哈哈！' },
      ],
    },
    {
      id: 'l-enc-005',
      band: 'low',
      prompt: '同学神秘兮兮：「我会一个超厉害的魔术，你信不信？」',
      options: [
        { id: 'a', text: '「哇好厉害！快给我看看！」', outcome: 'win', reply: '嘿嘿，那你跟我来~' },
        { id: 'b', text: '「假的，你骗人。」', outcome: 'fail', reply: '哼，不给你看了。' },
        { id: 'c', text: '「我也会！我能把鼻涕变没！」', outcome: 'funny', reply: '哈哈哈那是擤掉了吧！' },
      ],
    },
    {
      id: 'l-enc-006',
      band: 'low',
      prompt: '同学摔了一跤坐在地上，眼睛红红的快哭了。',
      options: [
        { id: 'a', text: '「我拉你起来，吹吹就不疼啦」', outcome: 'win', reply: '呜…谢谢你，我们一起走。' },
        { id: 'b', text: '「哈哈你摔屁股啦！」', outcome: 'fail', reply: '哇——你坏！' },
      ],
    },
    {
      id: 'l-enc-007',
      band: 'low',
      prompt: '同学骄傲地说：「我今天会自己系鞋带了！」',
      options: [
        { id: 'a', text: '「哇你好棒！给你鼓掌！」', outcome: 'win', reply: '嘿嘿，我教你呀！' },
        { id: 'b', text: '「这有什么，我早就会了。」', outcome: 'fail', reply: '哼，没劲。' },
        { id: 'c', text: '「我会系成蝴蝶结，还会飞那种！」', outcome: 'funny', reply: '蝴蝶结哪会飞呀哈哈！' },
      ],
    },
    {
      id: 'l-enc-008',
      band: 'low',
      prompt: '同学拿着画：「你看我画的恐龙好不好？」',
      options: [
        { id: 'a', text: '「好看！它的牙齿好酷呀！」', outcome: 'win', reply: '嘻嘻，送给你啦！' },
        { id: 'b', text: '「画得好丑哦。」', outcome: 'fail', reply: '哼，你才丑。' },
      ],
    },
    {
      id: 'l-enc-009',
      band: 'low',
      prompt: '同学跳到你面前：「我们来玩石头剪刀布！」',
      options: [
        { id: 'a', text: '「来呀！输了喊对方大王！」', outcome: 'win', reply: '哈哈好，三局两胜！' },
        { id: 'b', text: '「不玩，幼稚。」', outcome: 'fail', reply: '小气鬼~' },
        { id: 'c', text: '出了个「石头剪刀布」全都出', outcome: 'funny', reply: '你三个一起出是犯规呀哈哈！' },
      ],
    },
    {
      id: 'l-enc-010',
      band: 'low',
      prompt: '同学小声说：「我的牙掉了一颗，你看～」',
      options: [
        { id: 'a', text: '「哇你要换大牙啦，好厉害！」', outcome: 'win', reply: '嘿嘿，我变小兔子啦！' },
        { id: 'b', text: '「好恶心，走开。」', outcome: 'fail', reply: '哼，不给你看了。' },
      ],
    },
    {
      id: 'l-enc-011',
      band: 'low',
      prompt: '同学举着小水壶：「我忘带水了，渴死啦…」',
      options: [
        { id: 'a', text: '「喝我的吧，我们轮流喝！」', outcome: 'win', reply: '谢谢你，你最好啦！' },
        { id: 'b', text: '「谁让你忘带的。」', outcome: 'fail', reply: '哼，不理你。' },
      ],
    },
    {
      id: 'l-enc-012',
      band: 'low',
      prompt: '同学神气地挡路：「叫我一声班长我就让开！」',
      options: [
        { id: 'a', text: '「班长好！请让一让~」', outcome: 'win', reply: '哈哈乖，过去吧！' },
        { id: 'b', text: '「你又不是真班长。」', outcome: 'fail', reply: '哼，就不让。' },
        { id: 'c', text: '「宇宙超级无敌大班长好！」', outcome: 'funny', reply: '噗哈哈，太夸张啦，过吧过吧！' },
      ],
    },
    {
      id: 'l-enc-013',
      band: 'low',
      prompt: '同学手里抓着一只小瓢虫：「你怕不怕虫子？」',
      options: [
        { id: 'a', text: '「不怕呀，它好可爱，我们放它飞吧」', outcome: 'win', reply: '好！拜拜小瓢虫~' },
        { id: 'b', text: '「啊啊啊拿走！」吓得跑开', outcome: 'fail', reply: '哈哈胆小鬼！' },
      ],
    },
    {
      id: 'l-enc-014',
      band: 'low',
      prompt: '同学拉住你：「我们交换贴纸好不好？」',
      options: [
        { id: 'a', text: '「好呀！我这张闪闪的给你」', outcome: 'win', reply: '哇谢谢！我们是好朋友啦！' },
        { id: 'b', text: '「我的都不给你。」', outcome: 'fail', reply: '小气！哼。' },
      ],
    },
    {
      id: 'l-enc-015',
      band: 'low',
      prompt: '同学鼓着腮帮子：「你刚才是不是笑我了？」',
      options: [
        { id: 'a', text: '「没有啦，我是笑那只小狗，抱抱~」', outcome: 'win', reply: '哦…那好吧，抱一个！' },
        { id: 'b', text: '「就笑你了怎么样。」', outcome: 'fail', reply: '哇你坏！我要告老师！' },
      ],
    },
    {
      id: 'l-enc-016',
      band: 'low',
      prompt: '同学举着两根棒棒糖：「我有两根，可是不知道给谁…」',
      options: [
        { id: 'a', text: '「那我们一人一根，边走边吃！」', outcome: 'win', reply: '好耶！你真聪明~' },
        { id: 'b', text: '「两根都给我！」', outcome: 'fail', reply: '才不要，你好贪心。' },
        { id: 'c', text: '「我帮你吃掉，你就不用烦啦」', outcome: 'funny', reply: '噗你想得美哈哈！' },
      ],
    },
    {
      id: 'l-enc-017',
      band: 'low',
      prompt: '同学蹲在地上看蚂蚁搬家，挡住了路。',
      options: [
        { id: 'a', text: '「我也看！蚂蚁好厉害呀」一起蹲下', outcome: 'win', reply: '嘻嘻，你也喜欢蚂蚁呀，走，带你看蚁窝！' },
        { id: 'b', text: '一脚想踩过去', outcome: 'fail', reply: '别踩别踩！你好凶！' },
      ],
    },
    {
      id: 'l-enc-018',
      band: 'low',
      prompt: '同学嘟嘴：「老师表扬你没表扬我…」',
      options: [
        { id: 'a', text: '「你今天也很棒呀，我都看见啦！」', outcome: 'win', reply: '真的吗…嘿嘿，谢谢你。' },
        { id: 'b', text: '「因为我比你乖呀。」', outcome: 'fail', reply: '哼！不跟你好了。' },
      ],
    },
    {
      id: 'l-enc-019',
      band: 'low',
      prompt: '同学拿着小汽车：「我的车没电了，你能帮我推吗？」',
      options: [
        { id: 'a', text: '「我来推！呜——出发！」', outcome: 'win', reply: '哈哈太好玩了，一起玩车车！' },
        { id: 'b', text: '「自己推去。」', outcome: 'fail', reply: '哼，小气鬼。' },
      ],
    },
    {
      id: 'l-enc-020',
      band: 'low',
      prompt: '同学神秘地说：「我知道一个秘密基地哦～你想去吗？」',
      options: [
        { id: 'a', text: '「想去想去！我们偷偷去！」', outcome: 'win', reply: '嘿嘿，跟我来，不许告诉别人！' },
        { id: 'b', text: '「假的，哪有什么基地。」', outcome: 'fail', reply: '哼，不带你去了。' },
        { id: 'c', text: '「是不是在大树后面？我也有一个！」', outcome: 'funny', reply: '哇被你猜到了哈哈，那是双倍基地！' },
      ],
    },
    {
      id: 'l-enc-021',
      band: 'low',
      prompt: '同学拽着你的衣角：「我有点怕黑，你能陪我走吗？」',
      options: [
        { id: 'a', text: '「能呀，我们手拉手就不怕啦」', outcome: 'win', reply: '嗯！有你在我就不怕了~' },
        { id: 'b', text: '「胆小鬼，我才不陪。」', outcome: 'fail', reply: '呜…你好坏。' },
      ],
    },
    {
      id: 'l-enc-022',
      band: 'low',
      prompt: '同学把帽子戴反了还不知道，挡在你面前。',
      options: [
        { id: 'a', text: '「你帽子戴反啦，我帮你转过来~」', outcome: 'win', reply: '咦，谢谢你！嘻嘻。' },
        { id: 'b', text: '「哈哈哈傻样！」笑个不停', outcome: 'fail', reply: '哼，笑什么笑！' },
        { id: 'c', text: '「酷！我也要把帽子戴反！」', outcome: 'funny', reply: '哈哈我们是反帽子兄弟！' },
      ],
    },
    {
      id: 'l-enc-023',
      band: 'low',
      prompt: '同学举着风车跑过来：「你看我的风车转得快不快？」',
      options: [
        { id: 'a', text: '「好快呀！我们去有风的地方比比！」', outcome: 'win', reply: '好耶，冲向操场~' },
        { id: 'b', text: '「我的更快，你的破破的。」', outcome: 'fail', reply: '哼，才不破！' },
      ],
    },
    {
      id: 'l-enc-024',
      band: 'low',
      prompt: '同学小声哭：「我找不到妈妈了…」',
      options: [
        { id: 'a', text: '「别怕，我陪你去找老师，会找到的！」', outcome: 'win', reply: '呜…嗯，谢谢你陪我。' },
        { id: 'b', text: '「那是你的事呀。」', outcome: 'fail', reply: '哇——你都不帮我！' },
      ],
    },
    {
      id: 'l-enc-025',
      band: 'low',
      prompt: '同学张开双臂挡路：「过路费！要讲一个笑话才行！」',
      options: [
        { id: 'a', text: '「为什么小鸟不上学？因为它已经会飞啦！」', outcome: 'win', reply: '哈哈哈好冷又好好笑，过吧！' },
        { id: 'b', text: '「我不会讲笑话。」', outcome: 'fail', reply: '不讲就不许过~' },
        { id: 'c', text: '做了个超丑的鬼脸', outcome: 'funny', reply: '噗哈哈哈你这张脸就是笑话！过吧！' },
      ],
    },
  ],

  // ===== high：六年级（11-13 岁），更机灵、会玩梗 =====
  high: [
    {
      id: 'h-enc-001',
      band: 'high',
      prompt: '同学叉着腰挡路：「想过去？先夸我三句！」',
      options: [
        { id: 'a', text: '「球打得好、字写得好、人还讲义气！」', outcome: 'win', reply: '哈哈算你会说，过吧过吧。' },
        { id: 'b', text: '「就你？我编不出来。」', outcome: 'fail', reply: '那你别过了。' },
        { id: 'c', text: '「你睫毛今天有 87 根，比昨天多 1 根。」', outcome: 'funny', reply: '你有病吧哈哈哈哈。' },
      ],
    },
    {
      id: 'h-enc-002',
      band: 'high',
      prompt: '同学一脸不爽：「上次你没等我一起走。」',
      options: [
        { id: 'a', text: '「对不起呀，下次一定等你，给你留了零食🍬」', outcome: 'win', reply: '…算你有良心，走吧。' },
        { id: 'b', text: '「关我什么事。」', outcome: 'fail', reply: '行，你厉害。' },
        { id: 'c', text: '「我等了，是你走太慢被我甩开了」', outcome: 'funny', reply: '?? 你还有理了哈哈哈滚吧。' },
      ],
    },
    {
      id: 'h-enc-003',
      band: 'high',
      prompt: '同学得意地拦住你：「猜猜我月考考了多少？」',
      options: [
        { id: 'a', text: '「看你这么嘚瑟，肯定进步了，请客啊！」', outcome: 'win', reply: '哈哈被你看穿了，走走走我请你。' },
        { id: 'b', text: '「不猜，没兴趣。」', outcome: 'fail', reply: '切，扫兴。' },
        { id: 'c', text: '「负分？卷子白给的那种？」', outcome: 'funny', reply: '你嘴怎么这么欠哈哈哈。' },
      ],
    },
    {
      id: 'h-enc-004',
      band: 'high',
      prompt: '同学故作神秘：「我跟你说个八卦，但你得先答应帮我个忙。」',
      options: [
        { id: 'a', text: '「行啊，你说啥忙，能帮一定帮。」', outcome: 'win', reply: '够意思！其实就是帮我占个座，走。' },
        { id: 'b', text: '「先说八卦，不然免谈。」', outcome: 'fail', reply: '那算了，不告诉你了。' },
      ],
    },
    {
      id: 'h-enc-005',
      band: 'high',
      prompt: '同学叹气：「这道题我研究半天还是不会，烦死了。」',
      options: [
        { id: 'a', text: '「我也卡这儿，我们一起琢磨琢磨？」', outcome: 'win', reply: '好兄弟，两个人总比一个人强。' },
        { id: 'b', text: '「这都不会，太菜了吧。」', outcome: 'fail', reply: '行，学霸您先请。' },
      ],
    },
    {
      id: 'h-enc-006',
      band: 'high',
      prompt: '同学把篮球往你怀里一塞：「三对三缺一个，你顶上！」',
      options: [
        { id: 'a', text: '「来就来，谁怕谁！」', outcome: 'win', reply: '这才对嘛，走，我们这队稳了！' },
        { id: 'b', text: '「我不会打，别找我。」', outcome: 'fail', reply: '啧，扫兴，那我换人了。' },
        { id: 'c', text: '「我专业的，上次进了个乌龙球」', outcome: 'funny', reply: '哈哈哈那还是别上了你！' },
      ],
    },
    {
      id: 'h-enc-007',
      band: 'high',
      prompt: '同学一脸坏笑：「听说你喜欢谁谁谁？」',
      options: [
        { id: 'a', text: '「我喜欢的是篮球和炸鸡，行了吧？」', outcome: 'win', reply: '哈哈哈滑头，算你会接，走吧。' },
        { id: 'b', text: '「你别瞎说！」脸一下红了', outcome: 'fail', reply: '嘿，看你这反应，有戏啊~' },
        { id: 'c', text: '「对，我喜欢的就是你，惊不惊喜」', outcome: 'funny', reply: '哇——鸡皮疙瘩起来了，你别恶心我哈哈。' },
      ],
    },
    {
      id: 'h-enc-008',
      band: 'high',
      prompt: '同学拦路：「想过？跟我比一道脑筋急转弯，赢了才放行。」',
      options: [
        { id: 'a', text: '「来啊，我脑筋转得比谁都快。」', outcome: 'win', reply: '行，有种，这把算你赢，过吧。' },
        { id: 'b', text: '「无聊，我不玩。」', outcome: 'fail', reply: '不玩就乖乖站这儿。' },
        { id: 'c', text: '「答案是『不知道』，因为没人知道」', outcome: 'funny', reply: '???你这是耍赖哈哈哈算了放你过。' },
      ],
    },
    {
      id: 'h-enc-009',
      band: 'high',
      prompt: '同学神情低落：「我刚被老师点名批评了，好丢人。」',
      options: [
        { id: 'a', text: '「没事，谁还没被点过名，过会儿就忘了。」', outcome: 'win', reply: '谢了哥们，舒服多了，一起走。' },
        { id: 'b', text: '「活该，谁让你不听话。」', outcome: 'fail', reply: '行，你最乖，自己玩去吧。' },
      ],
    },
    {
      id: 'h-enc-010',
      band: 'high',
      prompt: '同学举着手机：「快看这个视频，笑死我了！」',
      options: [
        { id: 'a', text: '「哈哈这个我也刷到了，太上头了！」', outcome: 'win', reply: '懂的都懂！咱俩频率一样，走！' },
        { id: 'b', text: '「上课别看手机，被抓了别怪我。」', outcome: 'fail', reply: '好好好，扫兴大王。' },
      ],
    },
    {
      id: 'h-enc-011',
      band: 'high',
      prompt: '同学拽住你：「帮我个忙，作业借我抄一下行不行？」',
      options: [
        { id: 'a', text: '「抄不行，但我可以给你讲，三分钟你就会。」', outcome: 'win', reply: '…你还挺负责，行，讲吧，谢了。' },
        { id: 'b', text: '「不行，别想。」转身就走', outcome: 'fail', reply: '切，小气，不借拉倒。' },
        { id: 'c', text: '「可以，但你得帮我背一节课的锅」', outcome: 'funny', reply: '哈哈哈这交易不划算，算了算了。' },
      ],
    },
    {
      id: 'h-enc-012',
      band: 'high',
      prompt: '同学得意洋洋：「我新买的鞋，限量款，羡慕不？」',
      options: [
        { id: 'a', text: '「确实好看，眼光可以啊，哪买的？」', outcome: 'win', reply: '嘿嘿识货，回头告诉你链接，走吧。' },
        { id: 'b', text: '「不就一双鞋，至于吗。」', outcome: 'fail', reply: '哼，没品位。' },
        { id: 'c', text: '「限量？我家狗的鞋都比这限量」', outcome: 'funny', reply: '你家狗还穿鞋?哈哈哈你赢了。' },
      ],
    },
    {
      id: 'h-enc-013',
      band: 'high',
      prompt: '同学挡路：「最近迷上一款游戏，但卡在一关了，你玩过吗？」',
      options: [
        { id: 'a', text: '「那关我会！晚上联机带你过。」', outcome: 'win', reply: '真的假的，太够意思了，加好友！' },
        { id: 'b', text: '「玩物丧志，少打点游戏。」', outcome: 'fail', reply: '行吧老学究，走开走开。' },
      ],
    },
    {
      id: 'h-enc-014',
      band: 'high',
      prompt: '同学凑过来：「下周运动会你报名了吗？我们组个队呗。」',
      options: [
        { id: 'a', text: '「组啊！咱俩接力，目标第一！」', outcome: 'win', reply: '就喜欢你这股劲儿，说定了！' },
        { id: 'b', text: '「我不参加，太累。」', outcome: 'fail', reply: '啧，没意思，那我找别人了。' },
      ],
    },
    {
      id: 'h-enc-015',
      band: 'high',
      prompt: '同学装出一副大佬样：「这条路是我罩的，留下买路财——一根辣条。」',
      options: [
        { id: 'a', text: '「给给给，大哥赏脸吃根辣条。」掏出辣条', outcome: 'win', reply: '哈哈哈识相，自己人，过吧过吧。' },
        { id: 'b', text: '「你算老几，让开。」', outcome: 'fail', reply: '哟，不给面子是吧，那站着别动。' },
        { id: 'c', text: '「辣条没了，给你颗薄荷糖压压惊？」', outcome: 'funny', reply: '薄荷糖?你打发要饭的呢哈哈哈，算了过吧。' },
      ],
    },
    {
      id: 'h-enc-016',
      band: 'high',
      prompt: '同学一脸郁闷：「我跟同桌闹掰了，烦。」',
      options: [
        { id: 'a', text: '「啥事啊，说出来听听，没准是误会。」', outcome: 'win', reply: '…你说得对，可能是我想多了，谢了。' },
        { id: 'b', text: '「那是你俩的事，跟我说干嘛。」', outcome: 'fail', reply: '行，当我没说。' },
      ],
    },
    {
      id: 'h-enc-017',
      band: 'high',
      prompt: '同学挡路：「我新学了个魔术，看穿了算你赢。」开始变扑克。',
      options: [
        { id: 'a', text: '「先不拆穿，给你点面子，挺溜啊！」', outcome: 'win', reply: '哈哈懂事，就喜欢有眼力见的，过！' },
        { id: 'b', text: '「这破手法我一眼就看穿了。」', outcome: 'fail', reply: '切，扫兴，那你也别想看下个。' },
        { id: 'c', text: '「你袖子里那张红桃K掉出来了」', outcome: 'funny', reply: '啊?!哈哈哈穿帮了穿帮了，丢人。' },
      ],
    },
    {
      id: 'h-enc-018',
      band: 'high',
      prompt: '同学问：「周末去不去打球？还差一个人。」',
      options: [
        { id: 'a', text: '「去！几点？我带瓶水给大家。」', outcome: 'win', reply: '爽快，就等你这句，定了！' },
        { id: 'b', text: '「再说吧，看心情。」', outcome: 'fail', reply: '行吧，你这态度，那当你不去了。' },
      ],
    },
    {
      id: 'h-enc-019',
      band: 'high',
      prompt: '同学拿着试卷凑过来：「这题我跟你答案不一样，谁对谁错？」',
      options: [
        { id: 'a', text: '「来对一下过程，错了的请喝奶茶。」', outcome: 'win', reply: '哈哈这个赌注我喜欢，开整！' },
        { id: 'b', text: '「肯定我对，你那答案一看就错。」', outcome: 'fail', reply: '哟，这么自信，万一是你错呢。' },
      ],
    },
    {
      id: 'h-enc-020',
      band: 'high',
      prompt: '同学神秘兮兮：「我藏了包好吃的，但只分给『自己人』。」',
      options: [
        { id: 'a', text: '「咱俩什么关系，必须自己人啊！」', outcome: 'win', reply: '哈哈会说话，给你一半，拿着。' },
        { id: 'b', text: '「不稀罕，留着自己吃吧。」', outcome: 'fail', reply: '行，那我可全吃了哦。' },
        { id: 'c', text: '「自己人？我都把你当亲哥了」', outcome: 'funny', reply: '打住打住，肉麻死了哈哈，给你给你。' },
      ],
    },
    {
      id: 'h-enc-021',
      band: 'high',
      prompt: '同学拦住你想斗嘴：「听说你跑步特慢？乌龟见了你都想超车。」',
      options: [
        { id: 'a', text: '「那是给你留面子，真跑你吃灰。」', outcome: 'win', reply: '哈哈哈嘴是真硬，行，改天操场见真章！' },
        { id: 'b', text: '「你才慢，你全家都慢。」', outcome: 'fail', reply: '哟，急了急了，开不起玩笑。' },
        { id: 'c', text: '「我是慢，但我是为了配合你的智商」', outcome: 'funny', reply: '哈哈哈哈你这嘴真的欠揍，服了。' },
      ],
    },
    {
      id: 'h-enc-022',
      band: 'high',
      prompt: '同学愁眉苦脸：「明天要上台演讲，我紧张到睡不着。」',
      options: [
        { id: 'a', text: '「我帮你听一遍稿子，给你提提意见？」', outcome: 'win', reply: '太感谢了，有你这朋友值了。' },
        { id: 'b', text: '「自己的事自己搞定。」', outcome: 'fail', reply: '行行行，打扰你了。' },
      ],
    },
    {
      id: 'h-enc-023',
      band: 'high',
      prompt: '同学一本正经地胡说：「告诉你个内幕，明天体育课改成全员睡觉课。」',
      options: [
        { id: 'a', text: '「哦？那我得准备好枕头，配合你演下去。」', outcome: 'win', reply: '哈哈哈就你接得住，会玩，过吧！' },
        { id: 'b', text: '「编，继续编，能不能上点心。」', outcome: 'fail', reply: '啧，跟你聊天没劲。' },
        { id: 'c', text: '「真的？！那我现在就去铺床」假装躺下', outcome: 'funny', reply: '哈哈哈哈别真躺啊，地上凉！' },
      ],
    },
    {
      id: 'h-enc-024',
      band: 'high',
      prompt: '同学小声说：「我偷偷带了游戏卡，要不要课间一起玩？」',
      options: [
        { id: 'a', text: '「玩可以，但下课玩、别影响上课，安全第一。」', outcome: 'win', reply: '懂分寸，就服你这种，约了！' },
        { id: 'b', text: '「带这个干嘛，被没收别哭。」', outcome: 'fail', reply: '好好好，你最守规矩，走开。' },
      ],
    },
    {
      id: 'h-enc-025',
      band: 'high',
      prompt: '同学摆出守门员姿势：「想过这条走廊？先跟我玩个梗接龙，接不上不准过。」',
      options: [
        { id: 'a', text: '「来啊，我梗多得是，看你能撑几个回合。」', outcome: 'win', reply: '哈哈哈旗鼓相当，痛快，放你过！' },
        { id: 'b', text: '「我不玩这些幼稚的。」', outcome: 'fail', reply: '不玩?那就别想过，站着吧。' },
        { id: 'c', text: '「我一开口你怕是要笑到扶墙」', outcome: 'funny', reply: '哈哈哈牛皮先吹上了，行，过吧过吧。' },
      ],
    },
  ],
}

function shuffle<T>(a: readonly T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

/** 抽 count 个社交遭遇（同学小怪用）。 */
export function drawEncounters(band: Band, count: number): Encounter[] {
  return shuffle(BANK[band]).slice(0, count)
}
