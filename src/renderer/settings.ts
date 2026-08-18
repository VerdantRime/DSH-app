import { resolveTheme, themeLabel } from './theme'
import { WALLPAPERS, resolveWallpaper } from './wallpapers'
import { GITHUB_TOKEN_URL, TOKEN_HELP_STEPS } from './github-help'
import { openStatsView } from './stats-ui'
import { showOnboarding } from './onboarding'
import type { AppConfig, ThemeMode, GithubStatus, ToolchainReport } from '../shared/types'

let cfg: AppConfig | null = null
let randomWallpaper: string | null = null

export function applyTheme(mode: ThemeMode): void {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.dataset.theme = resolveTheme(mode, dark)
}

export function applyWallpaper(mode: ThemeMode, wallpaperId: string): void {
  const layer = document.getElementById('wallpaper-layer')
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  let url: string | null = null
  if (resolveTheme(mode, dark) === 'anime' && wallpaperId !== 'none') {
    if (wallpaperId === 'custom' && cfg?.wallpaperCustomPath) {
      url = 'file:///' + cfg.wallpaperCustomPath.replace(/\\/g, '/')
    } else if (wallpaperId === 'random') {
      if (!randomWallpaper) randomWallpaper = resolveWallpaper('random')
      url = randomWallpaper
    } else {
      url = resolveWallpaper(wallpaperId)
    }
  }
  if (url && layer) {
    document.documentElement.style.setProperty('--wallpaper', 'url("' + url + '")')
    layer.classList.remove('hidden')
  } else {
    document.documentElement.style.setProperty('--wallpaper', 'none')
    layer?.classList.add('hidden')
  }
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
  if (cfg) applyWallpaper(cfg.theme, cfg.wallpaper)
  render()
}

function render(): void {
  const panel = document.getElementById('panel-settings')
  if (!panel) return
  panel.replaceChildren()
  panel.appendChild(renderGeneral())
  panel.appendChild(renderIde())
  panel.appendChild(renderGithub())
  panel.appendChild(renderHarness())
  panel.appendChild(renderStatsSection())
  panel.appendChild(renderHelpSection())
  panel.appendChild(renderAbout())
}

async function pickCustomWallpaper(wpSel: HTMLSelectElement): Promise<void> {
  if (!cfg) return
  try {
    const src = await window.api.idePickImage()
    if (!src) { wpSel.value = cfg.wallpaper; return }
    const dest = await window.api.ideSaveCustomWallpaper(src)
    cfg.wallpaper = 'custom'
    cfg.wallpaperCustomPath = dest
    await window.api.configSet({ wallpaper: 'custom', wallpaperCustomPath: dest })
    wpSel.value = 'custom'
    applyWallpaper(cfg.theme, 'custom')
  } catch (e) {
    window.alert('上传背景失败：' + (e instanceof Error ? e.message : String(e)))
    wpSel.value = cfg.wallpaper
  }
}

