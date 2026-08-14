import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('SSL 证书校验配置', () => {
  it('配置提供 allowInsecureTls 开关', () => {
    const types = readFileSync(join(process.cwd(), 'src', 'shared', 'types.ts'), 'utf-8')
    expect(types).toContain('allowInsecureTls')
  })

  it('默认关闭（安全）', () => {
    const store = readFileSync(join(process.cwd(), 'src', 'main', 'store.ts'), 'utf-8')
    expect(store).toContain('allowInsecureTls: false')
  })

  it('启动时按配置设置 NODE_TLS_REJECT_UNAUTHORIZED', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'main', 'index.ts'), 'utf-8')
    expect(src).toContain('NODE_TLS_REJECT_UNAUTHORIZED')
    expect(src).toContain('allowInsecureTls')
  })
})
