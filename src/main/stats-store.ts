import { promises as fs } from 'fs'
import { dirname } from 'path'
import type { StatsCounters, StatsSnapshot, StatsScalarField, StatsMapField, StatsBucket } from '../shared/types'

export function emptyCounters(): StatsCounters {
  return {
    activeMs: 0, codeMs: 0, chatMs: 0, launches: 0, compiles: 0, runs: 0,
    savesManual: 0, savesAuto: 0, aiExplain: 0, aiDebug: 0, aiOptimize: 0, aiChat: 0, aiApply: 0,
    byFile: {}, byLang: {}, byFileErrors: {}
  }
}

/** 统计持久化：stats.json，防抖落盘（原子写）。总计永久累计，会话每次启动清零。 */
export class StatsStore {
  private data: StatsSnapshot
  private readonly path: string
  private writeTimer: NodeJS.Timeout | null = null

  constructor(filePath: string) {
    this.path = filePath
    this.data = { totals: emptyCounters(), session: emptyCounters(), sessionStartTs: Date.now() }
  }

  async load(): Promise<StatsSnapshot> {
    try {
      const raw = await fs.readFile(this.path, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<StatsSnapshot>
      this.data = {
        totals: { ...emptyCounters(), ...(parsed.totals ?? {}) },
        session: emptyCounters(),
        sessionStartTs: Date.now()
      }
    } catch {
      this.data = { totals: emptyCounters(), session: emptyCounters(), sessionStartTs: Date.now() }
    }
    return this.get()
  }

  get(): StatsSnapshot {
    return structuredClone(this.data)
  }

  bump(field: StatsScalarField, by = 1): StatsSnapshot {
    this.data.totals[field] += by
    this.data.session[field] += by
    this.scheduleWrite()
    return this.get()
  }

  bumpMap(field: StatsMapField, key: string, by = 1): StatsSnapshot {
    if (!key) return this.get()
    this.data.totals[field][key] = (this.data.totals[field][key] ?? 0) + by
    this.data.session[field][key] = (this.data.session[field][key] ?? 0) + by
    this.scheduleWrite()
    return this.get()
  }

  tick(bucket: StatsBucket, elapsedMs: number, ctx?: { file?: string; lang?: string }): StatsSnapshot {
    const ms = Math.max(0, Math.round(elapsedMs))
    if (ms === 0) return this.get()
    this.data.totals.activeMs += ms
    this.data.session.activeMs += ms
    if (bucket === 'code') {
      this.data.totals.codeMs += ms
      this.data.session.codeMs += ms
      if (ctx?.file) {
        this.data.totals.byFile[ctx.file] = (this.data.totals.byFile[ctx.file] ?? 0) + ms
        this.data.session.byFile[ctx.file] = (this.data.session.byFile[ctx.file] ?? 0) + ms
      }
      if (ctx?.lang) {
        this.data.totals.byLang[ctx.lang] = (this.data.totals.byLang[ctx.lang] ?? 0) + ms
        this.data.session.byLang[ctx.lang] = (this.data.session.byLang[ctx.lang] ?? 0) + ms
      }
    } else if (bucket === 'chat') {
      this.data.totals.chatMs += ms
      this.data.session.chatMs += ms
    }
    this.scheduleWrite()
    return this.get()
  }

  reset(): StatsSnapshot {
    this.data = { totals: emptyCounters(), session: emptyCounters(), sessionStartTs: Date.now() }
    this.scheduleWrite()
    return this.get()
  }

  async flush(): Promise<void> {
    if (this.writeTimer) { clearTimeout(this.writeTimer); this.writeTimer = null }
    await this.writeNow()
  }

  private scheduleWrite(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = setTimeout(() => { this.writeTimer = null; void this.writeNow() }, 200)
  }

  private async writeNow(): Promise<void> {
    await fs.mkdir(dirname(this.path), { recursive: true })
    const tmp = this.path + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(this.data, null, 2), 'utf-8')
    await fs.rename(tmp, this.path)
  }
}
