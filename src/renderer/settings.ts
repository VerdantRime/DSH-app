import { resolveTheme, themeLabel } from './theme'
import { GITHUB_TOKEN_URL, TOKEN_HELP_STEPS } from './github-help'
import type { AppConfig, ThemeMode, GithubStatus } from '../shared/types'

let cfg: AppConfig | null = null

export function applyTheme(mode: ThemeMode): void {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.dataset.theme = resolveTheme(mode, dark)
}

function h(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text !== undefined) e.textContent = text
  return e
}

function btn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.className = 'btn'
  b.textContent = label
  b.addEventListener('click', onClick)
  return b
}

function section(title: string): HTMLElement {
  const s = h('section', 'set-section')
  s.appendChild(h('h3', 'set-title', title))
  return s
}

export async function initSettings(): Promise<void> {
  try {
    cfg = await window.api.configGet()
  } catch {
    cfg = null
  }
  if (cfg) applyTheme(cfg.theme)
  render()
}

function render(): void {
  const panel = document.getElementById('panel-settings')
  if (!panel) return
  panel.replaceChildren()
  panel.appendChild(renderGeneral())
  panel.appendChild(renderGithub())
  panel.appendChild(renderHarness())
  panel.appendChild(renderAbout())
}

function renderGeneral(): HTMLElement {
  const s = section('通用')
  const themeRow = h('div', 'set-row')
  themeRow.appendChild(h('span', 'set-label', '主题'))
  const modes: ThemeMode[] = ['system', 'light', 'dark']
  for (const m of modes) {
    const b = btn(themeLabel(m), () => {
      if (!cfg) return
      cfg.theme = m
      applyTheme(m)
      void window.api.configSet({ theme: m })
      render()
    })
    b.classList.toggle('active', cfg?.theme === m)
    themeRow.appendChild(b)
  }
  s.appendChild(themeRow)

  const launchRow = h('div', 'set-row')
  launchRow.appendChild(h('span', 'set-label', '启动时自动启动 harness'))
  const cb = document.createElement('input')
  cb.type = 'checkbox'
  cb.checked = cfg?.launchBehavior.autoStartHarness ?? true
  cb.addEventListener('change', () => {
    void window.api.configSet({ launchBehavior: { autoStartHarness: cb.checked } })
  })
  launchRow.appendChild(cb)
  s.appendChild(launchRow)

  const closeRow = h('div', 'set-row')
  closeRow.appendChild(h('span', 'set-label', '关闭窗口后最小化到托盘（后台运行）'))
  const cc = document.createElement('input')
  cc.type = 'checkbox'
  cc.checked = cfg?.closeToTray ?? true
  cc.addEventListener('change', () => {
    void window.api.configSet({ closeToTray: cc.checked })
  })
  closeRow.appendChild(cc)
  s.appendChild(closeRow)
  return s
}

function renderGithub(): HTMLElement {
  const s = section('GitHub（只读）')
  const statusEl = h('div', 'set-note', '加载中…')
  statusEl.id = 'gh-status-line'
  s.appendChild(statusEl)

  const help = h('div', 'gh-token-help')
  for (const step of TOKEN_HELP_STEPS) {
    help.appendChild(h('div', 'set-note', step))
  }
  help.appendChild(btn('打开 GitHub Token 页面', () => {
    void window.api.openExternal(GITHUB_TOKEN_URL)
  }))
  s.appendChild(help)

  const row = h('div', 'set-row')
  const input = document.createElement('input')
  input.type = 'password'
  input.placeholder = '只读 Personal Access Token'
  input.className = 'gh-search'
  const save = btn('保存并验证', () => {
    const token = input.value.trim()
    if (!token) return
    void window.api
      .githubSetToken(token)
      .then(() => {
        input.value = ''
        void refreshGithubStatus()
      })
      .catch((e) => {
        statusEl.textContent = '验证失败：' + (e instanceof Error ? e.message : String(e))
      })
  })
  const clearBtn = btn('清除', () => {
    void window.api.githubClearToken().then(() => void refreshGithubStatus())
  })
  row.appendChild(input)
  row.appendChild(save)
  row.appendChild(clearBtn)
  s.appendChild(row)
  void refreshGithubStatus()
  return s
}

async function refreshGithubStatus(): Promise<void> {
  const el = document.getElementById('gh-status-line')
  if (!el) return
  try {
    const st: GithubStatus = await window.api.githubGetStatus()
    el.textContent = st.loggedIn ? '已登录：' + st.username : '未登录'
  } catch {
    el.textContent = '未登录'
  }
}

function renderHarness(): HTMLElement {
  const s = section('Harness')
  s.appendChild(h('div', 'set-note', '端口：' + (cfg?.harness.port ?? 3080)))
  s.appendChild(h('div', 'set-note', 'DSH_HOME：' + (cfg?.harness.dataDir ?? '')))
  const row = h('div', 'set-row')
  row.appendChild(btn('启动', () => { void window.api.harnessStart() }))
  row.appendChild(btn('停止', () => { void window.api.harnessStop() }))
  row.appendChild(btn('重启', () => { void window.api.harnessRestart() }))
  s.appendChild(row)

  const bakRow = h('div', 'set-row')
  const bakResult = h('span', 'set-note', '')
  bakRow.appendChild(btn('创建备份', () => {
    void window.api.backupCreate().then((r) => { bakResult.textContent = '备份已创建：' + r.path })
  }))
  bakRow.appendChild(bakResult)
  s.appendChild(bakRow)

  const restRow = h('div', 'set-row')
  const restInput = document.createElement('input')
  restInput.className = 'gh-search'
  restInput.placeholder = '恢复：粘贴备份 zip 路径'
  restRow.appendChild(restInput)
  restRow.appendChild(btn('恢复', () => {
    const p = restInput.value.trim()
    if (!p) return
    void window.api.backupRestore(p).then(() => { bakResult.textContent = '恢复完成，请重启应用生效' })
  }))
  s.appendChild(restRow)
  return s
}

function renderAbout(): HTMLElement {
  const s = section('关于')
  s.appendChild(h('div', 'set-note', 'DeepSeek工作台 v1.0.0'))
  s.appendChild(h('div', 'set-note', '数据目录：应用数据目录（%APPDATA%） + ' + (cfg?.harness.dataDir ?? '~/.dsh')))
  return s
}
