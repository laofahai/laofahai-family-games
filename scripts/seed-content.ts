// 一次性：把代码里现有的题库 / 词库 / 卡片导出成 SQL，灌进 game_content 表。
// 跑法：  npx --yes tsx scripts/seed-content.ts > /tmp/seed-content.sql
//        然后用 psql 把 /tmp/seed-content.sql 应用到数据库。
// 之后真源就在数据库；代码里这些数组只当离线回退 / 重新播种用。

import { charadesWords } from '../src/games/charades/data/charades-words'
import { truthTopics } from '../src/games/truth-lie/data/truth-topics'
import { storyCards } from '../src/games/story/data/story-cards'
import { priceItems } from '../src/games/price/data/price-items'
import { drawWords } from '../src/games/draw/data/draw-words'
import { knowQuestions } from '../src/games/know-you/data/know-questions'
import { familyCards } from '../src/games/know-you/data/family'
import { wordBank } from '../src/data/word-bank'
// 程序化学习游戏的静态数据（名单 / 通用名词 / 商店 / spark 卡）——生成算法仍留代码
import { things, classmates, shopCatalog } from '../src/games/shiliu-town/data/roster'
import { CLASSMATES as yiyiClassmates } from '../src/games/yiyi-bureau/data/people'
import { TRUE_FALSE, FUN_CARDS } from '../src/games/yiyi-bureau/data/spark'

const banks: Record<string, readonly unknown[]> = {
  charades: charadesWords,
  'truth-lie': truthTopics,
  story: storyCards,
  price: priceItems,
  draw: drawWords,
  'know-you': knowQuestions,
  'know-family': familyCards,
  'word-bank': wordBank,
  // 共享：通用名词池，任何需要「物品+单位」的游戏都复用这一份
  nouns: things,
  // 各孩子的班级名单（单一可编辑源；people/buyerNames 在代码里据此实时拼）
  'roster-shiliu': classmates,
  'roster-yiyi': yiyiClassmates,
  // 石榴镇商店目录
  'shiliu-shop': shopCatalog,
  // 一依局 spark 静态卡
  'yiyi-truefalse': TRUE_FALSE,
  'yiyi-funcards': FUN_CARDS,
}

const out: string[] = []
out.push('-- 自动生成：把代码里的内容库灌进 game_content。可重复执行（upsert）。')
out.push('begin;')
for (const [game, arr] of Object.entries(banks)) {
  const json = JSON.stringify(arr)
  // 用美元引用，JSON 里不可能出现 $seed$ 这个分隔串，安全
  out.push(
    `insert into public.game_content (game, data, updated_at) values ('${game}', $seed$${json}$seed$::jsonb, now())` +
      ` on conflict (game) do update set data = excluded.data, updated_at = now();`
  )
  process.stderr.write(`  ${game}: ${arr.length} 条\n`)
}
out.push('commit;')
out.push("notify pgrst, 'reload schema';")

process.stdout.write(out.join('\n') + '\n')
