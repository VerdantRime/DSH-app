import { describe, it, expect } from 'vitest'
import { GithubClient, mapRepoSummary, mapPullSummary, mapCommitSummary, mapIssueSummary } from '../src/main/github'

describe('github mappers', () => {
  it('mapRepoSummary 映射字段', () => {
    const r = mapRepoSummary({
      id: 9, name: 'x', full_name: 'a/x', owner: { login: 'a' }, description: null,
      stargazers_count: 3, forks_count: 1, language: 'TS', updated_at: '2024-01-01', html_url: 'https://github.com/a/x'
    })
    expect(r.fullName).toBe('a/x')
    expect(r.stars).toBe(3)
    expect(r.language).toBe('TS')
  })

  it('mapPullSummary 识别 merged 态', () => {
    expect(mapPullSummary({ number: 1, title: 't', merged: true, state: 'closed', user: { login: 'u' }, created_at: 'x', head: { ref: 'h' }, base: { ref: 'b' } }).state).toBe('merged')
    expect(mapPullSummary({ number: 2, state: 'open', merged: false, user: {}, head: {}, base: {} }).state).toBe('open')
  })

  it('mapCommitSummary 取 author', () => {
    const c = mapCommitSummary({ sha: 'abc', commit: { message: 'm', author: { name: 'N', date: 'D' } } })
    expect(c.sha).toBe('abc')
    expect(c.message).toBe('m')
    expect(c.author).toBe('N')
  })

  it('mapIssueSummary 过滤空标签', () => {
    const i = mapIssueSummary({ number: 5, title: 't', state: 'open', user: { login: 'u' }, created_at: 'x', labels: [{ name: 'bug' }, { name: null }] })
    expect(i.labels).toEqual(['bug'])
  })
})

describe('GithubClient 端点', () => {
  it('listRepos mine 调用 listForAuthenticatedUser', async () => {
    const calls: string[] = []
    const fake = {
      rest: {
        repos: {
          listForAuthenticatedUser: async () => {
            calls.push('mine')
            return { data: [{ id: 1, name: 'x', full_name: 'a/x', owner: { login: 'a' }, stargazers_count: 2 }] }
          }
        },
        activity: { listReposStarredByAuthenticatedUser: async () => ({ data: [] }) }
      }
    }
    const client = new GithubClient('tok', fake as any)
    const repos = await client.listRepos('mine')
    expect(calls).toContain('mine')
    expect(repos[0].fullName).toBe('a/x')
  })

  it('searchRepos 使用 items', async () => {
    const fake = { rest: { search: { repos: async () => ({ data: { items: [{ id: 1, name: 'q', full_name: 'a/q', owner: { login: 'a' } }] } }) } } }
    const client = new GithubClient('tok', fake as any)
    const repos = await client.searchRepos('q')
    expect(repos[0].name).toBe('q')
  })

  it('getContents 目录返回树、文件解码 base64', async () => {
    const dirFake = { rest: { repos: { getContent: async () => ({ data: [{ name: 'a.ts', path: 'a.ts', type: 'file' }] }) } } }
    const c1 = new GithubClient('tok', dirFake as any)
    const d = await c1.getContents('o', 'r')
    expect(d.tree).toHaveLength(1)
    expect(d.file).toBeNull()

    const fileFake = { rest: { repos: { getContent: async () => ({ data: { path: 'a.ts', encoding: 'base64', content: Buffer.from('hello', 'utf-8').toString('base64'), size: 10 } }) } } }
    const c2 = new GithubClient('tok', fileFake as any)
    const f = await c2.getContents('o', 'r', 'a.ts')
    expect(f.file?.content).toBe('hello')
  })
})
