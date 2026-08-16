import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ide = readFileSync(join(process.cwd(), 'src', 'renderer', 'ide.ts'), 'utf-8')

describe('编译错误统计口径', () => {
  it('每次编译失败按 +1 计（而非按错误行数累加）', () => {
    expect(ide).toContain("statsBumpMap('byFileErrors', tab.path ?? tab.github?.path ?? tab.title, 1)")
  })
})
