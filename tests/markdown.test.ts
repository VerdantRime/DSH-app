import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '../src/renderer/markdown'

describe('renderMarkdown', () => {
  it('渲染标题与链接', () => {
    expect(renderMarkdown('# 标题')).toContain('<h1')
    expect(renderMarkdown('[GitHub](https://github.com)')).toContain('<a href="https://github.com"')
  })

  it('渲染 GFM 表格', () => {
    const html = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |')
    expect(html).toContain('<table>')
    expect(html).toContain('<th')
  })

  it('渲染代码块与行内代码', () => {
    const html = renderMarkdown('```ts\nconst x = 1\n```')
    expect(html).toContain('<pre>')
    expect(html).toContain('const x = 1')
    expect(renderMarkdown('`code`')).toContain('<code>code</code>')
  })

  it('渲染删除线与列表', () => {
    expect(renderMarkdown('~~旧~~')).toContain('<del>')
    expect(renderMarkdown('- a\n- b')).toContain('<ul>')
  })
})
