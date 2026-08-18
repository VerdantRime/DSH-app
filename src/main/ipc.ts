import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { IPC, type StatsScalarField, type StatsMapField } from '../shared/types'
import { translateMarkdown } from './translate'
import { listDirEntries, readFileWithPath, writeTextFile, deleteFile, renameFile } from './ide-files'
import { detectToolchains } from './toolchain'
import { run, compile } from './runner'
import { tmpdir } from 'os'
import { join, extname } from 'path'
import { promises as fs } from 'fs'
import type { IdeRunRequest } from '../shared/types'
import { askWithModel, buildPromptTask, listModels } from './ai'
import { cloneRepo, repoNameFromUrl, validateCloneUrl } from './clone'
import { walkFiles, buildUploadPlan } from './upload-plan'
import { runEnvCheck } from './env-check'
import type { ConfigStore } from './store'
import type { HarnessManager } from './harness-manager'
import type { GithubService } from './github-service'
import type { StatsStore } from './stats-store'
import type { StatsTracker } from './stats-tracker'

export interface BackupApi {
  create: (destPath?: string) => Promise<{ path: string }>
  restore: (srcPath: string) => Promise<{ ok: boolean }>
}

export interface IpcDeps {
  store: ConfigStore
  harness: HarnessManager
  github: GithubService
  backup: BackupApi
  stats: StatsStore
  tracker: StatsTracker
  getWindow: () => BrowserWindow | null
  quit: () => void
  requestQuit: () => void
  hideToTray: () => void
}

