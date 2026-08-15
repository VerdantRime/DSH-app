export interface CtxMenuItem { label: string; onClick: () => void }

function h(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text !== undefined) e.textContent = text
  return e
}

let ctxMenu: HTMLElement | null = null

export function hideContextMenu(): void {
  ctxMenu?.remove()
  ctxMenu = null
}

function onDocDown(e: MouseEvent): void {
  if (ctxMenu && !ctxMenu.contains(e.target as Node)) hideContextMenu()
  else setTimeout(() => document.addEventListener('mousedown', onDocDown, { once: true }), 0)
}

export function showContextMenu(x: number, y: number, items: CtxMenuItem[]): void {
  hideContextMenu()
  const menu = h('div', 'gh-ctx-menu')
  for (const it of items) {
    const b = h('button', 'gh-ctx-item', it.label)
    b.addEventListener('click', () => { hideContextMenu(); it.onClick() })
    menu.appendChild(b)
  }
  menu.style.left = x + 'px'
  menu.style.top = y + 'px'
  document.body.appendChild(menu)
  ctxMenu = menu
  setTimeout(() => document.addEventListener('mousedown', onDocDown, { once: true }), 0)
}

export function copyText(s: string): void {
  navigator.clipboard.writeText(s).catch(() => window.alert('复制失败'))
}
