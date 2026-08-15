// README/Markdown 翻译：分段（保护代码块与行内代码/链接/图片/URL）后调用免费翻译接口。

const GOOGLE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single'
const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get'

export interface MarkdownBlock { text: string; kind: 'code' | 'text' }

/** 按空行拆分文本段，同时把 ``` 代码块原样保留为 code 段。 */
export function splitMarkdownBlocks(md: string): MarkdownBlock[] {
  const lines = md.split('\n')
  const blocks: MarkdownBlock[] = []
  let buf: string[] = []
  let inFence = false
  const flush = (kind: 'code' | 'text'): void => {
    if (buf.length) {
      blocks.push({ text: buf.join('\n'), kind })
      buf = []
    }
  }
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('```') || t.startsWith('~~~')) {
      if (!inFence) { flush('text'); inFence = true; buf = [line] }
      else { buf.push(line); flush('code'); inFence = false }
      continue
    }
    if (inFence) { buf.push(line); continue }
    if (t === '') flush('text')
    else buf.push(line)
  }
  flush(inFence ? 'code' : 'text')
  return blocks
}

/** 用占位符保护行内代码/链接/图片/URL，翻译后还原，避免破坏 Markdown 语法。 */
export function protectInline(text: string): { template: string; restore: (s: string) => string } {
  const placeholders: string[] = []
  const add = (v: string): string => {
    placeholders.push(v)
    return '\u0000' + (placeholders.length - 1) + '\u0000'
  }
  const template = text
    .replace(/`[^`\n]+`/g, (m) => add(m))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, (m) => add(m))
    .replace(/\[[^\]]*\]\([^)]*\)/g, (m) => add(m))
    .replace(/https?:\/\/\S+/g, (m) => add(m))
  const restore = (s: string): string =>
    s.replace(/\u0000(\d+)\u0000/g, (_m, i) => placeholders[Number(i)] ?? '')
  return { template, restore }
}

async function fetchGoogle(q: string, target: string, fetchImpl: typeof fetch): Promise<string> {
  const url = GOOGLE_ENDPOINT + '?client=gtx&sl=auto&tl=' + target + '&dt=t&q=' + encodeURIComponent(q)
  const res = await fetchImpl(url, { headers: { 'user-agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error('google http ' + res.status)
  const json: any = await res.json()
  const seg = json?.[0]
  if (!Array.isArray(seg)) throw new Error('google empty')
  const text = seg.map((s: any) => (Array.isArray(s) ? s[0] ?? '' : '')).join('')
  if (!text) throw new Error('google empty')
  return text
}

async function fetchMyMemory(q: string, target: string, fetchImpl: typeof fetch): Promise<string> {
  const url = MYMEMORY_ENDPOINT + '?langpair=en|' + target + '&q=' + encodeURIComponent(q)
  const res = await fetchImpl(url)
  if (!res.ok) throw new Error('mymemory http ' + res.status)
  const json: any = await res.json()
  const t = json?.responseData?.translatedText
  if (typeof t === 'string' && t) return t
  throw new Error('mymemory empty')
}

async function translateChunk(q: string, target: string, fetchImpl: typeof fetch): Promise<string> {
  const text = q.slice(0, 3800)
  try { return await fetchGoogle(text, target, fetchImpl) }
  catch (gErr) {
    try { return await fetchMyMemory(text, target, fetchImpl) }
    catch (mErr) { throw new Error('翻译服务暂不可用（已尝试 Google 与 MyMemory）') }
  }
}

/** 将 Markdown 翻译为中文（默认 zh-CN），代码块原样保留。fetchImpl 可注入以便单测。 */
export async function translateMarkdown(
  md: string,
  target = 'zh-CN',
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const blocks = splitMarkdownBlocks(md)
  const out: string[] = []
  let pending = ''
  const flushPending = async (): Promise<void> => {
    const p = pending.trim()
    pending = ''
    if (!p) return
    const { template, restore } = protectInline(p)
    const translated = await translateChunk(template, target, fetchImpl)
    out.push(restore(translated))
  }
  for (const b of blocks) {
    if (b.kind === 'code') {
      await flushPending()
      out.push(b.text)
    } else {
      pending = pending ? pending + '\n' + b.text : b.text
      if (pending.length > 1500) await flushPending()
    }
  }
  await flushPending()
  return out.join('\n\n')
}
