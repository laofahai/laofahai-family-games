export type WordItem = {
  text: string
  pinyin: string
}

export type WordPair = {
  id: string
  tag: string
  words: [WordItem, WordItem]
}
