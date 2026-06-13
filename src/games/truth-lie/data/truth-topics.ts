import type { TruthTopic } from '../types'

/** 给想不出素材的人的话题提示，主角可以不用提示自由发挥 */
export const truthTopics: TruthTopic[] = [
  // ===== 童年回忆 =====
  { text: '你小时候干过的傻事', category: 'childhood', emoji: '🐣' },
  { text: '你小时候最喜欢的玩具', category: 'childhood', emoji: '🧸' },
  { text: '你小时候害怕的东西', category: 'childhood', emoji: '👻' },
  { text: '你小时候受过的伤或闯过的祸', category: 'childhood', emoji: '🩹' },
  { text: '你小时候的外号或别人对你的称呼', category: 'childhood', emoji: '🏷️' },
  { text: '你第一次做某件事的经历（第一次坐火车、第一次游泳……）', category: 'childhood', emoji: '1️⃣' },
  { text: '你小时候许过的愿望或梦想', category: 'childhood', emoji: '🌠' },
  { text: '你小时候偷偷干过、大人不知道的事', category: 'childhood', emoji: '🤫' },
  { text: '你小时候看过最多遍的动画片或电视剧', category: 'childhood', emoji: '📺' },
  { text: '你小时候和小伙伴玩过的游戏', category: 'childhood', emoji: '🪁' },
  { text: '你小时候被表扬或被批评最狠的一次', category: 'childhood', emoji: '🏅' },

  // ===== 学校与工作 =====
  { text: '你在学校/单位发生过的一件事', category: 'schoolWork', emoji: '🏫' },
  { text: '你最喜欢/最头疼的一门课或一项工作', category: 'schoolWork', emoji: '📚' },
  { text: '你的老师/同事里让你印象最深的人', category: 'schoolWork', emoji: '👩‍🏫' },
  { text: '你考试或工作里的高光时刻', category: 'schoolWork', emoji: '✨' },
  { text: '你上学/上班路上发生过的事', category: 'schoolWork', emoji: '🚌' },
  { text: '你在学校/单位食堂吃过的东西', category: 'schoolWork', emoji: '🍱' },
  { text: '你迟到、忘带东西或赶截止时间的经历', category: 'schoolWork', emoji: '⏰' },
  { text: '你在学校/单位拿过的奖励或称号', category: 'schoolWork', emoji: '🏆' },
  { text: '你的同学/同桌/工位邻居的趣事', category: 'schoolWork', emoji: '🪑' },
  { text: '你最近学会的一个新技能', category: 'schoolWork', emoji: '🛠️' },

  // ===== 吃吃喝喝 =====
  { text: '你最爱吃的三样东西里说两真一假', category: 'food', emoji: '😋' },
  { text: '你打死也不想再吃的东西', category: 'food', emoji: '🤢' },
  { text: '你一顿吃过最多的一次', category: 'food', emoji: '🍚' },
  { text: '你自己做过的黑暗料理或拿手菜', category: 'food', emoji: '👨‍🍳' },
  { text: '你吃过的最奇怪的东西', category: 'food', emoji: '🦑' },
  { text: '你对奶茶/饮料的真实喜好', category: 'food', emoji: '🧋' },
  { text: '你小时候和现在口味的变化', category: 'food', emoji: '🍭' },
  { text: '你在外面吃饭遇到过的事', category: 'food', emoji: '🍽️' },
  { text: '你偷吃过的东西', category: 'food', emoji: '🍪' },

  // ===== 玩乐爱好 =====
  { text: '你真正的爱好和「假装的爱好」', category: 'fun', emoji: '🎨' },
  { text: '你最喜欢的歌手/歌曲的冷知识', category: 'fun', emoji: '🎤' },
  { text: '你玩过的游戏和你的真实水平', category: 'fun', emoji: '🎮' },
  { text: '你去过的地方（旅行、公园、城市）', category: 'fun', emoji: '🗺️' },
  { text: '你收藏过/攒过的东西', category: 'fun', emoji: '📦' },
  { text: '你会的运动和不会的运动', category: 'fun', emoji: '⚽' },
  { text: '你看过的电影/电视剧里印象最深的', category: 'fun', emoji: '🎬' },
  { text: '你的睡觉习惯（几点睡、做什么梦、说不说梦话）', category: 'fun', emoji: '😴' },
  { text: '你最近刷到过的有意思的视频或内容', category: 'fun', emoji: '📱' },
  { text: '你养过或想养的小动物', category: 'fun', emoji: '🐹' },

  // ===== 糗事现场 =====
  { text: '你在外面出过的糗', category: 'embarrassing', emoji: '🫣' },
  { text: '你认错人或叫错名字的经历', category: 'embarrassing', emoji: '🙈' },
  { text: '你摔过的跤、撞过的玻璃门', category: 'embarrassing', emoji: '💥' },
  { text: '你弄丢过的东西', category: 'embarrassing', emoji: '🔍' },
  { text: '你睡过头或记错时间的经历', category: 'embarrassing', emoji: '⏰' },
  { text: '你发错消息或打错电话的经历', category: 'embarrassing', emoji: '📲' },
  { text: '你在重要场合干过的尴尬事', category: 'embarrassing', emoji: '🎤' },
  { text: '你穿错、穿反过的衣服鞋子', category: 'embarrassing', emoji: '👟' },
  { text: '你被当场抓包的一次经历', category: 'embarrassing', emoji: '🚨' },

  // ===== 小心思 =====
  { text: '你最近偷偷开心的一件小事', category: 'secret', emoji: '🥰' },
  { text: '你藏过的私房钱或小宝贝', category: 'secret', emoji: '💰' },
  { text: '你其实有点怕但没说过的东西', category: 'secret', emoji: '😨' },
  { text: '你偷偷羡慕过别人的地方', category: 'secret', emoji: '👀' },
  { text: '你对家里某个人的「秘密观察」', category: 'secret', emoji: '🔭' },
  { text: '你许过但没实现的新年愿望', category: 'secret', emoji: '🎋' },
  { text: '你假装喜欢/假装不喜欢过的东西', category: 'secret', emoji: '🎭' },
  { text: '你背着家人偷偷买过的东西', category: 'secret', emoji: '🛍️' },
  { text: '你心里给家人排过的「最XX排行榜」', category: 'secret', emoji: '🏆' },
  { text: '如果可以变成一种动物/一个人，你想变成谁', category: 'secret', emoji: '🦋' },
  { text: '你长大后/退休后最想做的事', category: 'secret', emoji: '🌈' },

  // ===== 追加 =====
  // 童年回忆
  { text: '你小时候攒过的零花钱拿去买了什么', category: 'childhood', emoji: '🪙' },
  { text: '你小时候和兄弟姐妹/小伙伴争抢过的东西', category: 'childhood', emoji: '🤼' },
  { text: '你小时候过生日最难忘的一次', category: 'childhood', emoji: '🎂' },

  // 学校与工作
  { text: '你被老师/领导叫到办公室的一次经历', category: 'schoolWork', emoji: '🚪' },
  { text: '你做过的小组作业或团队项目里的趣事', category: 'schoolWork', emoji: '🧩' },
  { text: '你第一份工作或第一次打工赚到的钱', category: 'schoolWork', emoji: '💼' },

  // 吃吃喝喝
  { text: '你为了好吃的排过最长的一次队', category: 'food', emoji: '🧍' },
  { text: '你深夜偷偷加过的餐', category: 'food', emoji: '🌙' },
  { text: '你坚决不放进自己火锅/外卖里的东西', category: 'food', emoji: '🌶️' },

  // 玩乐爱好
  { text: '你为某个爱好花过最多钱的一次', category: 'fun', emoji: '💸' },
  { text: '你手机相册里存得最多的是什么照片', category: 'fun', emoji: '🖼️' },
  { text: '你一个人偷偷享受过的快乐时光', category: 'fun', emoji: '🎧' },

  // 糗事现场
  { text: '你把别人的东西错当成自己的拿走过', category: 'embarrassing', emoji: '🎒' },
  { text: '你在电梯或公共场合尬住的一次', category: 'embarrassing', emoji: '😬' },
  { text: '你自信满满却搞错方向/走错路的一次', category: 'embarrassing', emoji: '🧭' },

  // 小心思
  { text: '你偷偷给自己定过但没告诉别人的小目标', category: 'secret', emoji: '🎯' },
  { text: '你心里悄悄珍藏的一句话或一个人', category: 'secret', emoji: '💌' },
  { text: '你假装没听见、其实都记在心里的事', category: 'secret', emoji: '👂' },

  // ===== 第二轮追加 =====
  // 童年回忆
  { text: '你小时候藏起来不肯交给大人的「宝贝」', category: 'childhood', emoji: '📿' },
  { text: '你小时候赖床或不肯睡觉时用过的招', category: 'childhood', emoji: '🛏️' },
  { text: '你小时候缠着家人买过的东西', category: 'childhood', emoji: '🛒' },
  { text: '你小时候去亲戚家串门最难忘的一次', category: 'childhood', emoji: '🏠' },

  // 学校与工作
  { text: '你上学/上班时坐在你旁边的人是谁、什么样', category: 'schoolWork', emoji: '🧑‍🤝‍🧑' },
  { text: '你为了应付检查或考核临时抱过的佛脚', category: 'schoolWork', emoji: '📖' },
  { text: '你和老师/领导之间一件好笑的小事', category: 'schoolWork', emoji: '😄' },
  { text: '你最盼望的放假/休息是怎么过的', category: 'schoolWork', emoji: '🏖️' },

  // 吃吃喝喝
  { text: '你做饭做菜时翻过的车', category: 'food', emoji: '🍳' },
  { text: '你逢年过节家里必上的一道菜', category: 'food', emoji: '🥢' },
  { text: '你对某种「网红美食」的真实评价', category: 'food', emoji: '🔥' },
  { text: '你最爱去的那家店和最常点的那一样', category: 'food', emoji: '🏪' },

  // 玩乐爱好
  { text: '你最近迷上的一件小事或一个新爱好', category: 'fun', emoji: '🌱' },
  { text: '你旅行或出门玩时发生过的意外小插曲', category: 'fun', emoji: '🧳' },
  { text: '你一直想去却还没去成的地方', category: 'fun', emoji: '📍' },

  // 糗事现场
  { text: '你买东西时算错钱或拿错找零的一次', category: 'embarrassing', emoji: '💵' },
  { text: '你在群里或公开场合发错内容的一次', category: 'embarrassing', emoji: '💬' },
  { text: '你信誓旦旦说对、结果错得离谱的一次', category: 'embarrassing', emoji: '🤓' },

  // 小心思
  { text: '你嘴上不承认、心里却很在意的一件事', category: 'secret', emoji: '🫥' },
  { text: '你偷偷为家里某个人做过、没邀功的事', category: 'secret', emoji: '🤐' },
  { text: '你藏在心底、想等以后再实现的小愿望', category: 'secret', emoji: '🔮' },
]
