import { app, BrowserWindow, type Tray } from 'electron'
import { join } from 'path'
import { ConfigStore } from './store'
import { createMainWindow } from './window'
import { createTray } from './tray'
import { registerIpc } from './ipc'
import { HarnessManager } from './harness-manager'
import { RollingLogger } from './logger'
import { createBackupService } from './backup-service'
import { CredentialsStore } from './credentials'
import { createSafeStorageCipher } from './secret'
import { GithubService } from './github-service'
import { GithubClient } from './github'
import { shouldHideToTray } from './close-behavior'
import { IPC, type AppConfig } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let cleanedUp = false
let store: ConfigStore | null = null
let harness: HarnessManager | null = null
let logger: RollingLogger | null = null

function buildHarnessManager(cfg: AppConfig): HarnessManager {
  return new HarnessManager({
    port: cfg.harness.port,
    command: 'npx.cmd',
    args: ['@deepseek-ai/dsh', 'web', '--host', '127.0.0.1', '--port', String(cfg.harness.port)],
    env: { ...process.env, DSH_HOME: cfg.harness.dataDir },
    shell: true,
    healthTimeoutMs: 60000,
    healthIntervalMs: 500
  })
}

function saveBounds(): void {
  if (!mainWindow || !store) return
  const b = mainWindow.getBounds()
  store.set({
    windowBounds: {
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      maximized: mainWindow.isMaximized()
    }
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
    }
  })

  app.whenReady().then(async () => {
    const userData = app.getPath('userData')
    store = new ConfigStore(join(userData, 'config.json'))
    await store.load()
    const cfg = store.get()

    // 本地代理/镜像常带自签证书；勾选后忽略证书校验（不校验证书有安全风险）
    if (cfg.github.allowInsecureTls) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    harness = buildHarnessManager(cfg)
    logger = new RollingLogger(join(userData, 'harness.log'))
    const backup = createBackupService(userData, cfg.harness.dataDir)
    const creds = new CredentialsStore(join(userData, 'github.json'), createSafeStorageCipher())
    const github = new GithubService(creds, (token) => new GithubClient(token, { baseUrl: store?.get()?.github?.apiBaseUrl ?? 'https://api.github.com' }))

    registerIpc({
      store,
      harness,
      github,
      backup,
      getWindow: () => mainWindow,
      quit: () => {
        isQuitting = true
        app.quit()
      }
    })

    mainWindow = createMainWindow(cfg.windowBounds)

    harness.on('status-changed', (s) => mainWindow?.webContents.send(IPC.harnessStatusChanged, s))
    harness.on('log', (line) => {
      logger?.append(line)
      mainWindow?.webContents.send(IPC.harnessLog, line)
    })

    try {
      tray = createTray(mainWindow, () => {
        isQuitting = true
        app.quit()
      })
    } catch (e) {
      console.error('托盘创建失败（忽略，继续运行）', e)
    }

    mainWindow.on('close', (e) => {
      if (shouldHideToTray(store?.get()?.closeToTray ?? true, isQuitting)) {
        e.preventDefault()
        mainWindow?.hide()
      }
    })
    mainWindow.on('resize', saveBounds)
    mainWindow.on('move', saveBounds)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow(store!.get().windowBounds)
      } else {
        mainWindow?.show()
      }
    })

    if (cfg.launchBehavior.autoStartHarness) {
      void harness.start()
    }
  })

  app.on('before-quit', (e) => {
    if (cleanedUp) return
    e.preventDefault()
    void (async () => {
      try {
        // 只停止本 app 启动的 harness（ownPid）；复用外部的不动
        if (harness) await harness.stop()
      } finally {
        await store?.flush()
        cleanedUp = true
        app.quit()
      }
    })()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
