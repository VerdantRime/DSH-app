import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import * as iconv from 'iconv-lite'

export type FileEncoding = 'utf-8' | 'gbk'

export interface DirEntry { name: string; path: string; type: 'file' | 'dir' }

/** 目录列表排序：文件夹置顶、同组按名称字母序，不修改原数组。 */
export function sortDirEntries(entries: DirEntry[]): DirEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function listDirEntries(dir: string): Promise<DirEntry[]> {
  const names = await fs.readdir(dir, { withFileTypes: true })
  const entries: DirEntry[] = []
  for (const d of names) entries.push({ name: d.name, path: join(dir, d.name), type: d.isDirectory() ? 'dir' : 'file' })
  return sortDirEntries(entries)
}

/** 解码文本文件：先按 UTF-8 严格解码，失败回退 GBK（兼容 Dev-C++ 等 GBK 源文件）。 */
export function decodeText(buf: Buffer): string {
  if (!buf || buf.length === 0) return ''
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    /* 非 UTF-8，回退 GBK */
  }
  try {
    return new TextDecoder('gbk').decode(buf)
  } catch {
    return buf.toString('utf-8')
  }
}

export async function readTextFile(path: string): Promise<string> {
  return decodeText(await fs.readFile(path))
}

/** 检测文件编码（UTF-8 严格解码成功为 utf-8，否则 gbk）。 */
export function detectEncoding(buf: Buffer): FileEncoding {
  if (!buf || buf.length === 0) return 'utf-8'
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf)
    return 'utf-8'
  } catch {
    return 'gbk'
  }
}

/** 读取并带路径/编码返回（前端契约）。 */
export async function readFileWithPath(path: string): Promise<{ path: string; content: string; encoding: FileEncoding }> {
  const buf = await fs.readFile(path)
  return { path, content: decodeText(buf), encoding: detectEncoding(buf) }
}

/** 写入文本，可指定编码（保持原文件编码，避免 GBK 文件被存成 UTF-8 而乱码）。 */
export async function writeTextFile(path: string, content: string, encoding: FileEncoding = 'utf-8'): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
  const buf = encoding === 'gbk' ? iconv.encode(content, 'gbk') : Buffer.from(content, 'utf-8')
  await fs.writeFile(path, buf)
}
