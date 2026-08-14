export type ThemeMode = 'system' | 'light' | 'dark'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

export interface AppConfig {
  version: 1
  theme: ThemeMode
  launchBehavior: {
    autoStartHarness: boolean
  }
  sidebarCollapsed: boolean
  closeToTray: boolean
  github: {
    apiBaseUrl: string
    allowInsecureTls: boolean
  }
  harness: {
    port: number
    dataDir: string
  }
  windowBounds: WindowBounds
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export type HarnessState = 'idle' | 'starting' | 'running' | 'reused' | 'error'

export interface HarnessStatus {
  state: HarnessState
  pid: number | null
  startedAt: number | null
  port: number
  url: string
  source: 'app' | 'external' | null
  error?: string
}

export interface GithubStatus {
  loggedIn: boolean
  username: string | null
}

export interface RepoSummary {
  id: number
  name: string
  fullName: string
  owner: string
  description: string | null
  stars: number
  forks: number
  language: string | null
  updatedAt: string
  htmlUrl: string
}

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
}

export interface FileContent {
  path: string
  content: string
  truncated: boolean
  sha: string
}

export interface IssueSummary {
  number: number
  title: string
  state: 'open' | 'closed'
  author: string
  createdAt: string
  labels: string[]
}

export interface GithubComment {
  author: string
  createdAt: string
  body: string
}

export interface IssueDetail extends IssueSummary {
  body: string
  comments: GithubComment[]
}

export interface PullSummary {
  number: number
  title: string
  state: 'open' | 'closed' | 'merged'
  author: string
  createdAt: string
  headBranch: string
  baseBranch: string
}

export interface PullDetail extends PullSummary {
  body: string
  additions: number
  deletions: number
  changedFiles: number
}

export interface CommitSummary {
  sha: string
  message: string
  author: string
  date: string
}

export interface CommitDetail extends CommitSummary {
  files: { filename: string; status: string; additions: number; deletions: number }[]
}

export interface RepoDetail {
  id: number
  name: string
  fullName: string
  owner: string
  description: string | null
  stars: number
  forks: number
  watchers: number
  language: string | null
  htmlUrl: string
  defaultBranch: string
}

export type RepoKind = 'mine' | 'starred'

export const IPC = {
  harnessGetStatus: 'harness:getStatus',
  harnessStart: 'harness:start',
  harnessStop: 'harness:stop',
  harnessRestart: 'harness:restart',
  harnessGetLogs: 'harness:getLogs',
  harnessStatusChanged: 'harness:status-changed',
  harnessLog: 'harness:log',
  githubSetToken: 'github:setToken',
  githubVerifyToken: 'github:verifyToken',
  githubClearToken: 'github:clearToken',
  githubGetStatus: 'github:getStatus',
  githubListRepos: 'github:listRepos',
  githubSearchRepos: 'github:searchRepos',
  githubGetRepo: 'github:getRepo',
  githubGetContents: 'github:getContents',
  githubSaveFile: 'github:saveFile',
  githubListIssues: 'github:listIssues',
  githubGetIssue: 'github:getIssue',
  githubListPulls: 'github:listPulls',
  githubGetPull: 'github:getPull',
  githubListCommits: 'github:listCommits',
  githubGetCommit: 'github:getCommit',
  configGet: 'config:get',
  configSet: 'config:set',
  backupCreate: 'backup:create',
  backupRestore: 'backup:restore',
  appOpenExternal: 'app:openExternal',
  appQuitReal: 'app:quitReal',
  appShowWindow: 'app:showWindow',
  appNavigate: 'app:navigate',
  appGetVersion: 'app:getVersion'
} as const

export interface WorkdeskApi {
  ping(): Promise<string>
  configGet(): Promise<AppConfig>
  configSet(patch: DeepPartial<AppConfig>): Promise<AppConfig>
  harnessGetStatus(): Promise<HarnessStatus>
  harnessStart(): Promise<HarnessStatus>
  harnessStop(): Promise<{ stoppedOwn: boolean }>
  harnessRestart(): Promise<HarnessStatus>
  harnessGetLogs(): Promise<string[]>
  onHarnessStatusChanged(cb: (s: HarnessStatus) => void): () => void
  onHarnessLog(cb: (line: string) => void): () => void
  githubGetStatus(): Promise<GithubStatus>
  githubSetToken(token: string): Promise<GithubStatus>
  githubVerifyToken(token: string): Promise<GithubStatus>
  githubClearToken(): Promise<GithubStatus>
  githubListRepos(kind: RepoKind): Promise<RepoSummary[]>
  githubSearchRepos(q: string): Promise<RepoSummary[]>
  githubGetRepo(owner: string, repo: string): Promise<RepoDetail>
  githubGetContents(owner: string, repo: string, path?: string): Promise<{ tree: FileNode[]; file: FileContent | null }>
  githubSaveFile(owner: string, repo: string, path: string, content: string, message: string, sha?: string): Promise<void>
  githubListIssues(owner: string, repo: string, state: 'open' | 'closed'): Promise<IssueSummary[]>
  githubGetIssue(owner: string, repo: string, number: number): Promise<IssueDetail>
  githubListPulls(owner: string, repo: string, state: 'open' | 'closed'): Promise<PullSummary[]>
  githubGetPull(owner: string, repo: string, number: number): Promise<PullDetail>
  githubListCommits(owner: string, repo: string): Promise<CommitSummary[]>
  githubGetCommit(owner: string, repo: string, sha: string): Promise<CommitDetail>
  backupCreate(destPath?: string): Promise<{ path: string }>
  backupRestore(srcPath: string): Promise<{ ok: boolean }>
  openExternal(url: string): Promise<void>
  quitReal(): Promise<void>
  showWindow(): Promise<void>
  onNavigate(cb: (panelId: string) => void): () => void
  getVersion(): Promise<string>
}
