// 记忆翻牌的卡面库：每条 = 一个 emoji + 中文名，辨识度高、家庭友好。
// 开局时通过 contentFor('memory', memoryCards) 取用（运行时，不在模块顶层）。

export interface MemoryCard {
  emoji: string
  label: string
}

export const memoryCards: MemoryCard[] = [
  // 动物
  { emoji: '🐶', label: '小狗' },
  { emoji: '🐱', label: '小猫' },
  { emoji: '🐰', label: '兔子' },
  { emoji: '🐼', label: '熊猫' },
  { emoji: '🦊', label: '狐狸' },
  { emoji: '🐯', label: '老虎' },
  { emoji: '🦁', label: '狮子' },
  { emoji: '🐮', label: '奶牛' },
  { emoji: '🐷', label: '小猪' },
  { emoji: '🐸', label: '青蛙' },
  { emoji: '🐵', label: '猴子' },
  { emoji: '🐧', label: '企鹅' },
  { emoji: '🐢', label: '乌龟' },
  { emoji: '🐝', label: '蜜蜂' },
  { emoji: '🦋', label: '蝴蝶' },
  { emoji: '🐬', label: '海豚' },

  // 水果
  { emoji: '🍎', label: '苹果' },
  { emoji: '🍌', label: '香蕉' },
  { emoji: '🍇', label: '葡萄' },
  { emoji: '🍓', label: '草莓' },
  { emoji: '🍉', label: '西瓜' },
  { emoji: '🍊', label: '橘子' },
  { emoji: '🍑', label: '桃子' },
  { emoji: '🍍', label: '菠萝' },

  // 食物
  { emoji: '🍰', label: '蛋糕' },
  { emoji: '🍦', label: '冰淇淋' },
  { emoji: '🍕', label: '披萨' },
  { emoji: '🍔', label: '汉堡' },
  { emoji: '🍜', label: '面条' },
  { emoji: '🍙', label: '饭团' },
  { emoji: '🥚', label: '鸡蛋' },
  { emoji: '🍪', label: '饼干' },

  // 交通
  { emoji: '🚗', label: '汽车' },
  { emoji: '🚌', label: '公交' },
  { emoji: '🚲', label: '自行车' },
  { emoji: '✈️', label: '飞机' },
  { emoji: '🚀', label: '火箭' },
  { emoji: '🚢', label: '轮船' },
  { emoji: '🚂', label: '火车' },
  { emoji: '🚁', label: '直升机' },

  // 自然
  { emoji: '🌞', label: '太阳' },
  { emoji: '🌙', label: '月亮' },
  { emoji: '⭐', label: '星星' },
  { emoji: '☁️', label: '云朵' },
  { emoji: '🌈', label: '彩虹' },
  { emoji: '❄️', label: '雪花' },
  { emoji: '🌷', label: '郁金香' },
  { emoji: '🌳', label: '大树' },
  { emoji: '🍄', label: '蘑菇' },

  // 物品
  { emoji: '⚽', label: '足球' },
  { emoji: '🎈', label: '气球' },
  { emoji: '🎁', label: '礼物' },
  { emoji: '🎸', label: '吉他' },
  { emoji: '📚', label: '书本' },
  { emoji: '✏️', label: '铅笔' },
  { emoji: '⏰', label: '闹钟' },
  { emoji: '🔑', label: '钥匙' },
  { emoji: '☂️', label: '雨伞' },
  { emoji: '💡', label: '灯泡' },

  // 表情
  { emoji: '😀', label: '笑脸' },
  { emoji: '😎', label: '酷脸' },
  { emoji: '😴', label: '睡觉' },
  { emoji: '🥳', label: '庆祝' },
]
