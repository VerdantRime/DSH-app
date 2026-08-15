import { describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { repoNameFromUrl, validateCloneUrl, cloneRepo } from '../src/main/clone'

function git(args: string[], cwd?: string): void {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8' })
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' 失败：' + r.stderr)
}

describe('clone 工具', () => {
  it('repoNameFromUrl 提取仓库名', () => {
    expect(repoNameFromUrl('https://github.com/a/b.git')).toBe('b')
    expect(repoNameFromUrl('https://github.com/a/b/')).toBe('b')
    expect(repoNameFromUrl('git@github.com:a/b.git')).toBe('b')
  })

  it('validateCloneUrl 校验地址', () => {
    expect(validateCloneUrl('https://github.com/a/b.git')).toBeNull()
    expect(validateCloneUrl('git@github.com:a/b.git')).toBeNull()
    expect(validateCloneUrl('')).toContain('请输入')
    expect(validateCloneUrl('ftp://x/y')).toContain('https')
    expect(validateCloneUrl('https://x/a b')).toContain('空格')
  })

  it('cloneRepo 克隆本地仓库', async () => {
    const src = await fs.mkdtemp(join(tmpdir(), 'gitsrc-'))
    await fs.writeFile(join(src, 'a.txt'), 'hello-clone')
    git(['init'], src)
    git(['config', 'user.email', 't@t.com'], src)
    git(['config', 'user.name', 't'], src)
    git(['add', '.'], src)
    git(['commit', '-m', 'init'], src)
    const dest = join(tmpdir(), 'gidest-' + Date.now())
    await cloneRepo(src, dest)
    expect((await fs.readFile(join(dest, 'a.txt'))).toString()).toBe('hello-clone')
    await fs.rm(src, { recursive: true, force: true })
    await fs.rm(dest, { recursive: true, force: true })
  }, 30000)
})
