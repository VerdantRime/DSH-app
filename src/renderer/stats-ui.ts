import type { StatsSnapshot, StatsCounters } from '../shared/types'
import { formatDuration, barPct } from './stats-format'

function h(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text !== undefined) e.textContent = text
  return e
}

function twoCol(label: string, total: string, session: string): HTMLElement {
  const r = h('div', 'stats-row')
  r.appendChild(h('span', 'stats-label', label))
  r.appendChild(h('span', 'stats-num', total))
  r.appendChild(h('span', 'stats-num', session))
  return r
}

function oneRow(label: string, value: string): HTMLElement {
  const r = h('div', 'stats-row')
  r.appendChild(h('span', 'stats-label', label))
  r.appendChild(h('span', 'stats-num', value))
  return r
}

function sum(v: Record<string, number>): number {
  return Object.values(v).reduce((a, b) => a + b, 0)
}

function mapBars(items: Record<string, number>): HTMLElement[] {
  const entries = Object.entries(items).sort((a, b) => b[1] - a[1])
  const max = entries.length ? entries[0][1] : 0
  return entries.map(([name, val]) => {
    const r = h('div', 'stats-bar-row')
    r.appendChild(h('span', 'stats-bar-name', name))
    const track = h('div', 'stats-bar-track')
    const fill = h('div', 'stats-bar-fill')
    fill.style.width = barPct(val, max) + '%'
    track.appendChild(fill)
    r.appendChild(track)
    r.appendChild(h('span', 'stats-bar-val', formatDuration(val)))
    return r
  })
}

function closeStatsView(): void { document.getElementById('stats-view')?.remove() }

export async function openStatsView(): Promise<void> {
  let snap: StatsSnapshot
  try { snap = await window.api.statsGet() } catch (e) { window.alert('读取统计失败：' + (e instanceof Error ? e.message : String(e))); return }
  const t = snap.totals
  const s = snap.session
  closeStatsView()

  const overlay = h('div', 'stats-overlay')
  overlay.id = 'stats-view'
  const box = h('div', 'stats-box')
  const head = h('div', 'stats-head')
  head.appendChild(h('span', 'stats-head-title', '统计信息'))
  const resetBtn = h('button', 'btn', '重置统计')
  resetBtn.addEventListener('click', () => {
    if (!window.confirm('确定清空全部统计（总计 + 本次）吗？')) return
    void window.api.statsReset().then(() => void openStatsView())
  })
  head.appendChild(resetBtn)
  const close = h('button', 'stats-close', '×')
  close.addEventListener('click', closeStatsView)
  head.appendChild(close)
  box.appendChild(head)

  const body = h('div', 'stats-body')
  const thead = h('div', 'stats-row stats-head-row')
  thead.appendChild(h('span', 'stats-label', '项目'))
  thead.appendChild(h('span', 'stats-num', '总计'))
  thead.appendChild(h('span', 'stats-num', '本次'))
  body.appendChild(thead)
  body.appendChild(twoCol('累计活跃时长', formatDuration(t.activeMs), formatDuration(s.activeMs)))
  body.appendChild(twoCol('编码时长', formatDuration(t.codeMs), formatDuration(s.codeMs)))
  body.appendChild(twoCol('AI 对话时长', formatDuration(t.chatMs), formatDuration(s.chatMs)))
  body.appendChild(twoCol('编译次数', String(t.compiles), String(s.compiles)))
  body.appendChild(twoCol('运行次数', String(t.runs), String(s.runs)))
  body.appendChild(twoCol('保存（手动）', String(t.savesManual), String(s.savesManual)))
  body.appendChild(twoCol('保存（自动）', String(t.savesAuto), String(s.savesAuto)))
  body.appendChild(twoCol('AI 解释', String(t.aiExplain), String(s.aiExplain)))
  body.appendChild(twoCol('AI 找错', String(t.aiDebug), String(s.aiDebug)))
  body.appendChild(twoCol('AI 优化', String(t.aiOptimize), String(s.aiOptimize)))
  body.appendChild(twoCol('AI 对话', String(t.aiChat), String(s.aiChat)))
  body.appendChild(twoCol('应用到编辑器', String(t.aiApply), String(s.aiApply)))
  body.appendChild(twoCol('启动次数', String(t.launches), String(s.launches)))

  body.appendChild(h('div', 'stats-sub', '编码时长（按文件 · 总计）'))
  const fileBars = mapBars(t.byFile)
  if (fileBars.length === 0) body.appendChild(h('div', 'stats-empty', '暂无数据'))
  else fileBars.forEach((b) => body.appendChild(b))

  body.appendChild(h('div', 'stats-sub', '编码时长（按语言 · 总计）'))
  const langBars = mapBars(t.byLang)
  if (langBars.length === 0) body.appendChild(h('div', 'stats-empty', '暂无数据'))
  else langBars.forEach((b) => body.appendChild(b))

  body.appendChild(h('div', 'stats-sub', '编译错误（按文件）'))
  const errEntries = Object.entries(t.byFileErrors).sort((a, b) => b[1] - a[1])
  if (errEntries.length === 0) body.appendChild(h('div', 'stats-empty', '暂无数据'))
  else for (const [name, val] of errEntries) body.appendChild(twoCol(name, String(val), String(s.byFileErrors[name] ?? 0)))

  box.appendChild(body)
  overlay.appendChild(box)
  document.body.appendChild(overlay)
}

export async function showExitSummary(): Promise<void> {
  document.getElementById('exit-summary')?.remove()
  let snap: StatsSnapshot | null = null
  try { snap = await window.api.statsGet() } catch { /* 忽略 */ }
  const s: StatsCounters | undefined = snap?.session

  const overlay = h('div', 'stats-overlay')
  overlay.id = 'exit-summary'
  const box = h('div', 'stats-box stats-exit')
  box.appendChild(h('div', 'stats-head-title', '本次会话总结'))
  const body = h('div', 'stats-body')
  if (!s) body.appendChild(h('div', 'stats-empty', '读取统计失败'))
  else {
    body.appendChild(oneRow('累计活跃时长', formatDuration(s.activeMs)))
    body.appendChild(oneRow('编码时长', formatDuration(s.codeMs)))
    body.appendChild(oneRow('AI 对话时长', formatDuration(s.chatMs)))
    body.appendChild(oneRow('编译次数', String(s.compiles)))
    body.appendChild(oneRow('编译错误总数', String(sum(s.byFileErrors))))
    body.appendChild(oneRow('运行次数', String(s.runs)))
    body.appendChild(oneRow('保存（手动 / 自动）', s.savesManual + ' / ' + s.savesAuto))
    body.appendChild(oneRow('AI 使用次数', String(s.aiExplain + s.aiDebug + s.aiOptimize + s.aiChat)))
    body.appendChild(oneRow('应用到编辑器', String(s.aiApply)))
  }
  box.appendChild(body)
  const actions = h('div', 'ui-dialog-actions')
  const quitBtn = h('button', 'btn primary', '退出应用')
  quitBtn.addEventListener('click', () => void window.api.quitReal())
  const keepBtn = h('button', 'btn', '继续使用（最小化到托盘）')
  keepBtn.addEventListener('click', () => { overlay.remove(); void window.api.hideToTray() })
  actions.appendChild(quitBtn)
  actions.appendChild(keepBtn)
  box.appendChild(actions)
  overlay.appendChild(box)
  document.body.appendChild(overlay)
}
