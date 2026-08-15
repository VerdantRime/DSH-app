import { describe, it, expect } from 'vitest'
import { splitMarkdownBlocks, protectInline, translateMarkdown } from '../src/main/translate'

function googleFetch(prefix = 'Z:'): typeof fetch {
  return (async (url: any) => {
    const q = decodeURIComponent(String(url).split('q=')[1] ?? '')
    return { ok: true, json: async () => [[[prefix + q, '', '', '']]] }
  }) as typeof fetch
}

describe('translate 分段与保护', () => {
  it('splitMarkdownBlocks 保留代码块为 code 段', () => {
    const blocks = splitMarkdownBlocks('# A\n\npara\n\n```js\nx\n```\n\ntail')
    expect(blocks.map((b) => b.kind)).toEqual(['text', 'text', 'code', 'text'])
    expect(blocks[2].text).toContain('```js')
  })

  it('protectInline 保护行内代码/链接/图片/URL 并可还原', () => {
    const src = 'a `code` b [t](https://x) ![i](img.png) https://y.com'
    const { template, restore } = protectInline(src)
    expect(template).not.toContain('`code`')
    expect(template).not.toContain('https://x')
    expect(restore(template)).toBe(src)
  })

  it('translateMarkdown 翻译文本、代码块原样保留、行内语法还原', async () => {
    const md = '# Hi\n\n```js\nconst x = 1\n```\n\n`code` and [link](https://a.b)'
    const out = await translateMarkdown(md, 'zh-CN', googleFetch())
    expect(out).toContain('```js')
    expect(out).toContain('const x = 1')
    expect(out).not.toContain('Z:const x = 1')
    expect(out).toContain('`code`')
    expect(out).toContain('[link](https://a.b)')
  })

  it('translateMarkdown Google 失败时回退 MyMemory', async () => {
    const md = 'hello world'
    let calls: string[] = []
    const f = (async (url: any) => {
      const u = String(url)
      calls.push(u)
      if (u.includes('translate.googleapis.com')) return { ok: false, json: async () => ({}) }
      return { ok: true, json: async () => ({ responseData: { translatedText: '你好世界' } }) }
    }) as typeof fetch
    const out = await translateMarkdown(md, 'zh-CN', f)
    expect(out).toBe('你好世界')
    expect(calls.some((u) => u.includes('mymemory'))).toBe(true)
  })
})
