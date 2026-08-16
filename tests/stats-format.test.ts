import { describe, it, expect } from 'vitest'
import { formatDuration, barPct } from '../src/renderer/stats-format'

describe('统计格式化', () => {
  it('formatDuration 秒/分/小时', () => {
    expect(formatDuration(0)).toBe('0 秒')
    expect(formatDuration(30 * 1000)).toBe('30 秒')
    expect(formatDuration(90 * 1000)).toBe('1 分 30 秒')
    expect(formatDuration(3600 * 1000 + 30 * 60 * 1000)).toBe('1 小时 30 分')
  })

  it('barPct 计算占比并夹在 0-100', () => {
    expect(barPct(50, 100)).toBe(50)
    expect(barPct(200, 100)).toBe(100)
    expect(barPct(0, 0)).toBe(0)
  })
})
