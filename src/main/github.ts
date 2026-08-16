import { Octokit } from '@octokit/rest'
import type {
  RepoSummary,
  RepoDetail,
  FileNode,
  FileContent,
  ReadmeContent,
  IssueSummary,
  IssueDetail,
  PullSummary,
  PullDetail,
  CommitSummary,
  CommitDetail,
  GithubComment,
  RepoKind
} from '../shared/types'

// ---------- 纯映射函数（可单测） ----------

export function mapRepoSummary(r: any): RepoSummary {
  return {
    id: r.id ?? 0,
    name: r.name ?? '',
    fullName: r.full_name ?? '',
    owner: r.owner?.login ?? '',
    description: r.description ?? null,
    stars: r.stargazers_count ?? 0,
    forks: r.forks_count ?? 0,
    language: r.language ?? null,
    updatedAt: r.updated_at ?? '',
    htmlUrl: r.html_url ?? ''
  }
}

export function mapRepoDetail(r: any): RepoDetail {
  return {
    id: r.id ?? 0,
    name: r.name ?? '',
    fullName: r.full_name ?? '',
    owner: r.owner?.login ?? '',
    description: r.description ?? null,
    stars: r.stargazers_count ?? 0,
    forks: r.forks_count ?? 0,
    watchers: r.watchers_count ?? 0,
    language: r.language ?? null,
    htmlUrl: r.html_url ?? '',
    defaultBranch: r.default_branch ?? 'main',
    canPush: r.permissions?.push === true
  }
}

export function mapFileNode(e: any): FileNode {
  return { name: e.name ?? '', path: e.path ?? '', type: e.type === 'dir' ? 'dir' : 'file', size: e.size ?? 0 }
}

