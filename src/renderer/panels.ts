import { CHAT_ICON, GITHUB_ICON, SETTINGS_ICON } from './icons'

export type PanelId = 'chat' | 'github' | 'settings'

export interface PanelDef {
  id: PanelId
  label: string
  icon: string
}

export const PANELS: PanelDef[] = [
  { id: 'chat', label: '聊天', icon: CHAT_ICON },
  { id: 'github', label: 'GitHub', icon: GITHUB_ICON },
  { id: 'settings', label: '设置', icon: SETTINGS_ICON }
]

export const DEFAULT_PANEL: PanelId = 'chat'

export function isPanelId(v: string): v is PanelId {
  return PANELS.some((p) => p.id === v)
}

export interface PanelVisibility {
  chat: boolean
  github: boolean
  settings: boolean
  webviewVisible: boolean
}

export function panelVisibility(active: PanelId): PanelVisibility {
  return {
    chat: active === 'chat',
    github: active === 'github',
    settings: active === 'settings',
    webviewVisible: active === 'chat'
  }
}
