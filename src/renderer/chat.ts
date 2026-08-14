import { statusLabel, dotClass, metaText } from './harness-ui'
import type { HarnessStatus } from '../shared/types'

let webview: WebviewTag | null = null
let logLines: string[] = []
let loadedUrl = ''

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id)
  if (el) el.textContent = text
}

function renderStatus(s: HarnessStatus): void {
  const dot = document.getElementById('hc-dot')
  if (dot) dot.className = dotClass(s)
  setText('hc-status', statusLabel(s))
  setText('hc-meta', metaText(s, Date.now()))
  setText('status-harness', 'harness: ' + statusLabel(s))

  const sidebarDot = document.getElementById('harness-dot')
  if (sidebarDot) sidebarDot.className = dotClass(s)

  // 就绪后加载 harness 页面
  if (webview && (s.state === 'running' || s.state === 'reused') && loadedUrl !== s.url) {
    loadedUrl = s.url
    webview.src = s.url
  }
}

function renderLogs(): void {
  const pre = document.getElementById('hc-log')
  if (pre) pre.textContent = logLines.join('\n')
}

function bindButton(id: string, fn: () => void): void {
  document.getElementById(id)?.addEventListener('click', () => fn())
}

function bindButtons(): void {
  bindButton('hc-open', () => {
    void window.api.harnessGetStatus().then((s) => window.api.openExternal(s.url))
  })
  bindButton('hc-copy', () => {
    void window.api.harnessGetStatus().then((s) => copyText(s.url))
  })
  bindButton('hc-logtoggle', () => {
    document.getElementById('hc-logdrawer')?.classList.toggle('hidden')
  })
}

async function refresh(): Promise<void> {
  try {
    const s = await window.api.harnessGetStatus()
    renderStatus(s)
    logLines = await window.api.harnessGetLogs()
    renderLogs()
  } catch (e) {
    console.error('获取 harness 状态失败', e)
  }
}

export function initChat(): void {
  const host = document.getElementById('chat-webview-host')
  if (host) {
    webview = document.createElement('webview') as WebviewTag
    webview.setAttribute('partition', 'persist:harness')
    webview.setAttribute('allowpopups', 'false')
    ;(webview as any).addEventListener('will-navigate', (e: Event) => e.preventDefault())
    ;(webview as any).addEventListener('new-window', (e: { url?: string }) => {
      if (e.url) void window.api.openExternal(e.url)
    })
    host.appendChild(webview)
  }
  bindButtons()
  window.api.onHarnessStatusChanged(renderStatus)
  window.api.onHarnessLog((line) => {
    logLines.push(line)
    if (logLines.length > 2000) logLines = logLines.slice(-2000)
    renderLogs()
  })
  void refresh()
}

// webview 是独立原生视图，会盖在其它面板之上；切走时必须显式隐藏
export function setChatVisible(visible: boolean): void {
  if (webview) {
    webview.style.display = visible ? 'flex' : 'none'
  }
}
