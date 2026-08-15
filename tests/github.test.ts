import { describe, it, expect } from 'vitest'
import { GithubClient, validateGithubInput, mapRepoSummary, mapPullSummary, mapCommitSummary, mapIssueSummary, sortFileTree, mapFileNode } from '../src/main/github'

function node(name: string, type: 'file' | 'dir', path = name): any {
  return { name, path, type }
}

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
    const client = new GithubClient('tok', { octokit: fake as any })
    const repos = await client.listRepos('mine')
    expect(calls).toContain('mine')
    expect(repos[0].fullName).toBe('a/x')
  })

  it('searchRepos 使用 items', async () => {
    const fake = { rest: { search: { repos: async () => ({ data: { items: [{ id: 1, name: 'q', full_name: 'a/q', owner: { login: 'a' } }] } }) } } }
    const client = new GithubClient('tok', { octokit: fake as any })
    const repos = await client.searchRepos('q')
    expect(repos[0].name).toBe('q')
  })

  it('getContents 目录返回树、文件解码 base64', async () => {
    const dirFake = { rest: { repos: { getContent: async () => ({ data: [{ name: 'a.ts', path: 'a.ts', type: 'file' }] }) } } }
    const c1 = new GithubClient('tok', { octokit: dirFake as any })
    const d = await c1.getContents('o', 'r')
    expect(d.tree).toHaveLength(1)
    expect(d.file).toBeNull()

    const fileFake = { rest: { repos: { getContent: async () => ({ data: { path: 'a.ts', encoding: 'base64', content: Buffer.from('hello', 'utf-8').toString('base64'), size: 10 } }) } } }
    const c2 = new GithubClient('tok', { octokit: fileFake as any })
    const f = await c2.getContents('o', 'r', 'a.ts')
    expect(f.file?.content).toBe('hello')
  })

  it('baseUrl 默认与自定义', () => {
    expect(new GithubClient('tok').baseUrl).toBe('https://api.github.com')
    expect(new GithubClient('tok', { baseUrl: 'https://mirror.example.com' }).baseUrl).toBe('https://mirror.example.com')
  })

  it('createOrUpdateFile 提交 base64 内容与 sha', async () => {
    let captured: any = null
    const fake = { rest: { repos: { createOrUpdateFileContents: async (args: any) => { captured = args } } } }
    const c = new GithubClient('tok', { octokit: fake as any })
    await c.createOrUpdateFile('o', 'r', 'a.md', '你好 world', '更新文件', 'sha1')
    expect(captured.content).toBe(Buffer.from('你好 world', 'utf-8').toString('base64'))
    expect(captured.sha).toBe('sha1')
    expect(captured.message).toBe('更新文件')
  })

  it('createOrUpdateFile 新建时不含 sha', async () => {
    let captured: any = null
    const fake = { rest: { repos: { createOrUpdateFileContents: async (args: any) => { captured = args } } } }
    const c = new GithubClient('tok', { octokit: fake as any })
    await c.createOrUpdateFile('o', 'r', 'new.md', 'content', '新增')
    expect(captured.sha).toBeUndefined()
  })

  it('sortFileTree 文件夹置顶、组内字母序、不改原数组', () => {
    const input = [node('zeta.md', 'file'), node('alpha', 'dir'), node('beta.ts', 'file'), node('aaa', 'dir')]
    const original = [...input]
    const out = sortFileTree(input.map(mapFileNode))
    expect(out.map((n) => n.name)).toEqual(['aaa', 'alpha', 'beta.ts', 'zeta.md'])
    expect(out.map((n) => n.type)).toEqual(['dir', 'dir', 'file', 'file'])
    // 原数组顺序不变
    expect(input).toEqual(original)
  })

  it('sortFileTree 大小写不敏感排序且文件置底', () => {
    const out = sortFileTree([node('Zebra', 'file'), node('apple', 'file'), node('Bob', 'dir')].map(mapFileNode))
    expect(out.map((n) => n.name)).toEqual(['Bob', 'apple', 'Zebra'])
  })

  it('validateGithubInput 校验 token 与地址', () => {
    expect(validateGithubInput('ghp_abc123', 'https://api.github.com')).toBeNull()
    expect(validateGithubInput('你好', 'https://api.github.com')).toContain('非 ASCII')
    expect(validateGithubInput('ghp_abc', 'api.github.com')).toContain('http')
    expect(validateGithubInput('ghp_abc', 'https://镜像.com')).toContain('中文')
  })
})
