import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(join(process.cwd(), 'src', 'renderer', 'monaco-zh.ts'), 'utf-8')

describe('Monaco 中文翻译', () => {
  it('注入 _VSCODE_NLS_MESSAGES 并包含关键文案', () => {
    expect(src).toContain('_VSCODE_NLS_MESSAGES')
    expect(src).toContain("850: '剪切'")
    expect(src).toContain("854: '复制'")
    expect(src).toContain("858: '粘贴'")
    expect(src).toContain("825: '命令面板'")
    expect(src).toContain("1004: '查找'")
    expect(src).toContain("1085: '转到定义'")
  })

  it('monaco-setup 在导入 monaco 前先注入翻译', () => {
    const setup = readFileSync(join(process.cwd(), 'src', 'renderer', 'monaco-setup.ts'), 'utf-8')
    expect(setup.indexOf("./monaco-zh")).toBeLessThan(setup.indexOf("monaco-editor"))
  })
})
