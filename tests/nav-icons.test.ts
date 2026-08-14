import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PANELS } from '../src/renderer/panels'

describe('导航图标', () => {
  it('三个图标都是 SVG', () => {
    for (const p of PANELS) {
      expect(p.icon).toContain('<svg')
    }
  })

  it('不再使用 emoji 图标', () => {
    for (const p of PANELS) {
      expect(p.icon).not.toContain('💬')
      expect(p.icon).not.toContain('🐙')
      expect(p.icon).not.toContain('⚙️')
    }
  })

  it('图标用 currentColor 跟随主题', () => {
    for (const p of PANELS) {
      expect(p.icon).toContain('currentColor')
    }
  })

  it('以 innerHTML 渲染图标', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'renderer', 'main.ts'), 'utf-8')
    expect(src).toContain('icon.innerHTML')
    expect(src).not.toContain('icon.textContent = p.icon')
  })
})
