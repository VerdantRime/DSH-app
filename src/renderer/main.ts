import { PANELS, DEFAULT_PANEL, isPanelId, type PanelId } from './panels'
import { initChat, setChatVisible } from './chat'
import { initGithub } from './github'
import { initSettings } from './settings'

let current: PanelId = DEFAULT_PANEL
let collapsed = false

function buildNav(): void {
  const nav = document.getElementById('nav')
  if (!nav) return
  for (const p of PANELS) {
    const btn = document.createElement('button')
    btn.className = 'nav-item'
    btn.dataset.panel = p.id
    const icon = document.createElement('span')
    icon.className = 'nav-icon'
    icon.textContent = p.icon
    const label = document.createElement('span')
    label.className = 'nav-label'
    label.textContent = p.label
    btn.appendChild(icon)
    btn.appendChild(label)
    btn.addEventListener('click', () => select(p.id))
    nav.appendChild(btn)
  }
}

function select(id: PanelId): void {
  current = id
  for (const p of PANELS) {
    const el = document.getElementById('panel-' + p.id)
    el?.classList.toggle('hidden', p.id !== id)
  }
  document.querySelectorAll('.nav-item').forEach((n) => {
    n.classList.toggle('active', (n as HTMLElement).dataset.panel === id)
  })
  setChatVisible(id === 'chat')
}

function applyCollapse(): void {
  document.getElementById('sidebar')?.classList.toggle('collapsed', collapsed)
}

async function init(): Promise<void> {
  buildNav()
  try {
    const cfg = await window.api.configGet()
    collapsed = cfg.sidebarCollapsed
    applyCollapse()
  } catch (e) {
    console.error('读取配置失败', e)
  }
  const btn = document.getElementById('collapse-btn')
  btn?.addEventListener('click', () => {
    collapsed = !collapsed
    applyCollapse()
    window.api.configSet({ sidebarCollapsed: collapsed }).catch(() => {})
  })
  document.addEventListener('dsh:navigate', (e) => {
    const id = (e as CustomEvent).detail as PanelId
    if (isPanelId(id)) select(id)
  })
  window.api.onNavigate((panelId) => {
    if (isPanelId(panelId)) select(panelId)
  })
  initChat()
  initGithub()
  initSettings()
  select(DEFAULT_PANEL)
}

void init()
