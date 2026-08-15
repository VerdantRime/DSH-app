import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import type { AppConfig, DeepPartial } from '../shared/types'

export function defaultConfig(): AppConfig {
  return {
    version: 1,
    theme: 'system',
    launchBehavior: { autoStartHarness: true },
    sidebarCollapsed: false,
    closeToTray: true,
    github: { apiBaseUrl: 'https://api.github.com', allowInsecureTls: false },
    ide: { pythonPath: '', gccPath: '', javaPath: '', layout: { treeWidth: 200, aiWidth: 320, outputHeight: 160 } },
    harness: { port: 3080, dataDir: join(homedir(), '.dsh') },
    windowBounds: { x: 0, y: 0, width: 1200, height: 800, maximized: false }
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * 配置持久化：读写 config.json，防抖落盘（原子写：先写 .tmp 再 rename）。
 * 纯 Node 实现，不依赖 Electron，便于单测。
 */
export class ConfigStore {
  private config: AppConfig
  private readonly path: string
  private writeTimer: NodeJS.Timeout | null = null

  constructor(filePath: string) {
    this.path = filePath
    this.config = defaultConfig()
  }

  async load(): Promise<AppConfig> {
    try {
      const raw = await fs.readFile(this.path, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppConfig>
      this.config = this.merge(this.config, parsed)
    } catch {
      // 文件不存在或损坏：保留默认值
    }
    return this.get()
  }

  get(): AppConfig {
    return structuredClone(this.config)
  }

  set(patch: DeepPartial<AppConfig>): AppConfig {
    this.config = this.merge(this.config, patch)
    this.scheduleWrite()
    return this.get()
  }

  async flush(): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
    }
    await this.writeNow()
  }

  private scheduleWrite(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null
      void this.writeNow()
    }, 200)
  }

  private async writeNow(): Promise<void> {
    await fs.mkdir(dirname(this.path), { recursive: true })
    const tmp = this.path + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(this.config, null, 2), 'utf-8')
    await fs.rename(tmp, this.path)
  }

  private merge(base: AppConfig, patch: DeepPartial<AppConfig>): AppConfig {
    const out = { ...(base as unknown as Record<string, unknown>) }
    const p = patch as unknown as Record<string, unknown>
    const b = base as unknown as Record<string, unknown>
    for (const key of Object.keys(p)) {
      const pv = p[key]
      if (pv === undefined) continue
      const bv = b[key]
      if (isPlainObject(bv) && isPlainObject(pv)) {
        out[key] = { ...bv, ...pv }
      } else {
        out[key] = pv
      }
    }
    return out as unknown as AppConfig
  }
}