function renderGeneral(): HTMLElement {
  const s = section('通用')
  const themeRow = h('div', 'set-row')
  themeRow.appendChild(h('span', 'set-label', '主题'))
  const modes: ThemeMode[] = ['system', 'light', 'dark', 'anime']
  for (const m of modes) {
    const b = btn(themeLabel(m), () => {
      if (!cfg) return
      cfg.theme = m
      applyTheme(m)
      applyWallpaper(m, cfg.wallpaper)
      void window.api.configSet({ theme: m })
      render()
    })
    b.classList.toggle('active', cfg?.theme === m)
    themeRow.appendChild(b)
  }
  s.appendChild(themeRow)

  const wpRow = h('div', 'set-row')
  wpRow.appendChild(h('span', 'set-label', '二次元壁纸'))
  const wpSel = document.createElement('select')
  wpSel.className = 'gh-search'
  const wpOpts: { id: string; label: string }[] = [
    { id: 'none', label: '无壁纸（纯色渐变）' },
    { id: 'random', label: '随机' },
    ...WALLPAPERS.map((w) => ({ id: w.id, label: w.label })),
    { id: 'custom', label: '自定义（上传图片）' }
  ]
  for (const o of wpOpts) { const e = document.createElement('option'); e.value = o.id; e.textContent = o.label; wpSel.appendChild(e) }
  wpSel.value = cfg?.wallpaper ?? 'random'
  wpSel.addEventListener('change', () => {
    if (!cfg) return
    if (wpSel.value === 'custom') {
      void pickCustomWallpaper(wpSel)
      return
    }
    cfg.wallpaper = wpSel.value
    void window.api.configSet({ wallpaper: wpSel.value })
    applyWallpaper(cfg.theme, wpSel.value)
  })
  wpRow.appendChild(wpSel)
  const upBtn = btn('上传图片', () => void pickCustomWallpaper(wpSel))
  wpRow.appendChild(upBtn)
  s.appendChild(wpRow)
  s.appendChild(h('div', 'set-note', '仅「二次元」主题生效'))

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

function renderIde(): HTMLElement {
  const s = section('IDE 工具链')
  const statusEl = h('div', 'set-note', '检测中…')
  statusEl.id = 'ide-tools-status'
  s.appendChild(statusEl)

  const mkInput = (id: string, label: string, ph: string): HTMLElement => {
    const row = h('div', 'set-row')
    row.appendChild(h('span', 'set-label', label))
    const input = document.createElement('input')
    input.className = 'gh-search'
    input.placeholder = ph
    input.id = id
    row.appendChild(input)
    row.appendChild(btn('保存路径', () => {
      const v = input.value.trim()
      void window.api.configSet({ ide: { pythonPath: id === 'ide-python-path' ? v : cfg?.ide.pythonPath ?? '', gccPath: id === 'ide-gcc-path' ? v : cfg?.ide.gccPath ?? '', javaPath: id === 'ide-java-path' ? v : cfg?.ide.javaPath ?? '' } })
    }))
    return row
  }

  s.appendChild(mkInput('ide-python-path', 'Python', '留空自动检测，如 C:\\...\\python.exe'))
  s.appendChild(mkInput('ide-gcc-path', 'GCC(g++)', '留空自动检测，如 C:\\...\\mingw64\\bin'))
  s.appendChild(mkInput('ide-java-path', 'JDK(javac)', '留空自动检测，如 C:\\...\\jdk-21\\bin'))
  s.appendChild(btn('重新检测', () => void refreshToolchain()))
  void refreshToolchain()
  return s
}

function toolStatus(t: { found: boolean; version: string }): string {
  return t.found ? '已检测 ✓ 版本 ' + t.version : '未检测到'
}

async function refreshToolchain(): Promise<void> {
  const el = document.getElementById('ide-tools-status')
  if (!el) return
  el.textContent = '检测中…'
  try {
    const r: ToolchainReport = await window.api.ideDetectTools()
    el.textContent = ''
    el.appendChild(h('div', '', 'Python：' + toolStatus(r.python)))
    el.appendChild(h('div', '', 'C/C++（GCC）：' + toolStatus(r.gcc)))
    el.appendChild(h('div', '', 'Java：' + toolStatus(r.java) + (r.java.found ? '' : '（未检测到 JDK，Java 暂不可用）')))
  } catch (e) {
    el.textContent = '检测失败：' + (e instanceof Error ? e.message : String(e))
  }
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

  const urlRow = h('div', 'set-row')
  urlRow.appendChild(h('span', 'set-label', 'GitHub API 地址'))
  const urlInput = document.createElement('input')
  urlInput.className = 'gh-search'
  urlInput.placeholder = 'https://api.github.com'
  urlInput.value = cfg?.github.apiBaseUrl ?? 'https://api.github.com'
  urlRow.appendChild(urlInput)
  urlRow.appendChild(btn('保存', () => {
    const v = urlInput.value.trim()
    if (v) void window.api.configSet({ github: { apiBaseUrl: v } })
  }))
  s.appendChild(urlRow)
  s.appendChild(h('div', 'set-note', '国内网络访问 GitHub 不稳定时，可填入镜像/代理地址'))

  const tlsRow = h('div', 'set-row')
  tlsRow.appendChild(h('span', 'set-label', '忽略 SSL 证书校验'))
  const tlsCb = document.createElement('input')
  tlsCb.type = 'checkbox'
  tlsCb.checked = cfg?.github.allowInsecureTls ?? false
  tlsCb.addEventListener('change', () => {
    void window.api.configSet({ github: { allowInsecureTls: tlsCb.checked } })
  })
  tlsRow.appendChild(tlsCb)
  s.appendChild(tlsRow)
  s.appendChild(h('div', 'set-note', '出现「证书校验失败」时勾选，重启后生效（不校验证书有一定安全风险）'))

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
  save.classList.add('primary')
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

function renderStatsSection(): HTMLElement {
  const s = section('统计信息')
  const row = h('div', 'set-row')
  row.appendChild(btn('打开统计信息', () => void openStatsView()))
  s.appendChild(row)
  s.appendChild(h('div', 'set-note', '记录编码时长、编译错误次数、AI 对话时长等；退出应用时也会显示本次总结'))
  return s
}

function helpItem(title: string, desc: string): HTMLElement {
  const d = h('div', 'help-item')
  d.appendChild(h('div', 'help-title', title))
  d.appendChild(h('div', 'help-desc', desc))
  return d
}

function renderHelpSection(): HTMLElement {
  const s = section('使用帮助')
  const help = h('div', 'help-box')
  help.appendChild(helpItem('聊天（harness）', '内嵌 DeepSeek Harness 网页。首次打开按页面提示填写你的 DeepSeek API Key（需先装 Node.js）。'))
  help.appendChild(helpItem('代码（IDE）', '内置 Monaco 编辑器：多标签、自动保存（15s）、编译/运行 C/C++/Python/Java。编译运行需本机装对应工具链，可在「IDE 工具链」里手动指定路径。'))
  help.appendChild(helpItem('AI 助手', '选中代码后点「解释 / 找错 / 优化」，或在右侧输入框直接提问；答案流式逐字输出，默认模型 deepseek-v4-flash。'))
  help.appendChild(helpItem('GitHub', '在「设置 → GitHub」粘贴 Personal Access Token（只读可浏览，读写才能上传/新建）。支持上传文件夹、批量下载、克隆仓库。'))
  help.appendChild(helpItem('统计信息', '记录编码时长、编译出错次数、AI 对话时长等；退出应用时显示本次总结。'))
  s.appendChild(help)
  const row = h('div', 'set-row')
  row.appendChild(btn('环境自检', () => void runEnvCheckInHelp()))
  row.appendChild(btn('重新打开引导', () => showOnboarding()))
  s.appendChild(row)
  const result = h('div', 'help-check', '')
  result.id = 'help-check'
  s.appendChild(result)
  return s
}

async function runEnvCheckInHelp(): Promise<void> {
  const el = document.getElementById('help-check')
  if (!el) return
  el.replaceChildren(h('div', 'set-note', '检测中…'))
  try {
    const env = await window.api.envCheck()
    el.replaceChildren()
    for (const it of env.items) {
      const row = h('div', 'help-check-item')
      row.appendChild(h('span', 'onboard-ok ' + (it.ok ? 'ok' : 'no'), it.ok ? '✓' : '✗'))
      const col = h('div', 'onboard-item-col')
      col.appendChild(h('div', 'onboard-item-label', it.label))
      col.appendChild(h('div', 'onboard-item-detail', it.detail))
      if (!it.ok && it.hint) col.appendChild(h('div', 'onboard-item-hint', it.hint))
      row.appendChild(col)
      el.appendChild(row)
    }
  } catch (e) {
    el.replaceChildren(h('div', 'set-note', '检测失败：' + (e instanceof Error ? e.message : String(e))))
  }
}

function renderAbout(): HTMLElement {
  const s = section('关于')
  s.appendChild(h('div', 'set-note', 'DeepSeek工作台 v3.4.2'))
  s.appendChild(h('div', 'set-note', '数据目录：应用数据目录（%APPDATA%） + ' + (cfg?.harness.dataDir ?? '~/.dsh')))
  return s
}
