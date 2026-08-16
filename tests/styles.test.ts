import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const css = readFileSync(join(process.cwd(), 'src', 'renderer', 'styles', 'base.css'), 'utf-8')

describe('IDE UI 细节样式（base.css）', () => {
  it('工具栏「语言」标签不占用 90px 最小宽度，紧贴下拉框', () => {
    expect(css).toMatch(/\.ide-toolbar\s+\.set-label\s*\{\s*min-width:\s*0\b/)
  })

  it('AI 气泡内代码块不溢出（pre 限宽 + 可横向滚动）', () => {
    expect(css).toMatch(/\.ide-ai-msg\s+pre\s*\{[^}]*max-width:\s*100%/)
    expect(css).toMatch(/\.ide-ai-msg\s+pre\s*\{[^}]*overflow-x:\s*auto/)
  })
})
