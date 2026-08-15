import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { IPC } from '../shared/types'
import { translateMarkdown } from './translate'
import { listDirEntries, readTextFile, writeTextFile } from './ide-files'
import type { ConfigStore } from './store'
import type { HarnessManager } from './harness-manager'
import type { GithubService } from './github-service'

export interface BackupApi {
  create: (destPath?: string) => Promise<{ path: string }>
  restore: (srcPath: string) => Promise<{ ok: boolean }>
}

export interface IpcDeps {
  store: ConfigStore
  harness: HarnessManager
  github: GithubService
  backup: BackupApi
  getWindow: () => BrowserWindow | null
  quit: () => void
}

export function registerIpc(deps: IpcDeps): void {
  // 配置
  ipcMain.handle(IPC.configGet, () => deps.store.get())
  ipcMain.handle(IPC.configSet, (_e, patch) => deps.store.set(patch))
  // 系统
  ipcMain.handle(IPC.appGetVersion, () => app.getVersion())
  ipcMain.handle(IPC.appOpenExternal, (_e, url: string) => shell.openExternal(url))
  ipcMain.handle(IPC.appTranslate, (_e, text: string) => translateMarkdown(text))
  // IDE 文件系统
  ipcMain.handle(IPC.ideOpenFiles, async () => {
    const win = deps.getWindow()
    const opts: Electron.OpenDialogOptions = { properties: ['openFile', 'multiSelections'] }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? [] : res.filePaths
  })
  ipcMain.handle(IPC.ideOpenFolder, async () => {
    const win = deps.getWindow()
    const opts: Electron.OpenDialogOptions = { properties: ['openDirectory'] }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? null : res.filePaths?.[0] ?? null
  })
  ipcMain.handle(IPC.ideSaveFileDialog, async (_e, defaultName: string) => {
    const win = deps.getWindow()
    const opts: Electron.SaveDialogOptions = { defaultPath: defaultName }
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    return res.canceled ? null : res.filePath ?? null
  })
  ipcMain.handle(IPC.ideReadFile, (_e, p: string) => readTextFile(p))
  ipcMain.handle(IPC.ideListDir, (_e, p: string) => listDirEntries(p))
  ipcMain.handle(IPC.ideWriteFile, (_e, p: string, c: string) => writeTextFile(p, c))
  ipcMain.handle(IPC.appShowWindow, () => deps.getWindow()?.show())
  ipcMain.handle(IPC.appQuitReal, () => deps.quit())
  // harness
  ipcMain.handle(IPC.harnessGetStatus, () => deps.harness.getStatus())
  ipcMain.handle(IPC.harnessStart, () => deps.harness.start())
  ipcMain.handle(IPC.harnessStop, () => deps.harness.stop())
  ipcMain.handle(IPC.harnessRestart, () => deps.harness.restart())
  ipcMain.handle(IPC.harnessGetLogs, () => deps.harness.getLogs())
  // GitHub（只读）
  ipcMain.handle(IPC.githubGetStatus, () => deps.github.getStatus())
  ipcMain.handle(IPC.githubSetToken, (_e, token: string) => deps.github.setToken(token))
  ipcMain.handle(IPC.githubVerifyToken, (_e, token: string) => deps.github.verifyToken(token))
  ipcMain.handle(IPC.githubClearToken, () => deps.github.clearToken())
  ipcMain.handle(IPC.githubListRepos, (_e, kind) => deps.github.listRepos(kind))
  ipcMain.handle(IPC.githubSearchRepos, (_e, q) => deps.github.searchRepos(q))
  ipcMain.handle(IPC.githubGetRepo, (_e, o, r) => deps.github.getRepo(o, r))
  ipcMain.handle(IPC.githubGetContents, (_e, o, r, p) => deps.github.getContents(o, r, p))
  ipcMain.handle(IPC.githubListIssues, (_e, o, r, s) => deps.github.listIssues(o, r, s))
  ipcMain.handle(IPC.githubGetIssue, (_e, o, r, n) => deps.github.getIssue(o, r, n))
  ipcMain.handle(IPC.githubListPulls, (_e, o, r, s) => deps.github.listPulls(o, r, s))
  ipcMain.handle(IPC.githubGetPull, (_e, o, r, n) => deps.github.getPull(o, r, n))
  ipcMain.handle(IPC.githubListCommits, (_e, o, r) => deps.github.listCommits(o, r))
  ipcMain.handle(IPC.githubGetCommit, (_e, o, r, sha) => deps.github.getCommit(o, r, sha))
  ipcMain.handle(IPC.githubSaveFile, (_e, o, r, p, c, m, s) => deps.github.createOrUpdateFile(o, r, p, c, m, s))
  ipcMain.handle(IPC.githubDeleteFile, (_e, o, r, p, m, s) => deps.github.deleteFile(o, r, p, m, s))
  ipcMain.handle(IPC.githubUploadFile, (_e, o, r, p, c, m, s) => deps.github.uploadFile(o, r, p, c, m, s))
  ipcMain.handle(IPC.githubDownloadFile, (_e, o, r, p, d) => deps.github.downloadFile(o, r, p, d))
  ipcMain.handle(IPC.githubGetReadme, (_e, o, r) => deps.github.getReadme(o, r))
  ipcMain.handle(IPC.githubListTree, (_e, o, r, d) => deps.github.listTreeFiles(o, r, d))
  ipcMain.handle(IPC.githubDownloadFiles, (_e, o, r, p, d) => deps.github.downloadFiles(o, r, p, d))
  ipcMain.handle(IPC.githubPickSaveDir, async () => {
    const win = deps.getWindow()
    const opts: Electron.OpenDialogOptions = { properties: ['openDirectory', 'createDirectory'] }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? null : res.filePaths?.[0] ?? null
  })
  ipcMain.handle(IPC.githubPickSavePath, async (_e, defaultName: string) => {
    const win = deps.getWindow()
    const opts = { defaultPath: defaultName }
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    return res.canceled ? null : res.filePath ?? null
  })
  // 备份/恢复
  ipcMain.handle(IPC.backupCreate, (_e, destPath?: string) => deps.backup.create(destPath))
  ipcMain.handle(IPC.backupRestore, (_e, srcPath: string) => deps.backup.restore(srcPath))
}
