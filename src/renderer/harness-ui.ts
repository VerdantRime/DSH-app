import type { HarnessStatus } from '../shared/types'

export function statusLabel(status: HarnessStatus): string {
  switch (status.state) {
    case 'idle':
      return '未启动'
    case 'starting':
      return '启动中…'
    case 'running':
      return '运行中'
    case 'reused':
      return '复用外部'
    case 'error':
      return '出错'
    default:
      return status.state
  }
}

export function dotClass(status: HarnessStatus): string {
  return 'dot dot-' + status.state
}

export function formatUptime(startedAt: number | null, now: number): string {
  if (!startedAt) return '—'
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return s + 's'
  return m + 'm ' + s + 's'
}

export function metaText(status: HarnessStatus, now: number): string {
  const parts: string[] = []
  if (status.pid) parts.push('PID ' + status.pid)
  parts.push('端口 ' + status.port)
  parts.push('运行 ' + formatUptime(status.startedAt, now))
  if (status.source === 'external') parts.push('外部实例')
  return parts.join(' · ')
}
