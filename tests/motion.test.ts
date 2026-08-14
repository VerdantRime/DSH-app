import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const css = readFileSync(join(process.cwd(), 'src', 'renderer', 'styles', 'base.css'), 'utf-8')

describe('动效（流畅优先）', () => {
  it('使用 GPU 友好的 transform/opacity 动效', () => {
    expect(css).toContain('transform')
    expect(css).toContain('@keyframes')
  })

  it('不包含会卡顿的 width/height/top/left 过渡', () => {
    expect(css).not.toContain('transition: width')
    expect(css).not.toContain('transition: height')
    expect(css).not.toContain('transition: top')
    expect(css).not.toContain('transition: left')
    expect(css).not.toContain('transition: all')
  })

  it('尊重系统减少动效设置', () => {
    expect(css).toContain('prefers-reduced-motion')
  })
})
