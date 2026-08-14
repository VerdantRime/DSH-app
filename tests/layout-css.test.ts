import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const css = readFileSync(join(process.cwd(), 'src', 'renderer', 'styles', 'base.css'), 'utf-8')

describe('侧边栏布局（base.css）', () => {
  it('宽度收窄为 160px / 折叠 48px', () => {
    expect(css).toMatch(/\.sidebar\s*\{[^}]*width:\s*160px/)
    expect(css).toMatch(/\.sidebar\.collapsed\s*\{[^}]*width:\s*48px/)
  })

  it('不再使用会卡顿的 width 过渡动画', () => {
    expect(css).not.toContain('transition: width')
  })

  it('面板隐藏用 !important 覆盖 #panel-chat 的 display:flex', () => {
    expect(css).toMatch(/\.panel\.hidden\s*\{\s*display:\s*none\s*!important/)
  })
})
