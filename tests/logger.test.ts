import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { RollingLogger } from '../src/main/logger'

let dir = ''
beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'dsh-log-'))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('RollingLogger', () => {
  it('追加写入日志行', () => {
    const base = join(dir, 'harness.log')
    const logger = new RollingLogger(base)
    logger.append('line one')
    logger.append('line two')
    const content = readFileSync(base, 'utf-8')
    expect(content).toContain('line one')
    expect(content).toContain('line two')
  })

  it('超过大小触发轮转', () => {
    const base = join(dir, 'harness.log')
    const logger = new RollingLogger(base, 20, 3)
    for (let i = 0; i < 12; i++) logger.append('entry-' + i)
    expect(existsSync(base)).toBe(true)
    expect(existsSync(base + '.1')).toBe(true)
  })
})
