import { describe, it, expect } from 'vitest'
import { isActiveByFlags, IDLE_LIMIT_MS } from '../src/main/stats-active'

describe('活跃计时判定', () => {
  it('有焦点、未最小化、可见、未挂机才计时', () => {
    expect(isActiveByFlags({ focused: true, minimized: false, visible: true, idleMs: 0 })).toBe(true)
    expect(isActiveByFlags({ focused: false, minimized: false, visible: true, idleMs: 0 })).toBe(false)
    expect(isActiveByFlags({ focused: true, minimized: true, visible: true, idleMs: 0 })).toBe(false)
    expect(isActiveByFlags({ focused: true, minimized: false, visible: false, idleMs: 0 })).toBe(false)
  })

  it('挂机达到 3 分钟即停表', () => {
    expect(isActiveByFlags({ focused: true, minimized: false, visible: true, idleMs: IDLE_LIMIT_MS - 1 })).toBe(true)
    expect(isActiveByFlags({ focused: true, minimized: false, visible: true, idleMs: IDLE_LIMIT_MS })).toBe(false)
  })
})
