import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const theme = readFileSync(join(process.cwd(), 'src', 'renderer', 'styles', 'theme.css'), 'utf-8')

describe('主题配色（贴合图标）', () => {
  it('使用图标主色作为强调色', () => {
    expect(theme).toContain('#4C5F98')
    expect(theme).toContain('#282F59')
    expect(theme).toContain('#6A83A8')
    expect(theme).toContain('#38487B')
  })

  it('提供浅色与深色两套主题', () => {
    expect(theme).toContain(':root')
    expect(theme).toContain('data-theme')
  })

  it('存在 DESIGN.md 记录设计规范', () => {
    const md = readFileSync(join(process.cwd(), 'DESIGN.md'), 'utf-8')
    expect(md).toContain('#4C5F98')
    expect(md).toContain('#282F59')
  })
})
