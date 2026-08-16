import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { StatsStore } from '../src/main/stats-store'

let dir: string
beforeEach(async () => { dir = await fs.mkdtemp(join(tmpdir(), 'dsh-stats-')) })
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }) })

describe('StatsStore', () => {
  it('bump 同时累加总计与会话', async () => {
    const s = new StatsStore(join(dir, 'stats.json'))
    await s.load()
    s.bump('compiles')
    s.bump('compiles')
    const snap = s.get()
    expect(snap.totals.compiles).toBe(2)
    expect(snap.session.compiles).toBe(2)
  })

  it('bumpMap 按 key 累加', async () => {
    const s = new StatsStore(join(dir, 'stats.json'))
    await s.load()
    s.bumpMap('byFileErrors', 'a.cpp', 3)
    s.bumpMap('byFileErrors', 'a.cpp', 1)
    expect(s.get().totals.byFileErrors['a.cpp']).toBe(4)
  })

  it('tick 累加活跃时长并按桶分配', async () => {
    const s = new StatsStore(join(dir, 'stats.json'))
    await s.load()
    s.tick('code', 5000, { file: 'a.cpp', lang: 'cpp' })
    const snap = s.get()
    expect(snap.totals.activeMs).toBe(5000)
    expect(snap.totals.codeMs).toBe(5000)
    expect(snap.totals.byFile['a.cpp']).toBe(5000)
    expect(snap.totals.byLang['cpp']).toBe(5000)
    expect(snap.totals.chatMs).toBe(0)
  })

  it('reset 清零', async () => {
    const s = new StatsStore(join(dir, 'stats.json'))
    await s.load()
    s.bump('runs')
    s.reset()
    expect(s.get().totals.runs).toBe(0)
    expect(s.get().session.runs).toBe(0)
  })

  it('持久化总计，重载后会话清零', async () => {
    const p = join(dir, 'stats.json')
    const s = new StatsStore(p)
    await s.load()
    s.bump('launches')
    await s.flush()
    const s2 = new StatsStore(p)
    await s2.load()
    const snap = s2.get()
    expect(snap.totals.launches).toBe(1)
    expect(snap.session.launches).toBe(0)
  })
})
