import { describe, it, expect } from 'vitest'
import { PANELS, DEFAULT_PANEL, isPanelId } from '../src/renderer/panels'

describe('panels', () => {
  it('有三个面板且聊天为默认', () => {
    expect(PANELS).toHaveLength(3)
    expect(PANELS[0].id).toBe('chat')
    expect(DEFAULT_PANEL).toBe('chat')
  })

  it('面板 id 唯一', () => {
    const ids = PANELS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('isPanelId 正确判断', () => {
    expect(isPanelId('chat')).toBe(true)
    expect(isPanelId('github')).toBe(true)
    expect(isPanelId('settings')).toBe(true)
    expect(isPanelId('nope')).toBe(false)
  })
})
