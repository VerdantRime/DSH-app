import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const main = readFileSync(join(process.cwd(), 'src', 'renderer', 'main.ts'), 'utf-8')
const onboarding = readFileSync(join(process.cwd(), 'src', 'renderer', 'onboarding.ts'), 'utf-8')

describe('首次启动向导', () => {
  it('未引导时启动调用 showOnboarding', () => {
    expect(main).toContain('showOnboarding')
    expect(main).toContain('onboarded')
  })
  it('向导做环境检查并可标记完成', () => {
    expect(onboarding).toContain('envCheck')
    expect(onboarding).toContain('configSet({ onboarded: true })')
  })
})
