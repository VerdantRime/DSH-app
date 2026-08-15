import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import type { CredentialsStore } from './credentials'
import { GithubClient, type IGithubClient } from './github'
import type {
  GithubStatus,
  RepoKind,
  RepoSummary,
  RepoDetail,
  FileNode,
  FileContent,
  IssueSummary,
  IssueDetail,
  PullSummary,
  PullDetail,
  CommitSummary,
  CommitDetail
} from '../shared/types'

export class GithubService {
  private client: IGithubClient | null = null

  constructor(
    private readonly creds: CredentialsStore,
    private readonly factory: (token: string) => IGithubClient = (t) => new GithubClient(t)
  ) {}

  private async getClient(): Promise<IGithubClient> {
    if (this.client) return this.client
    const token = await this.creds.getToken()
    if (!token) throw new Error('NOT_CONFIGURED')
    this.client = this.factory(token)
    return this.client
  }

  async getStatus(): Promise<GithubStatus> {
    const username = await this.creds.getUsername()
    return { loggedIn: !!username, username }
  }

  async setToken(token: string): Promise<GithubStatus> {
    const probe = this.factory(token)
    const username = await probe.getAccount()
    await this.creds.setToken(token, username)
    this.client = probe
    return { loggedIn: true, username }
  }

  async verifyToken(token: string): Promise<GithubStatus> {
    const probe = this.factory(token)
    const username = await probe.getAccount()
    return { loggedIn: true, username }
  }

  async clearToken(): Promise<GithubStatus> {
    await this.creds.clear()
    this.client = null
    return { loggedIn: false, username: null }
  }

  async listRepos(kind: RepoKind): Promise<RepoSummary[]> {
    return (await this.getClient()).listRepos(kind)
  }

  async searchRepos(q: string): Promise<RepoSummary[]> {
    return (await this.getClient()).searchRepos(q)
  }

  async getRepo(owner: string, repo: string): Promise<RepoDetail> {
    return (await this.getClient()).getRepo(owner, repo)
  }

  async getContents(
    owner: string,
    repo: string,
    path?: string
  ): Promise<{ tree: FileNode[]; file: FileContent | null }> {
    return (await this.getClient()).getContents(owner, repo, path)
  }

  async listIssues(owner: string, repo: string, state: 'open' | 'closed'): Promise<IssueSummary[]> {
    return (await this.getClient()).listIssues(owner, repo, state)
  }

  async getIssue(owner: string, repo: string, number: number): Promise<IssueDetail> {
    return (await this.getClient()).getIssue(owner, repo, number)
  }

  async listPulls(owner: string, repo: string, state: 'open' | 'closed'): Promise<PullSummary[]> {
    return (await this.getClient()).listPulls(owner, repo, state)
  }

  async getPull(owner: string, repo: string, number: number): Promise<PullDetail> {
    return (await this.getClient()).getPull(owner, repo, number)
  }

  async listCommits(owner: string, repo: string): Promise<CommitSummary[]> {
    return (await this.getClient()).listCommits(owner, repo)
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<CommitDetail> {
    return (await this.getClient()).getCommit(owner, repo, sha)
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<void> {
    await (await this.getClient()).createOrUpdateFile(owner, repo, path, content, message, sha)
  }

  async deleteFile(owner: string, repo: string, path: string, message: string, sha: string): Promise<void> {
    await (await this.getClient()).deleteFile(owner, repo, path, message, sha)
  }

  async uploadFile(
    owner: string,
    repo: string,
    path: string,
    contentBase64: string,
    message: string,
    sha?: string
  ): Promise<void> {
    await (await this.getClient()).uploadFile(owner, repo, path, contentBase64, message, sha)
  }

  async downloadFile(owner: string, repo: string, path: string, destPath: string): Promise<void> {
    const buf = await (await this.getClient()).getRawFile(owner, repo, path)
    await fs.writeFile(destPath, buf)
  }

  async getReadme(owner: string, repo: string): Promise<import('../shared/types').ReadmeContent | null> {
    return (await this.getClient()).getReadme(owner, repo)
  }

  async listTreeFiles(owner: string, repo: string, dirPath?: string): Promise<string[]> {
    return (await this.getClient()).listTreeFiles(owner, repo, dirPath)
  }

  async downloadFiles(
    owner: string,
    repo: string,
    paths: string[],
    destDir: string
  ): Promise<{ saved: number; skipped: number }> {
    if (paths.length === 0) return { saved: 0, skipped: 0 }
    if (paths.length > 300) throw new Error('一次最多下载 300 个文件，请分批选择')
    const client = await this.getClient()
    let saved = 0
    let skipped = 0
    for (const p of paths) {
      const parts = p.split('/')
      if (!p || parts.includes('..') || p.includes('\\')) {
        skipped++
        continue
      }
      try {
        const buf = await client.getRawFile(owner, repo, p)
        const dest = join(destDir, p)
        await fs.mkdir(dirname(dest), { recursive: true })
        await fs.writeFile(dest, buf)
        saved++
      } catch {
        skipped++
      }
    }
    return { saved, skipped }
  }
}
