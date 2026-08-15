import { describe, it, expect } from 'vitest'
import { PANELS, DEFAULT_PANEL, isPanelId, panelVisibility } from '../src/renderer/panels'

describe('panels', () => {
  it('有四个面板且聊天为默认', () => {
    expect(PANELS).toHaveLength(4)
    expect(PANELS[0].id).toBe('chat')
    expect(PANELS[1].id).toBe('ide')
    expect(DEFAULT_PANEL).toBe('chat')
  })

  it('面板 id 唯一', () => {
    const ids = PANELS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('isPanelId 正确判断', () => {
    expect(isPanelId('chat')).toBe(true)
    expect(isPanelId('github')).toBe(true)
    expect(isPanelId('ide')).toBe(true)
    expect(isPanelId('settings')).toBe(true)
    expect(isPanelId('nope')).toBe(false)
  })

  it('panelVisibility：非聊天面板时 webview 应隐藏', () => {
    expect(panelVisibility('chat').webviewVisible).toBe(true)
    expect(panelVisibility('chat').chat).toBe(true)
    expect(panelVisibility('github').webviewVisible).toBe(false)
    expect(panelVisibility('github').github).toBe(true)
    expect(panelVisibility('settings').webviewVisible).toBe(false)
    expect(panelVisibility('settings').settings).toBe(true)
    expect(panelVisibility('ide').ide).toBe(true)
    expect(panelVisibility('ide').webviewVisible).toBe(false)
  })
})
