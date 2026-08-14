import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { GITHUB_TOKEN_URL, TOKEN_HELP_STEPS } from '../src/renderer/github-help'

describe('GitHub token 获取指引', () => {
  it('指向 fine-grained token 页面', () => {
    expect(GITHUB_TOKEN_URL).toContain('github.com/settings/tokens')
  })

  it('包含只读权限说明与完整步骤', () => {
    expect(TOKEN_HELP_STEPS.length).toBe(3)
    const joined = TOKEN_HELP_STEPS.join(' ')
    expect(joined).toContain('Read-only')
    expect(joined).toContain('只读')
    expect(joined).toContain('Generate new token')
  })

  it('GitHub 面板也引用 token 获取指引', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'renderer', 'github.ts'), 'utf-8')
    expect(src).toContain('TOKEN_HELP_STEPS')
    expect(src).toContain('GITHUB_TOKEN_URL')
  })
})
