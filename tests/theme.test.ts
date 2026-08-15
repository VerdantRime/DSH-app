import { describe, it, expect } from 'vitest'
import { resolveTheme, nextTheme, themeLabel } from '../src/renderer/theme'

describe('theme', () => {
  it('resolveTheme 解析明暗与二次元', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('anime', false)).toBe('anime')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('nextTheme 循环切换', () => {
    expect(nextTheme('system')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('anime')
    expect(nextTheme('anime')).toBe('system')
  })

  it('themeLabel', () => {
    expect(themeLabel('system')).toBe('跟随系统')
    expect(themeLabel('dark')).toBe('深色')
    expect(themeLabel('anime')).toBe('二次元')
  })
})
