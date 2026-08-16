import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(join(process.cwd(), 'src', 'renderer', 'github.ts'), 'utf-8')

describe('GitHub 文件编辑器', () => {
  it('新建/编辑文件的提交按钮会被渲染到按钮行', () => {
    expect(src).toContain('row.appendChild(submitBtn)')
  })
})
