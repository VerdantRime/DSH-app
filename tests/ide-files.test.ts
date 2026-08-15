import { describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { sortDirEntries, listDirEntries, readTextFile, readFileWithPath, writeTextFile, type DirEntry } from '../src/main/ide-files'

describe('IDE 文件服务', () => {
  it('sortDirEntries 文件夹置顶且不修改原数组', () => {
    const input: DirEntry[] = [
      { name: 'z.txt', path: '/z.txt', type: 'file' },
      { name: 'a', path: '/a', type: 'dir' },
      { name: 'b.c', path: '/b.c', type: 'file' }
    ]
    const original = [...input]
    expect(sortDirEntries(input).map((e) => e.name)).toEqual(['a', 'b.c', 'z.txt'])
    expect(input).toEqual(original)
  })

  it('writeTextFile 自动创建不存在的父目录（临时目录场景）', async () => {
    const base = await fs.mkdtemp(join(tmpdir(), 'ide-nested-'))
    const nested = join(base, 'dsh-ide', 'ai_snippet.txt')
    await writeTextFile(nested, 'code')
    expect(await readTextFile(nested)).toBe('code')
    await fs.rm(base, { recursive: true, force: true })
  })

  it('readFileWithPath 返回 {path, content}', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'ide-rp-'))
    const f = join(dir, 'a.txt')
    await writeTextFile(f, '你好')
    expect(await readFileWithPath(f)).toEqual({ path: f, content: '你好' })
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('读写文本文件与目录列举（真实临时目录）', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'ide-'))
    const sub = join(dir, 'sub')
    await fs.mkdir(sub)
    await writeTextFile(join(dir, 'a.txt'), 'hello 世界')
    await fs.writeFile(join(dir, 'b.c'), 'int x;')
    expect(await readTextFile(join(dir, 'a.txt'))).toBe('hello 世界')
    const entries = await listDirEntries(dir)
    expect(entries.map((e) => e.name)).toEqual(['sub', 'a.txt', 'b.c'])
    expect(entries[0].type).toBe('dir')
    await fs.rm(dir, { recursive: true, force: true })
  })
})