export function registerIpc(deps: IpcDeps): void {
  // 配置
  ipcMain.handle(IPC.configGet, () => deps.store.get())
  ipcMain.handle(IPC.configSet, (_e, patch) => deps.store.set(patch))
  // 系统
  ipcMain.handle(IPC.appGetVersion, () => app.getVersion())
  ipcMain.handle(IPC.appOpenExternal, (_e, url: string) => shell.openExternal(url))
  ipcMain.handle(IPC.appTranslate, (_e, text: string) => translateMarkdown(text))
  ipcMain.handle(IPC.envCheck, async () => {
    const st = await deps.github.getStatus()
    return runEnvCheck({ dshHome: deps.store.get().harness.dataDir, githubLoggedIn: st.loggedIn })
  })
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
  ipcMain.handle(IPC.ideReadFile, (_e, p: string) => readFileWithPath(p))
  ipcMain.handle(IPC.ideListDir, (_e, p: string) => listDirEntries(p))
  ipcMain.handle(IPC.ideWriteFile, (_e, p: string, c: string, enc?: 'utf-8' | 'gbk') => writeTextFile(p, c, enc))
  ipcMain.handle(IPC.ideDeleteFile, (_e, p: string) => deleteFile(p))
  ipcMain.handle(IPC.ideRenameFile, async (_e, o: string, n: string) => ({ newPath: await renameFile(o, n) }))
  ipcMain.handle(IPC.idePickImage, async () => {
    const win = deps.getWindow()
    const opts: Electron.OpenDialogOptions = { properties: ['openFile'], filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }] }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? null : res.filePaths?.[0] ?? null
  })
  ipcMain.handle(IPC.ideSaveCustomWallpaper, async (_e, src: string) => {
    const ext = (extname(src) || '.png').toLowerCase()
    const dest = join(app.getPath('userData'), 'custom-wallpaper' + ext)
    await fs.copyFile(src, dest)
    return dest
  })
  ipcMain.handle(IPC.ideDetectTools, () => detectToolchains())
  ipcMain.handle(IPC.ideRun, (_e, req: IdeRunRequest) => {
    const ide = deps.store.get().ide
    return run({
      ...req,
      tools: {
        python: ide.pythonPath || undefined,
        gpp: ide.gccPath || undefined,
        javac: ide.javaPath || undefined,
        java: ide.javaPath || undefined
      }
    })
  })
  ipcMain.handle(IPC.ideRunTemp, (_e, fileName: string) => join(tmpdir(), 'dsh-ide', fileName))
  ipcMain.handle(IPC.ideCompile, (_e, req: { language: 'python' | 'cpp' | 'java'; targetPath: string }) => {
    const ide = deps.store.get().ide
    return compile({ ...req, interactive: false, tools: { python: ide.pythonPath || undefined, gpp: ide.gccPath || undefined, javac: ide.javaPath || undefined, java: ide.javaPath || undefined } })
  })
  ipcMain.handle(IPC.aiListModels, () => listModels(deps.store.get().harness.dataDir))
  ipcMain.handle(IPC.aiAsk, async (_e, req: { promptPath: string; model?: string; requestId?: string }) => {
    const task = buildPromptTask(req.promptPath)
    const dshHome = deps.store.get().harness.dataDir
    const text = await askWithModel(task, { dshHome, model: req.model }, (chunk) => {
      deps.getWindow()?.webContents.send(IPC.aiChunk, { requestId: req.requestId ?? '', chunk })
    })
    return { text }
  })
  ipcMain.handle(IPC.appShowWindow, () => deps.getWindow()?.show())
  ipcMain.handle(IPC.appQuitReal, () => deps.quit())
  ipcMain.handle(IPC.appQuitRequest, () => deps.requestQuit())
  ipcMain.handle(IPC.appHideToTray, () => deps.hideToTray())
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
  ipcMain.handle(IPC.githubCommitFiles, (_e, o, r, m, f) => deps.github.commitFiles(o, r, m, f))
  ipcMain.handle(IPC.githubPickFiles, async () => {
    const win = deps.getWindow()
    const opts: Electron.OpenDialogOptions = { properties: ['openFile', 'multiSelections'] }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? [] : res.filePaths
  })
  ipcMain.handle(IPC.githubPickFolder, async () => {
    const win = deps.getWindow()
    const opts: Electron.OpenDialogOptions = { properties: ['openDirectory'] }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? null : res.filePaths?.[0] ?? null
  })
  ipcMain.handle(IPC.githubScanUpload, async (_e, localPaths: string[], mode: 'files' | 'folder', baseRepoDir: string) => {
    let entries: { path: string; size: number }[] = []
    let rootDir = ''
    if (mode === 'folder') {
      rootDir = localPaths[0] ?? ''
      entries = await walkFiles(rootDir)
    } else {
      for (const p of localPaths) {
        const st = await fs.stat(p).catch(() => null)
        entries.push({ path: p, size: st?.size ?? 0 })
      }
    }
    return buildUploadPlan(entries, rootDir, baseRepoDir, mode)
  })
  ipcMain.handle(IPC.githubUploadBatch, (_e, o: string, r: string, m: string, files: { localPath: string; repoPath: string }[]) => deps.github.uploadBatch(o, r, m, files, (done, total) => deps.getWindow()?.webContents.send(IPC.githubUploadProgress, { done, total })))
  ipcMain.handle(IPC.gitClone, async (_e, url: string) => {
    const verr = validateCloneUrl(url)
    if (verr) return { ok: false, error: verr }
    const win = deps.getWindow()
    const opts: Electron.OpenDialogOptions = { properties: ['openDirectory'] }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (res.canceled || !res.filePaths[0]) return { ok: false }
    const dest = join(res.filePaths[0], repoNameFromUrl(url))
    try {
      await cloneRepo(url, dest)
      return { ok: true, dir: dest }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })
  ipcMain.handle(IPC.githubDownloadFiles, (_e, o, r, p, d) => deps.github.downloadFiles(o, r, p, d, (done, total) => deps.getWindow()?.webContents.send(IPC.githubDownloadProgress, { done, total })))
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
  // 统计
  ipcMain.handle(IPC.statsGet, () => deps.stats.get())
  ipcMain.handle(IPC.statsReset, () => deps.stats.reset())
  ipcMain.handle(IPC.statsBump, (_e, field: StatsScalarField, by?: number) => deps.stats.bump(field, by))
  ipcMain.handle(IPC.statsBumpMap, (_e, field: StatsMapField, key: string, by?: number) => deps.stats.bumpMap(field, key, by))
  ipcMain.handle(IPC.statsSetBucket, (_e, bucket, ctx) => deps.tracker.setBucket(bucket, ctx))
}
