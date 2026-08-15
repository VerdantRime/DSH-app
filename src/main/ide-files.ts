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

export async function readTextFile(path: string): Promise<string> {
  return fs.readFile(path, 'utf-8')
}

/** 读取并带路径返回（前端契约）。 */
export async function readFileWithPath(path: string): Promise<{ path: string; content: string }> {
  return { path, content: await readTextFile(path) }
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
  await fs.writeFile(path, content, 'utf-8')
}
