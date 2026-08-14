import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type { WorkdeskApi, HarnessStatus } from '../shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: WorkdeskApi = {
  ping: () => Promise.resolve('pong'),
  configGet: () => ipcRenderer.invoke(IPC.configGet),
  configSet: (patch) => ipcRenderer.invoke(IPC.configSet, patch),
  harnessGetStatus: () => ipcRenderer.invoke(IPC.harnessGetStatus),
  harnessStart: () => ipcRenderer.invoke(IPC.harnessStart),
  harnessStop: () => ipcRenderer.invoke(IPC.harnessStop),
  harnessRestart: () => ipcRenderer.invoke(IPC.harnessRestart),
  harnessGetLogs: () => ipcRenderer.invoke(IPC.harnessGetLogs),
  onHarnessStatusChanged: (cb) => subscribe<HarnessStatus>(IPC.harnessStatusChanged, cb),
  onHarnessLog: (cb) => subscribe<string>(IPC.harnessLog, cb),
  githubGetStatus: () => ipcRenderer.invoke(IPC.githubGetStatus),
  githubSetToken: (token) => ipcRenderer.invoke(IPC.githubSetToken, token),
  githubVerifyToken: (token) => ipcRenderer.invoke(IPC.githubVerifyToken, token),
  githubClearToken: () => ipcRenderer.invoke(IPC.githubClearToken),
  githubListRepos: (kind) => ipcRenderer.invoke(IPC.githubListRepos, kind),
  githubSearchRepos: (q) => ipcRenderer.invoke(IPC.githubSearchRepos, q),
  githubGetRepo: (owner, repo) => ipcRenderer.invoke(IPC.githubGetRepo, owner, repo),
  githubGetContents: (owner, repo, path) => ipcRenderer.invoke(IPC.githubGetContents, owner, repo, path),
  githubListIssues: (owner, repo, state) => ipcRenderer.invoke(IPC.githubListIssues, owner, repo, state),
  githubGetIssue: (owner, repo, number) => ipcRenderer.invoke(IPC.githubGetIssue, owner, repo, number),
  githubListPulls: (owner, repo, state) => ipcRenderer.invoke(IPC.githubListPulls, owner, repo, state),
  githubGetPull: (owner, repo, number) => ipcRenderer.invoke(IPC.githubGetPull, owner, repo, number),
  githubListCommits: (owner, repo) => ipcRenderer.invoke(IPC.githubListCommits, owner, repo),
  githubGetCommit: (owner, repo, sha) => ipcRenderer.invoke(IPC.githubGetCommit, owner, repo, sha),
  backupCreate: (destPath) => ipcRenderer.invoke(IPC.backupCreate, destPath),
  backupRestore: (srcPath) => ipcRenderer.invoke(IPC.backupRestore, srcPath),
  openExternal: (url) => ipcRenderer.invoke(IPC.appOpenExternal, url),
  quitReal: () => ipcRenderer.invoke(IPC.appQuitReal),
  showWindow: () => ipcRenderer.invoke(IPC.appShowWindow),
  onNavigate: (cb) => subscribe<string>(IPC.appNavigate, cb),
  getVersion: () => ipcRenderer.invoke(IPC.appGetVersion)
}

contextBridge.exposeInMainWorld('api', api)
