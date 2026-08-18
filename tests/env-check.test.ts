import { describe, it, expect } from 'vitest'
import { buildEnvItems } from '../src/main/env-check'
import type { ToolchainReport } from '../src/main/toolchain'

function fullTools(): ToolchainReport {
  return {
    python: { found: true, version: '3.12.4', command: 'python' },
    gcc: { found: true, version: '14.2.0', command: 'gcc' },
    gpp: { found: true, version: '14.2.0', command: 'g++' },
    java: { found: true, version: '21.0.1', command: 'java' }
  }
}

describe('环境自检映射', () => {
  it('全部就绪时 allReady 为 true', () => {
    const r = buildEnvItems({ node: { found: true, version: 'v22.12.0' }, tools: fullTools(), dshConfigured: true, githubLoggedIn: true })
    expect(r.allReady).toBe(true)
    expect(r.items).toHaveLength(6)
  })

  it('缺少 Node 时给出官网安装提示', () => {
    const r = buildEnvItems({ node: { found: false, version: '' }, tools: fullTools(), dshConfigured: true, githubLoggedIn: true })
    expect(r.allReady).toBe(false)
    const node = r.items.find((i) => i.id === 'node')!
    expect(node.ok).toBe(false)
    expect(node.hint).toContain('nodejs.org')
  })

  it('工具链/GitHub 缺失不影响核心 allReady', () => {
    const r = buildEnvItems({ node: { found: true, version: 'v22' }, tools: { python: {found:false,version:'',command:'python'}, gcc:{found:false,version:'',command:'gcc'}, gpp:{found:false,version:'',command:'g++'}, java:{found:false,version:'',command:'java'} }, dshConfigured: true, githubLoggedIn: false })
    expect(r.allReady).toBe(true)
    expect(r.items.find((i) => i.id === 'github')!.ok).toBe(false)
  })
})
