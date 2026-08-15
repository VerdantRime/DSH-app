import { promises as fs } from 'fs'
import { join, dirname } from 'path'

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

/** 读取并带路径返回（前端契约）。 */
export async function readFileWithPath(path: string): Promise<{ path: string; content: string }> {
  return { path, content: await readTextFile(path) }
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
  await fs.writeFile(path, content, 'utf-8')
}
