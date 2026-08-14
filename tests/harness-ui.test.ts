import { describe, it, expect } from 'vitest'
import { statusLabel, dotClass, formatUptime, metaText } from '../src/renderer/harness-ui'
import type { HarnessStatus } from '../src/shared/types'

function status(partial: Partial<HarnessStatus>): HarnessStatus {
  return {
    state: 'idle',
    pid: null,
    startedAt: null,
    port: 3080,
    url: 'http://127.0.0.1:3080',
    source: null,
    ...partial
  }
}

describe('harness-ui', () => {
  it('状态标签正确', () => {
    expect(statusLabel(status({ state: 'idle' }))).toBe('未启动')
    expect(statusLabel(status({ state: 'running' }))).toBe('运行中')
    expect(statusLabel(status({ state: 'reused' }))).toBe('复用外部')
    expect(statusLabel(status({ state: 'error' }))).toBe('出错')
  })

  it('状态点 class 正确', () => {
    expect(dotClass(status({ state: 'running' }))).toBe('dot dot-running')
    expect(dotClass(status({ state: 'starting' }))).toBe('dot dot-starting')
  })

  it('运行时长格式化', () => {
    expect(formatUptime(null, 0)).toBe('—')
    expect(formatUptime(1000, 1000 + 65000)).toBe('1m 5s')
    expect(formatUptime(1000, 1000 + 9000)).toBe('9s')
  })

  it('meta 文本包含端口与来源', () => {
    const t = metaText(status({ state: 'reused', source: 'external', port: 3080 }), Date.now())
    expect(t).toContain('端口 3080')
    expect(t).toContain('外部实例')
  })
})
