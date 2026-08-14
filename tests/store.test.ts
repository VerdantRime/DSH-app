import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ConfigStore, defaultConfig } from '../src/main/store'

let dir: string

beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'dsh-store-'))
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('ConfigStore', () => {
  it('缺失文件时返回默认值', async () => {
    const store = new ConfigStore(join(dir, 'config.json'))
    const cfg = await store.load()
    expect(cfg.theme).toBe('system')
    expect(cfg.harness.port).toBe(3080)
    expect(cfg.sidebarCollapsed).toBe(false)
    expect(cfg.closeToTray).toBe(true)
    expect(cfg.github.apiBaseUrl).toBe('https://api.github.com')
  })

  it('顶层与嵌套修改都能跨实例持久化', async () => {
    const p = join(dir, 'config.json')
    const s1 = new ConfigStore(p)
    await s1.load()
    s1.set({ theme: 'dark', sidebarCollapsed: true })
    s1.set({ harness: { port: 4000 } })
    await s1.flush()

    const s2 = new ConfigStore(p)
    const cfg = await s2.load()
    expect(cfg.theme).toBe('dark')
    expect(cfg.sidebarCollapsed).toBe(true)
    expect(cfg.harness.port).toBe(4000)
    expect(cfg.harness.dataDir).toBe(defaultConfig().harness.dataDir)
  })

  it('配置文件损坏时回退默认值且不抛错', async () => {
    const p = join(dir, 'config.json')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(p, '{ 不是合法 json', 'utf-8')
    const store = new ConfigStore(p)
    const cfg = await store.load()
    expect(cfg.theme).toBe('system')
  })
})
