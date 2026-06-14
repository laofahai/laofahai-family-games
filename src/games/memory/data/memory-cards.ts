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

  // 海洋生物
  { emoji: '🐙', label: '章鱼' },
  { emoji: '🦀', label: '螃蟹' },
  { emoji: '🦐', label: '虾' },
  { emoji: '🐠', label: '热带鱼' },
  { emoji: '🐳', label: '鲸鱼' },
  { emoji: '🦈', label: '鲨鱼' },
  { emoji: '🐚', label: '贝壳' },
  { emoji: '🪼', label: '水母' },

  // 昆虫
  { emoji: '🐞', label: '瓢虫' },
  { emoji: '🐜', label: '蚂蚁' },
  { emoji: '🦗', label: '蟋蟀' },
  { emoji: '🐛', label: '毛毛虫' },
  { emoji: '🦟', label: '蚊子' },
  { emoji: '🪰', label: '苍蝇' },

  // 蔬菜
  { emoji: '🥕', label: '胡萝卜' },
  { emoji: '🍅', label: '番茄' },
  { emoji: '🌽', label: '玉米' },
  { emoji: '🥦', label: '西兰花' },
  { emoji: '🍆', label: '茄子' },
  { emoji: '🥔', label: '土豆' },
  { emoji: '🫑', label: '青椒' },
  { emoji: '🥬', label: '白菜' },

  // 乐器
  { emoji: '🎹', label: '钢琴' },
  { emoji: '🥁', label: '架子鼓' },
  { emoji: '🎺', label: '小号' },
  { emoji: '🎻', label: '小提琴' },
  { emoji: '🪕', label: '班卓琴' },
  { emoji: '🎷', label: '萨克斯' },

  // 运动器材
  { emoji: '🏀', label: '篮球' },
  { emoji: '🏐', label: '排球' },
  { emoji: '🎾', label: '网球' },
  { emoji: '🏓', label: '乒乓球' },
  { emoji: '🏸', label: '羽毛球' },
  { emoji: '🥎', label: '垒球' },
  { emoji: '🛼', label: '轮滑鞋' },

  // 节日
  { emoji: '🎄', label: '圣诞树' },
  { emoji: '🎃', label: '南瓜灯' },
  { emoji: '🧧', label: '红包' },
  { emoji: '🏮', label: '灯笼' },
  { emoji: '🎆', label: '烟花' },
  { emoji: '🥮', label: '月饼' },

  // 天气
  { emoji: '🌧️', label: '下雨' },
  { emoji: '⛈️', label: '雷暴' },
  { emoji: '🌪️', label: '龙卷风' },
  { emoji: '🌫️', label: '雾' },
  { emoji: '⛅', label: '多云' },

  // 职业
  { emoji: '👮', label: '警察' },
  { emoji: '👨‍🚒', label: '消防员' },
  { emoji: '👩‍⚕️', label: '医生' },
  { emoji: '👨‍🍳', label: '厨师' },
  { emoji: '👩‍🚀', label: '宇航员' },
  { emoji: '👨‍🌾', label: '农民' },

  // 建筑
  { emoji: '🏠', label: '房子' },
  { emoji: '🏰', label: '城堡' },
  { emoji: '🗼', label: '铁塔' },
  { emoji: '⛪', label: '教堂' },
  { emoji: '🏯', label: '城楼' },
  { emoji: '⛺', label: '帐篷' },
  { emoji: '🌉', label: '大桥' },

  // 海洋生物（补充）
  { emoji: '🐡', label: '河豚' },
  { emoji: '🦑', label: '鱿鱼' },
  { emoji: '🦞', label: '龙虾' },
  { emoji: '🦭', label: '海豹' },
  { emoji: '🐊', label: '鳄鱼' },
  { emoji: '🦦', label: '水獭' },

  // 昆虫（补充）
  { emoji: '🦂', label: '蝎子' },
  { emoji: '🕷️', label: '蜘蛛' },
  { emoji: '🪲', label: '甲虫' },
  { emoji: '🪳', label: '蟑螂' },

  // 蔬菜（补充）
  { emoji: '🥒', label: '黄瓜' },
  { emoji: '🧅', label: '洋葱' },
  { emoji: '🧄', label: '大蒜' },
  { emoji: '🫛', label: '豌豆' },
  { emoji: '🥗', label: '蔬菜沙拉' },

  // 乐器（补充）
  { emoji: '🪗', label: '手风琴' },
  { emoji: '🪘', label: '长鼓' },
  { emoji: '🎙️', label: '麦克风' },
  { emoji: '🪈', label: '笛子' },

  // 运动器材（补充）
  { emoji: '⚾', label: '棒球' },
  { emoji: '🏈', label: '橄榄球' },
  { emoji: '🎱', label: '台球' },
  { emoji: '🥊', label: '拳击手套' },
  { emoji: '⛳', label: '高尔夫' },
  { emoji: '🏒', label: '冰球杆' },
  { emoji: '🛹', label: '滑板' },

  // 节日（补充）
  { emoji: '🎉', label: '彩带' },
  { emoji: '🎂', label: '生日蛋糕' },
  { emoji: '🪔', label: '油灯' },
  { emoji: '🎊', label: '拉花球' },

  // 天气（补充）
  { emoji: '🌬️', label: '大风' },
  { emoji: '☃️', label: '雪人' },
  { emoji: '🌡️', label: '温度计' },

  // 职业（补充）
  { emoji: '👨‍🏫', label: '老师' },
  { emoji: '👩‍🔧', label: '修理工' },
  { emoji: '🧑‍🎨', label: '画家' },
  { emoji: '🕵️', label: '侦探' },
  { emoji: '🧑‍🔬', label: '科学家' },

  // 建筑（补充）
  { emoji: '🏥', label: '医院' },
  { emoji: '🏫', label: '学校' },
  { emoji: '🏬', label: '商场' },
  { emoji: '🗽', label: '雕像' },
  { emoji: '⛲', label: '喷泉' },

  // 鸟类
  { emoji: '🦉', label: '猫头鹰' },
  { emoji: '🦅', label: '老鹰' },
  { emoji: '🦜', label: '鹦鹉' },
  { emoji: '🦚', label: '孔雀' },
  { emoji: '🦢', label: '天鹅' },
  { emoji: '🦩', label: '火烈鸟' },

  // 农场与其它动物
  { emoji: '🐎', label: '马' },
  { emoji: '🐑', label: '绵羊' },
  { emoji: '🦌', label: '小鹿' },
  { emoji: '🦒', label: '长颈鹿' },
  { emoji: '🐨', label: '考拉' },
  { emoji: '🦘', label: '袋鼠' },
  { emoji: '🦥', label: '树懒' },
  { emoji: '🦔', label: '刺猬' },
]
