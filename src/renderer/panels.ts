export type PanelId = 'chat' | 'github' | 'settings'

export interface PanelDef {
  id: PanelId
  label: string
  icon: string
}

export const PANELS: PanelDef[] = [
  { id: 'chat', label: '聊天', icon: '💬' },
  { id: 'github', label: 'GitHub', icon: '🐙' },
  { id: 'settings', label: '设置', icon: '⚙️' }
]

export const DEFAULT_PANEL: PanelId = 'chat'

export function isPanelId(v: string): v is PanelId {
  return PANELS.some((p) => p.id === v)
}
