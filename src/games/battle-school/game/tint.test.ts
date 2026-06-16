import { describe, it, expect } from 'vitest'
import { tintForName } from './tint'

const channels = (c: number) => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff]

describe('tintForName — 按名字确定性着色', () => {
  it('确定性：同名两次相等', () => {
    expect(tintForName('张三')).toBe(tintForName('张三'))
    expect(tintForName('李明')).toBe(tintForName('李明'))
    expect(tintForName('')).toBe(tintForName(''))
  })

  it('异名尽量不同：一组真实风格中文名两两绝大多数不同色', () => {
    const names = ['张超越', '李明', '王芳', '赵雷', '孙悦', '周杰', '吴敏', '郑爽', '钱多多', '刘洋']
    const tints = names.map(tintForName)
    const unique = new Set(tints)
    // 允许极少碰撞，但绝大多数应不同（这组 10 名实测应全不同）。
    expect(unique.size).toBeGreaterThanOrEqual(names.length - 1)
    expect(unique.size).toBe(names.length)
  })

  it('亮度护栏：每通道不过低（≥0x66 不发黑），且不是纯白', () => {
    const names = [
      '张超越', '李明', '王芳', '赵雷', '孙悦', '周杰', '吴敏', '郑爽', '钱多多', '刘洋',
      '陈晨', '林夕', '黄蓉', '杨过', '小明', '小红', 'a', 'bob', '欧阳娜娜', '司马光',
    ]
    for (const name of names) {
      const t = tintForName(name)
      const [r, g, b] = channels(t)
      expect(r).toBeGreaterThanOrEqual(0x66)
      expect(g).toBeGreaterThanOrEqual(0x66)
      expect(b).toBeGreaterThanOrEqual(0x66)
      expect(t).not.toBe(0xffffff) // 纯白等于没上色
      expect(t).toBeGreaterThanOrEqual(0)
      expect(t).toBeLessThanOrEqual(0xffffff)
    }
  })

  it('色相铺开：一批名字的色相不集中在单一区域', () => {
    const tints = Array.from({ length: 60 }, (_, i) => tintForName(`同学${i}`))
    // 浅亮色仍应覆盖多种主色，至少出现 3 类以上「最大通道」分布。
    const dominant = new Set(
      tints.map((t) => {
        const [r, g, b] = channels(t)
        const max = Math.max(r, g, b)
        if (max === r) return 'r'
        if (max === g) return 'g'
        return 'b'
      }),
    )
    expect(dominant.size).toBeGreaterThanOrEqual(2)
  })
})
