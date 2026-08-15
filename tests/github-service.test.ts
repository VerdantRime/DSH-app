import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { CredentialsStore, type SecretCipher } from '../src/main/credentials'
import { GithubService } from '../src/main/github-service'
import type { IGithubClient } from '../src/main/github'

const cipher: SecretCipher = {
  encrypt: (t) => Buffer.from(t, 'utf-8').toString('base64'),
  decrypt: (c) => Buffer.from(c, 'base64').toString('utf-8')
}

function fakeClient(overrides: Partial<IGithubClient> = {}): IGithubClient {
  return {
    getAccount: async () => 'alice',
    listRepos: async () => [],
    searchRepos: async () => [],
    getRepo: async () => ({ id: 0, name: '', fullName: '', owner: '', description: null, stars: 0, forks: 0, watchers: 0, language: null, htmlUrl: '', defaultBranch: 'main', canPush: false }),
    getContents: async () => ({ tree: [], file: null }),
    listIssues: async () => [],
    getIssue: async () => ({ number: 0, title: '', state: 'open', author: '', createdAt: '', labels: [], body: '', comments: [] }),
    listPulls: async () => [],
    getPull: async () => ({ number: 0, title: '', state: 'open', author: '', createdAt: '', headBranch: '', baseBranch: '', body: '', additions: 0, deletions: 0, changedFiles: 0 }),
    listCommits: async () => [],
    getCommit: async () => ({ sha: '', message: '', author: '', date: '', files: [] }),
    createOrUpdateFile: async () => {},
    deleteFile: async () => {},
    uploadFile: async () => {},
    getRawFile: async () => Buffer.from('x'),
    getReadme: async () => null,
    listTreeFiles: async () => [],
    ...overrides
  }
}

let dir = ''
beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'dsh-gh-'))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('GithubService', () => {
  it('setToken 保存并返回状态', async () => {
    const creds = new CredentialsStore(join(dir, 'github.json'), cipher)
    const svc = new GithubService(creds, () => fakeClient())
    const st = await svc.setToken('tok123')
    expect(st.loggedIn).toBe(true)
    expect(st.username).toBe('alice')
    expect(await creds.getToken()).toBe('tok123')
  })

  it('未配置 token 时 listRepos 抛 NOT_CONFIGURED', async () => {
    const creds = new CredentialsStore(join(dir, 'github.json'), cipher)
    const svc = new GithubService(creds, () => fakeClient())
    await expect(svc.listRepos('mine')).rejects.toThrow('NOT_CONFIGURED')
  })

  it('deleteFile 透传参数到客户端', async () => {
    const calls: any[] = []
    const creds = new CredentialsStore(join(dir, 'github.json'), cipher)
    const svc = new GithubService(creds, () => fakeClient({
      deleteFile: async (...args: any[]) => { calls.push(args) }
    }))
    await svc.setToken('tok')
    await svc.deleteFile('o', 'r', 'a.txt', '删除', 'sha')
    expect(calls).toEqual([['o', 'r', 'a.txt', '删除', 'sha']])
  })

  it('uploadFile 透传 base64 与可选 sha', async () => {
    const calls: any[] = []
    const creds = new CredentialsStore(join(dir, 'github.json'), cipher)
    const svc = new GithubService(creds, () => fakeClient({
      uploadFile: async (...args: any[]) => { calls.push(args) }
    }))
    await svc.setToken('tok')
    await svc.uploadFile('o', 'r', 'a.bin', 'QUJD', '上传')
    await svc.uploadFile('o', 'r', 'a.bin', 'QUJD', '覆盖', 'sha2')
    expect(calls).toEqual([['o', 'r', 'a.bin', 'QUJD', '上传', undefined], ['o', 'r', 'a.bin', 'QUJD', '覆盖', 'sha2']])
  })

  it('downloadFile 将原始字节写入目标路径', async () => {
    const creds = new CredentialsStore(join(dir, 'github.json'), cipher)
    const svc = new GithubService(creds, () => fakeClient({
      getRawFile: async () => Buffer.from([1, 2, 3, 250])
    }))
    await svc.setToken('tok')
    const dest = join(dir, 'out.bin')
    await svc.downloadFile('o', 'r', 'a.bin', dest)
    const buf = await fs.readFile(dest)
    expect([...buf]).toEqual([1, 2, 3, 250])
  })

  it('downloadFiles 批量写入并跳过失败项', async () => {
    const creds = new CredentialsStore(join(dir, 'github.json'), cipher)
    const svc = new GithubService(creds, () => fakeClient({
      getRawFile: async (_o: any, _r: any, p: string) => {
        if (p === 'big.bin') throw new Error('too large')
        return Buffer.from(p, 'utf-8')
      }
    }))
    await svc.setToken('tok')
    const res = await svc.downloadFiles('o', 'r', ['a.txt', 'docs/b.txt', 'big.bin'], join(dir, 'dl'))
    expect(res.saved).toBe(2)
    expect(res.skipped).toBe(1)
    expect((await fs.readFile(join(dir, 'dl', 'docs', 'b.txt'))).toString()).toBe('docs/b.txt')
  })

  it('downloadFiles 超过 300 个抛错', async () => {
    const creds = new CredentialsStore(join(dir, 'github.json'), cipher)
    const svc = new GithubService(creds, () => fakeClient())
    await svc.setToken('tok')
    await expect(svc.downloadFiles('o', 'r', new Array(301).fill('a.txt'), join(dir, 'dl'))).rejects.toThrow('300')
  })

  it('clearToken 清空并复位状态', async () => {
    const creds = new CredentialsStore(join(dir, 'github.json'), cipher)
    const svc = new GithubService(creds, () => fakeClient())
    await svc.setToken('tok')
    await svc.clearToken()
    expect((await svc.getStatus()).loggedIn).toBe(false)
    expect(await creds.getToken()).toBeNull()
  })
})