/** 文件浏览器排序：文件夹置顶、同组按名称字母序；不修改原数组。 */
export function sortFileTree(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function mapIssueSummary(i: any): IssueSummary {
  return {
    number: i.number ?? 0,
    title: i.title ?? '',
    state: i.state === 'open' ? 'open' : 'closed',
    author: i.user?.login ?? '',
    createdAt: i.created_at ?? '',
    labels: Array.isArray(i.labels) ? i.labels.map((l: any) => l.name ?? '').filter(Boolean) : []
  }
}

export function mapComment(c: any): GithubComment {
  return { author: c.user?.login ?? '', createdAt: c.created_at ?? '', body: c.body ?? '' }
}

export function mapIssueDetail(i: any, comments: any[]): IssueDetail {
  return { ...mapIssueSummary(i), body: i.body ?? '', comments: (comments ?? []).map(mapComment) }
}

export function mapPullSummary(p: any): PullSummary {
  return {
    number: p.number ?? 0,
    title: p.title ?? '',
    state: p.merged ? 'merged' : p.state === 'closed' ? 'closed' : 'open',
    author: p.user?.login ?? '',
    createdAt: p.created_at ?? '',
    headBranch: p.head?.ref ?? '',
    baseBranch: p.base?.ref ?? ''
  }
}

export function mapPullDetail(p: any): PullDetail {
  return {
    ...mapPullSummary(p),
    body: p.body ?? '',
    additions: p.additions ?? 0,
    deletions: p.deletions ?? 0,
    changedFiles: p.changed_files ?? 0
  }
}

export function mapCommitSummary(c: any): CommitSummary {
  return {
    sha: c.sha ?? '',
    message: c.commit?.message ?? '',
    author: c.commit?.author?.name ?? (c.author?.login ?? ''),
    date: c.commit?.author?.date ?? ''
  }
}

export function mapCommitDetail(c: any): CommitDetail {
  const files = Array.isArray(c.files)
    ? c.files.map((f: any) => ({
        filename: f.filename ?? '',
        status: f.status ?? '',
        additions: f.additions ?? 0,
        deletions: f.deletions ?? 0
      }))
    : []
  return { ...mapCommitSummary(c), files }
}

// ---------- 客户端接口与实现 ----------

export interface IGithubClient {
  getAccount(): Promise<string>
  listRepos(kind: RepoKind): Promise<RepoSummary[]>
  searchRepos(q: string): Promise<RepoSummary[]>
  getRepo(owner: string, repo: string): Promise<RepoDetail>
  getContents(owner: string, repo: string, path?: string): Promise<{ tree: FileNode[]; file: FileContent | null }>
  listIssues(owner: string, repo: string, state: 'open' | 'closed'): Promise<IssueSummary[]>
  getIssue(owner: string, repo: string, number: number): Promise<IssueDetail>
  listPulls(owner: string, repo: string, state: 'open' | 'closed'): Promise<PullSummary[]>
  getPull(owner: string, repo: string, number: number): Promise<PullDetail>
  listCommits(owner: string, repo: string): Promise<CommitSummary[]>
  getCommit(owner: string, repo: string, sha: string): Promise<CommitDetail>
  createOrUpdateFile(owner: string, repo: string, path: string, content: string, message: string, sha?: string): Promise<void>
  deleteFile(owner: string, repo: string, path: string, message: string, sha: string): Promise<void>
  uploadFile(owner: string, repo: string, path: string, contentBase64: string, message: string, sha?: string): Promise<void>
  getRawFile(owner: string, repo: string, path: string): Promise<Buffer>
  getReadme(owner: string, repo: string): Promise<ReadmeContent | null>
  listTreeFiles(owner: string, repo: string, dirPath?: string): Promise<string[]>
  createCommit(owner: string, repo: string, message: string, files: { path: string; content: string }[]): Promise<void>
  createCommitBase64(owner: string, repo: string, message: string, files: { path: string; contentBase64: string }[], onProgress?: (done: number, total: number) => void): Promise<void>
}

export const DEFAULT_GITHUB_API = 'https://api.github.com'

export interface GithubClientOptions {
  baseUrl?: string
  octokit?: Octokit
}

function hasNonAscii(s: string): boolean {
  for (const ch of s) {
    if (ch.charCodeAt(0) > 127) return true
  }
  return false
}

export function validateGithubInput(token: string, baseUrl: string): string | null {
  if (token.trim().length === 0 || hasNonAscii(token)) {
    return 'GitHub token 无效或含非 ASCII 字符，请粘贴正确的 Personal Access Token'
  }
  if ((!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) || hasNonAscii(baseUrl)) {
    return 'GitHub API 地址无效，需以 http:// 或 https:// 开头且不含中文'
  }
  return null
}

export class GithubClient implements IGithubClient {
  readonly baseUrl: string
  private readonly octokit: Octokit

  constructor(token: string, options: GithubClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_GITHUB_API
    const err = validateGithubInput(token, this.baseUrl)
    if (err) throw new Error(err)
    this.octokit = options.octokit ?? new Octokit({ auth: token, baseUrl: this.baseUrl })
  }

  async getAccount(): Promise<string> {
    const res = await this.octokit.rest.users.getAuthenticated()
    return (res.data as any).login ?? ''
  }

  async listRepos(kind: RepoKind): Promise<RepoSummary[]> {
    const per_page = 100
    const res =
      kind === 'mine'
        ? await this.octokit.rest.repos.listForAuthenticatedUser({ sort: 'updated', per_page })
        : await this.octokit.rest.activity.listReposStarredByAuthenticatedUser({ per_page })
    return (res.data as any[]).map(mapRepoSummary)
  }

  async searchRepos(q: string): Promise<RepoSummary[]> {
    const res = await this.octokit.rest.search.repos({ q, per_page: 30 })
    return ((res.data as any).items ?? []).map(mapRepoSummary)
  }

  async getRepo(owner: string, repo: string): Promise<RepoDetail> {
    const res = await this.octokit.rest.repos.get({ owner, repo })
    return mapRepoDetail(res.data)
  }

  async getContents(
    owner: string,
    repo: string,
    path = ''
  ): Promise<{ tree: FileNode[]; file: FileContent | null }> {
    const res = await this.octokit.rest.repos.getContent({ owner, repo, path })
    const data = res.data as any
    if (Array.isArray(data)) {
      return { tree: sortFileTree(data.map(mapFileNode)), file: null }
    }
    const content =
      data && data.encoding === 'base64' && data.content
        ? Buffer.from(data.content, 'base64').toString('utf-8')
        : ''
    return {
      tree: [],
      file: { path: data?.path ?? path, content, truncated: (data?.size ?? 0) > 1000000, sha: data?.sha ?? '' }
    }
  }

  async listIssues(owner: string, repo: string, state: 'open' | 'closed'): Promise<IssueSummary[]> {
    const res = await this.octokit.rest.issues.listForRepo({ owner, repo, state, per_page: 50 })
    return (res.data as any[]).map(mapIssueSummary)
  }

  async getIssue(owner: string, repo: string, number: number): Promise<IssueDetail> {
    const res = await this.octokit.rest.issues.get({ owner, repo, issue_number: number })
    const comments = await this.octokit.rest.issues.listComments({ owner, repo, issue_number: number })
    return mapIssueDetail(res.data, comments.data as any[])
  }

  async listPulls(owner: string, repo: string, state: 'open' | 'closed'): Promise<PullSummary[]> {
    const res = await this.octokit.rest.pulls.list({ owner, repo, state, per_page: 50 })
    return (res.data as any[]).map(mapPullSummary)
  }

  async getPull(owner: string, repo: string, number: number): Promise<PullDetail> {
    const res = await this.octokit.rest.pulls.get({ owner, repo, pull_number: number })
    return mapPullDetail(res.data)
  }

  async listCommits(owner: string, repo: string): Promise<CommitSummary[]> {
    const res = await this.octokit.rest.repos.listCommits({ owner, repo, per_page: 50 })
    return (res.data as any[]).map(mapCommitSummary)
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<CommitDetail> {
    const res = await this.octokit.rest.repos.getCommit({ owner, repo, ref: sha })
    return mapCommitDetail(res.data)
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content, 'utf-8').toString('base64')
    }
    if (sha) payload.sha = sha
    await this.octokit.rest.repos.createOrUpdateFileContents(payload as any)
  }

  /** 读取文件原始字节（支持二进制下载）。小文件走 getContent；>1MB 改用 Git Blob 接口（上限 100MB）。 */
  async getRawFile(owner: string, repo: string, path: string): Promise<Buffer> {
    const res = await this.octokit.rest.repos.getContent({ owner, repo, path })
    const data = res.data as any
    if (!data || !data.path) throw new Error('文件不存在或无法读取')
    if (data.encoding === 'base64' && typeof data.content === 'string') {
      return Buffer.from(data.content, 'base64')
    }
    // 超过 1MB：getContent 不再返回正文，改用 Git Blob 接口按 sha 拉取（二进制安全，上限 100MB）
    const sha = data.sha
    if (!sha) throw new Error('无法读取该文件（可能是目录或空文件）')
    const blob = await this.octokit.rest.git.getBlob({ owner, repo, file_sha: sha })
    const bd = blob.data as any
    if (bd?.encoding === 'base64' && typeof bd.content === 'string') {
      return Buffer.from(bd.content, 'base64')
    }
    throw new Error('文件过大（超过 100MB）或为 LFS 文件，请在网页端下载')
  }

  /** README（任意大小写文件名均可命中），仓库没有 README 时返回 null。 */
  async getReadme(owner: string, repo: string): Promise<ReadmeContent | null> {
    try {
      const res = await this.octokit.rest.repos.getReadme({ owner, repo })
      const data = res.data as any
      const content =
        data && data.encoding === 'base64' && typeof data.content === 'string'
          ? Buffer.from(data.content, 'base64').toString('utf-8')
          : ''
      return { name: data?.name ?? 'README', path: data?.path ?? '', content }
    } catch (e: any) {
      if (e?.status === 404) return null
      throw e
    }
  }

  /** 列出仓库（或某目录下）所有文件路径，用于多文件/整目录下载。 */
  async listTreeFiles(owner: string, repo: string, dirPath = ''): Promise<string[]> {
    const res = await this.octokit.rest.git.getTree({ owner, repo, tree_sha: 'HEAD', recursive: 'true' })
    const data = res.data as any
    const items = Array.isArray(data?.tree) ? data.tree : []
    return items
      .filter((t: any) => t.type === 'blob' && (dirPath === '' || t.path === dirPath || t.path.startsWith(dirPath + '/')))
      .map((t: any) => t.path)
  }

  /** 通过 Git Data API 把多个文件合并成一次 commit（新建/覆盖）。 */
  async createCommit(
    owner: string,
    repo: string,
    message: string,
    files: { path: string; content: string }[]
  ): Promise<void> {
    if (files.length === 0) return
    const repoInfo = await this.octokit.rest.repos.get({ owner, repo })
    const branch = (repoInfo.data as any).default_branch ?? 'main'
    const ref = await this.octokit.rest.git.getRef({ owner, repo, ref: 'heads/' + branch })
    const baseCommitSha = (ref.data as any).object.sha as string
    const commit = await this.octokit.rest.git.getCommit({ owner, repo, commit_sha: baseCommitSha })
    const baseTree = (commit.data as any).tree.sha as string
    const entries: { path: string; mode: '100644'; type: 'blob'; sha: string }[] = []
    for (const f of files) {
      const blob = await this.octokit.rest.git.createBlob({
        owner,
        repo,
        content: Buffer.from(f.content, 'utf-8').toString('base64'),
        encoding: 'base64'
      })
      entries.push({ path: f.path, mode: '100644', type: 'blob', sha: (blob.data as any).sha as string })
    }
    const tree = await this.octokit.rest.git.createTree({ owner, repo, base_tree: baseTree, tree: entries })
    const newCommit = await this.octokit.rest.git.createCommit({
      owner,
      repo,
      message,
      tree: (tree.data as any).sha as string,
      parents: [baseCommitSha]
    })
    await this.octokit.rest.git.updateRef({ owner, repo, ref: 'heads/' + branch, sha: (newCommit.data as any).sha as string })
  }

  /** 通过 Git Data API 把多个二进制文件（base64）合并成一次 commit，逐文件回调进度。 */
  async createCommitBase64(
    owner: string,
    repo: string,
    message: string,
    files: { path: string; contentBase64: string }[],
    onProgress?: (done: number, total: number) => void
  ): Promise<void> {
    if (files.length === 0) return
    const repoInfo = await this.octokit.rest.repos.get({ owner, repo })
    const branch = (repoInfo.data as any).default_branch ?? 'main'
    const ref = await this.octokit.rest.git.getRef({ owner, repo, ref: 'heads/' + branch })
    const baseCommitSha = (ref.data as any).object.sha as string
    const commit = await this.octokit.rest.git.getCommit({ owner, repo, commit_sha: baseCommitSha })
    const baseTree = (commit.data as any).tree.sha as string
    const entries: { path: string; mode: '100644'; type: 'blob'; sha: string }[] = []
    let done = 0
    for (const f of files) {
      const blob = await this.octokit.rest.git.createBlob({ owner, repo, content: f.contentBase64, encoding: 'base64' })
      entries.push({ path: f.path, mode: '100644', type: 'blob', sha: (blob.data as any).sha as string })
      done++
      onProgress?.(done, files.length)
    }
    const tree = await this.octokit.rest.git.createTree({ owner, repo, base_tree: baseTree, tree: entries })
    const newCommit = await this.octokit.rest.git.createCommit({
      owner,
      repo,
      message,
      tree: (tree.data as any).sha as string,
      parents: [baseCommitSha]
    })
    await this.octokit.rest.git.updateRef({ owner, repo, ref: 'heads/' + branch, sha: (newCommit.data as any).sha as string })
  }

  async deleteFile(owner: string, repo: string, path: string, message: string, sha: string): Promise<void> {
    await this.octokit.rest.repos.deleteFile({ owner, repo, path, message, sha })
  }

  /** 上传文件：contentBase64 已编码（支持二进制），文件已存在时须传 sha 覆盖。 */
  async uploadFile(
    owner: string,
    repo: string,
    path: string,
    contentBase64: string,
    message: string,
    sha?: string
  ): Promise<void> {
    const payload: Record<string, unknown> = { owner, repo, path, message, content: contentBase64 }
    if (sha) payload.sha = sha
    await this.octokit.rest.repos.createOrUpdateFileContents(payload as any)
  }
}
