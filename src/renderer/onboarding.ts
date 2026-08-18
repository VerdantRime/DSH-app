import type { EnvCheckResult } from '../shared/types'

function h(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text !== undefined) e.textContent = text
  return e
}

let overlay: HTMLElement | null = null

function close(): void {
  overlay?.remove()
  overlay = null
}

function markDone(): void {
  void window.api.configSet({ onboarded: true })
  close()
}

/** 首次启动分步引导。 */
export function showOnboarding(): void {
  close()
  overlay = h('div', 'stats-overlay')
  overlay.id = 'onboarding'
  const box = h('div', 'stats-box onboard-box')
  overlay.appendChild(box)
  document.body.appendChild(overlay)
  renderWelcome(box)
}

function renderWelcome(box: HTMLElement): void {
  box.replaceChildren()
  box.appendChild(h('div', 'stats-head-title', '欢迎使用 DeepSeek工作台'))
  const body = h('div', 'stats-body onboard-body')
  body.appendChild(h('p', 'onboard-p', '集成 DeepSeek Harness 聊天、AI 代码助手、GitHub 与本地 IDE（编译运行 C/C++/Python/Java）的桌面工作台。'))
  body.appendChild(h('p', 'onboard-p', '首次使用建议先做一次环境检查，确认 Node.js、工具链、AI 密钥等是否就绪。'))
  box.appendChild(body)
  const actions = h('div', 'ui-dialog-actions')
  const next = h('button', 'btn primary', '开始环境检查')
  next.addEventListener('click', () => renderCheck(box))
  const skip = h('button', 'btn', '跳过（不再显示）')
  skip.addEventListener('click', markDone)
  actions.appendChild(next)
  actions.appendChild(skip)
  box.appendChild(actions)
}

function renderCheck(box: HTMLElement): void {
  box.replaceChildren()
  box.appendChild(h('div', 'stats-head-title', '环境自检'))
  const body = h('div', 'stats-body onboard-body')
  body.appendChild(h('p', 'onboard-p', '正在检查…'))
  box.appendChild(body)
  void window.api.envCheck().then((env) => renderCheckResult(box, env)).catch(() => renderCheckResult(box, null))
}

function renderCheckResult(box: HTMLElement, env: EnvCheckResult | null): void {
  box.replaceChildren()
  box.appendChild(h('div', 'stats-head-title', '环境自检结果'))
  const body = h('div', 'stats-body onboard-body')
  if (!env) {
    body.appendChild(h('p', 'onboard-p', '检测失败，可稍后到「设置 → 使用帮助」重试。'))
  } else {
    for (const it of env.items) {
      const row = h('div', 'onboard-item')
      row.appendChild(h('span', 'onboard-ok ' + (it.ok ? 'ok' : 'no'), it.ok ? '✓' : '✗'))
      const col = h('div', 'onboard-item-col')
      col.appendChild(h('div', 'onboard-item-label', it.label))
      col.appendChild(h('div', 'onboard-item-detail', it.detail))
      if (!it.ok && it.hint) col.appendChild(h('div', 'onboard-item-hint', it.hint))
      row.appendChild(col)
      body.appendChild(row)
    }
    if (env.allReady) body.appendChild(h('p', 'onboard-p', '核心环境已就绪，可以开始使用了！'))
  }
  box.appendChild(body)
  const actions = h('div', 'ui-dialog-actions')
  const done = h('button', 'btn primary', '完成（开始使用）')
  done.addEventListener('click', markDone)
  const skip = h('button', 'btn', '跳过（不再显示）')
  skip.addEventListener('click', markDone)
  actions.appendChild(done)
  actions.appendChild(skip)
  box.appendChild(actions)
}
