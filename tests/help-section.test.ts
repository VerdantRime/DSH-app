import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const settings = readFileSync(join(process.cwd(), 'src', 'renderer', 'settings.ts'), 'utf-8')

describe('设置「使用帮助」页', () => {
  it('包含帮助内容、环境自检与重新打开引导', () => {
    expect(settings).toContain('使用帮助')
    expect(settings).toContain('envCheck')
    expect(settings).toContain('showOnboarding')
  })
})
