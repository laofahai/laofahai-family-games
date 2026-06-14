import type { BattleQuestion } from '../core'

export const items: BattleQuestion[] = [
  // ===== 拼音 =====
  {
    id: 'low-chinese-001',
    subject: 'chinese',
    prompt: '“妈妈”的“妈”读什么音呀？',
    choices: [
      { id: 'a', text: 'mā（第一声）' },
      { id: 'b', text: 'mǎ（第三声）' },
      { id: 'c', text: 'mà（第四声）' },
    ],
    answer: 'a',
    explanation: '“妈”读 mā，是平平的第一声。',
  },
  {
    id: 'low-chinese-002',
    subject: 'chinese',
    prompt: '小鸭子的“鸭”，拼音是哪个？',
    choices: [
      { id: 'a', text: 'yā' },
      { id: 'b', text: 'yá' },
      { id: 'c', text: 'wā' },
    ],
    answer: 'a',
    explanation: '“鸭”读 yā，跟小鸭叫的声音有点像。',
  },
  {
    id: 'low-chinese-003',
    subject: 'chinese',
    prompt: '“水”这个字的拼音是？',
    choices: [
      { id: 'a', text: 'shuǐ' },
      { id: 'b', text: 'shuì' },
      { id: 'c', text: 'suí' },
    ],
    answer: 'a',
    explanation: '“水”读 shuǐ，第三声，喝的水。',
  },
  {
    id: 'low-chinese-004',
    subject: 'chinese',
    prompt: '“e”这个韵母，读起来像哪个？',
    choices: [
      { id: 'a', text: '鹅 é 的声音' },
      { id: 'b', text: '衣 i 的声音' },
      { id: 'c', text: '乌 u 的声音' },
    ],
    answer: 'a',
    explanation: '小鹅“é é é”，“e”就读这个音。',
  },
  {
    id: 'low-chinese-005',
    subject: 'chinese',
    prompt: '“太阳”的“阳”读第几声？',
    choices: [
      { id: 'a', text: '第一声 yāng' },
      { id: 'b', text: '第二声 yáng' },
      { id: 'c', text: '第三声 yǎng' },
    ],
    answer: 'b',
    explanation: '“阳”读 yáng，第二声，往上扬一扬。',
  },

  // ===== 笔画数 =====
  {
    id: 'low-chinese-006',
    subject: 'chinese',
    prompt: '“一”这个字有几画？',
    choices: [
      { id: 'a', text: '1 画' },
      { id: 'b', text: '2 画' },
      { id: 'c', text: '3 画' },
    ],
    answer: 'a',
    explanation: '“一”就是横着写一笔，只有 1 画。',
  },
  {
    id: 'low-chinese-007',
    subject: 'chinese',
    prompt: '“十”字一共要写几笔？',
    choices: [
      { id: 'a', text: '1 笔' },
      { id: 'b', text: '2 笔' },
      { id: 'c', text: '4 笔' },
    ],
    answer: 'b',
    explanation: '“十”是一横加一竖，2 笔。',
  },
  {
    id: 'low-chinese-008',
    subject: 'chinese',
    prompt: '“口”字有几画？',
    choices: [
      { id: 'a', text: '2 画' },
      { id: 'b', text: '3 画' },
      { id: 'c', text: '4 画' },
    ],
    answer: 'b',
    explanation: '“口”是一个小方框，写起来是 3 画。',
  },
  {
    id: 'low-chinese-009',
    subject: 'chinese',
    prompt: '“火”字一共有几画？',
    choices: [
      { id: 'a', text: '3 画' },
      { id: 'b', text: '4 画' },
      { id: 'c', text: '5 画' },
    ],
    answer: 'b',
    explanation: '“火”是 4 画，像跳动的火苗。',
  },

  // ===== 组词 =====
  {
    id: 'low-chinese-010',
    subject: 'chinese',
    prompt: '“大”字可以组成下面哪个词？',
    choices: [
      { id: 'a', text: '大象' },
      { id: 'b', text: '小猫' },
      { id: 'c', text: '河水' },
    ],
    answer: 'a',
    explanation: '“大象”里有“大”字，大象的鼻子长长的。',
  },
  {
    id: 'low-chinese-011',
    subject: 'chinese',
    prompt: '用“花”能组成哪个词？',
    choices: [
      { id: 'a', text: '花朵' },
      { id: 'b', text: '小狗' },
      { id: 'c', text: '太阳' },
    ],
    answer: 'a',
    explanation: '“花朵”里有“花”，开得香香的。',
  },
  {
    id: 'low-chinese-012',
    subject: 'chinese',
    prompt: '“天”字能跟哪个字组成词？',
    choices: [
      { id: 'a', text: '天空' },
      { id: 'b', text: '吃饭' },
      { id: 'c', text: '走路' },
    ],
    answer: 'a',
    explanation: '“天空”里有“天”，蓝蓝的天空。',
  },
  {
    id: 'low-chinese-013',
    subject: 'chinese',
    prompt: '下面哪个词里有“月”字？',
    choices: [
      { id: 'a', text: '月亮' },
      { id: 'b', text: '苹果' },
      { id: 'c', text: '汽车' },
    ],
    answer: 'a',
    explanation: '“月亮”里有“月”，晚上挂在天上。',
  },

  // ===== 反义词 =====
  {
    id: 'low-chinese-014',
    subject: 'chinese',
    prompt: '“大”的反义词是什么？',
    choices: [
      { id: 'a', text: '小' },
      { id: 'b', text: '多' },
      { id: 'c', text: '高' },
    ],
    answer: 'a',
    explanation: '大的反过来就是小，大苹果、小苹果。',
  },
  {
    id: 'low-chinese-015',
    subject: 'chinese',
    prompt: '“上”的反义词是哪个？',
    choices: [
      { id: 'a', text: '下' },
      { id: 'b', text: '左' },
      { id: 'c', text: '前' },
    ],
    answer: 'a',
    explanation: '“上”对着“下”，上楼、下楼。',
  },
  {
    id: 'low-chinese-016',
    subject: 'chinese',
    prompt: '“多”的反义词是什么？',
    choices: [
      { id: 'a', text: '少' },
      { id: 'b', text: '好' },
      { id: 'c', text: '白' },
    ],
    answer: 'a',
    explanation: '糖很多，糖很少，“多”和“少”是反着的。',
  },
  {
    id: 'low-chinese-017',
    subject: 'chinese',
    prompt: '“黑”的反义词是哪个？',
    choices: [
      { id: 'a', text: '白' },
      { id: 'b', text: '红' },
      { id: 'c', text: '冷' },
    ],
    answer: 'a',
    explanation: '黑黑的夜、白白的云，“黑”对“白”。',
  },
  {
    id: 'low-chinese-018',
    subject: 'chinese',
    prompt: '“开”的反义词是什么？',
    choices: [
      { id: 'a', text: '关' },
      { id: 'b', text: '跑' },
      { id: 'c', text: '坐' },
    ],
    answer: 'a',
    explanation: '开门、关门，“开”和“关”是一对。',
  },

  // ===== 量词 =====
  {
    id: 'low-chinese-019',
    subject: 'chinese',
    prompt: '一（   ）小鱼，应该填哪个字？',
    choices: [
      { id: 'a', text: '条' },
      { id: 'b', text: '只' },
      { id: 'c', text: '本' },
    ],
    answer: 'a',
    explanation: '小鱼长长的，要说“一条小鱼”。',
  },
  {
    id: 'low-chinese-020',
    subject: 'chinese',
    prompt: '一（   ）书，填哪个量词最合适？',
    choices: [
      { id: 'a', text: '本' },
      { id: 'b', text: '条' },
      { id: 'c', text: '头' },
    ],
    answer: 'a',
    explanation: '书要说“一本书”，可以翻着看。',
  },
  {
    id: 'low-chinese-021',
    subject: 'chinese',
    prompt: '一（   ）小猫，应该用哪个量词？',
    choices: [
      { id: 'a', text: '只' },
      { id: 'b', text: '张' },
      { id: 'c', text: '棵' },
    ],
    answer: 'a',
    explanation: '小动物常说“一只”，一只小猫喵喵叫。',
  },
  {
    id: 'low-chinese-022',
    subject: 'chinese',
    prompt: '一（   ）大树，填哪个字呢？',
    choices: [
      { id: 'a', text: '棵' },
      { id: 'b', text: '只' },
      { id: 'c', text: '本' },
    ],
    answer: 'a',
    explanation: '树要说“一棵树”，高高地长在地上。',
  },
]
