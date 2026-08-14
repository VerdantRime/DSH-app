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
}
