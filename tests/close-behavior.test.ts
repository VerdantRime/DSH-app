import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { shouldHideToTray } from '../src/main/close-behavior'

describe('关闭窗口行为', () => {
  it('shouldHideToTray 决策正确', () => {
    expect(shouldHideToTray(true, false)).toBe(true)
    expect(shouldHideToTray(false, false)).toBe(false)
    expect(shouldHideToTray(true, true)).toBe(false)
    expect(shouldHideToTray(false, true)).toBe(false)
  })

  it('设置页提供关闭行为的开关', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'renderer', 'settings.ts'), 'utf-8')
    expect(src).toContain('closeToTray')
    expect(src).toContain('后台运行')
  })
})
