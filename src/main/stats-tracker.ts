import { powerMonitor, type BrowserWindow } from 'electron'
import type { StatsStore } from './stats-store'
import type { StatsBucket, StatsCtx } from '../shared/types'
import { isActiveByFlags, TICK_MS } from './stats-active'

/** 活跃计时器：每 5s 判定一次，活跃才累计到 stats，并按当前场景（code/chat）分桶。 */
export class StatsTracker {
  private bucket: StatsBucket = null
  private ctx: StatsCtx = {}
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly store: StatsStore,
    private readonly getWindow: () => BrowserWindow | null
  ) {}

  setBucket(bucket: StatsBucket, ctx: StatsCtx = {}): void {
    this.bucket = bucket
    this.ctx = ctx
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }

  private tick(): void {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return
    const active = isActiveByFlags({
      focused: win.isFocused(),
      minimized: win.isMinimized(),
      visible: win.isVisible(),
      idleMs: powerMonitor.getSystemIdleTime() * 1000
    })
    if (!active) return
    this.store.tick(this.bucket, TICK_MS, this.ctx)
  }
}
