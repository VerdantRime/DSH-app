/** 时长人性化：秒 / 分秒 / 小时分。 */
export function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  if (sec < 60) return sec + ' 秒'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return m + ' 分 ' + s + ' 秒'
  const h = Math.floor(m / 60)
  const mm = m % 60
  return h + ' 小时 ' + mm + ' 分'
}

/** 条形占比（0-100）。 */
export function barPct(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)))
}
