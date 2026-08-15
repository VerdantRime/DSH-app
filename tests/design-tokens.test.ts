import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const theme = readFileSync(join(root, 'src', 'renderer', 'styles', 'theme.css'), 'utf-8')
const base = readFileSync(join(root, 'src', 'renderer', 'styles', 'base.css'), 'utf-8')
const html = readFileSync(join(root, 'src', 'renderer', 'index.html'), 'utf-8')
const icons = readFileSync(join(root, 'src', 'renderer', 'icons.ts'), 'utf-8')
const gh = readFileSync(join(root, 'src', 'renderer', 'github.ts'), 'utf-8')

describe('设计令牌（依据 awesome-design-md 规范）', () => {
  it('定义 rounded 与 spacing 令牌', () => {
    expect(theme).toContain('--radius-lg: 12px')
    expect(theme).toContain('--radius-md: 8px')
    expect(theme).toContain('--radius-pill: 9999px')
    expect(theme).toContain('--space-4: 16px')
    expect(theme).toContain('--space-6: 32px')
  })

  it('组件样式引用令牌变量', () => {
    expect(base).toContain('var(--radius-lg)')
    expect(base).toContain('var(--radius-md)')
    expect(base).toContain('var(--radius-pill)')
  })

  it('星点黄点缀令牌（贴合图标）', () => {
    expect(theme).toContain('--brand-star: #F5C84C')
    expect(theme).toContain('--brand-navy: #282F59')
  })

  it('侧边栏品牌区含应用图标与名称', () => {
    expect(html).toContain('sidebar-brand')
    expect(html).toContain('app-icon.png')
    expect(html).toContain('brand-title')
  })

  it('渲染层图标资源存在且为 PNG', () => {
    const png = readFileSync(join(root, 'src', 'renderer', 'assets', 'app-icon.png'))
    expect(png[0]).toBe(0x89)
    expect(png[1]).toBe(0x50)
    expect(png[2]).toBe(0x4e)
    expect(png[3]).toBe(0x47)
  })

  it('文件浏览器用 SVG 图标替代 emoji', () => {
    expect(icons).toContain('FOLDER_ICON')
    expect(icons).toContain('FILE_ICON')
    expect(gh).toContain('FOLDER_ICON')
    expect(gh).not.toContain('📁')
    expect(gh).not.toContain('📄')
    expect(gh).not.toContain('🐙')
  })

  it('渲染 Markdown 链接被拦截打开（防白屏）', () => {
    expect(gh).toContain('attachRepoLinks')
    expect(gh).toContain('preventDefault')
    expect(gh).toContain('openExternal')
  })

  it('文件类型徽章与文件夹图标色已区分', () => {
    expect(base).toContain('.gh-file-ext')
    expect(base).toContain('.gh-file-icon.dir')
    expect(base).toContain('--brand-blue')
  })

  it('二次元主题含星点装饰与糖果按钮', () => {
    expect(base).toContain('radial-gradient(2px 2px at')
    expect(base).toContain('rgba(246, 168, 200, 0.35)')
    expect(base).toContain('rgba(245, 200, 76, 0.42)')
  })

  it('二次元主题存在蓝白粉调色板与糖果按钮', () => {
    expect(theme).toContain("data-theme='anime'")
    expect(base).toContain('--anime-pink-deep')
    expect(base).toContain('[data-theme=\'anime\'] .btn')
  })

  it('文件树定位高亮样式存在', () => {
    expect(base).toContain('.ide-tree-row-active')
    expect(base).toContain('@keyframes tree-flash')
  })

  it('主按钮使用品牌蓝渐变', () => {
    expect(base).toContain('.btn.primary')
    expect(base).toContain('var(--brand-blue)')
  })
})
