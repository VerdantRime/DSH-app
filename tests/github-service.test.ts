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
    getRepo: async () => ({ id: 0, name: '', fullName: '', owner: '', description: null, stars: 0, forks: 0, watchers: 0, language: null, htmlUrl: '', defaultBranch: 'main' }),
    getContents: async () => ({ tree: [], file: null }),
    listIssues: async () => [],
    getIssue: async () => ({ number: 0, title: '', state: 'open', author: '', createdAt: '', labels: [], body: '', comments: [] }),
    listPulls: async () => [],
    getPull: async () => ({ number: 0, title: '', state: 'open', author: '', createdAt: '', headBranch: '', baseBranch: '', body: '', additions: 0, deletions: 0, changedFiles: 0 }),
    listCommits: async () => [],
    getCommit: async () => ({ sha: '', message: '', author: '', date: '', files: [] }),
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

  it('clearToken 清空并复位状态', async () => {
    const creds = new CredentialsStore(join(dir, 'github.json'), cipher)
    const svc = new GithubService(creds, () => fakeClient())
    await svc.setToken('tok')
    await svc.clearToken()
    expect((await svc.getStatus()).loggedIn).toBe(false)
    expect(await creds.getToken()).toBeNull()
  })
})
