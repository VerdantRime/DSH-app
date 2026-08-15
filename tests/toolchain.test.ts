import { describe, it, expect } from 'vitest'
import { parseVersion, detectToolchains, type ProbeFn } from '../src/main/toolchain'

describe('工具链检测', () => {
  it('parseVersion 从典型输出提取版本号', () => {
    expect(parseVersion('Python 3.12.4')).toBe('3.12.4')
    expect(parseVersion('gcc (MinGW-W64 x86_64-ucrt-posix-seh) 14.2.0')).toBe('14.2.0')
    expect(parseVersion('openjdk version \"21.0.1\" 2023-10-17')).toBe('21.0.1')
    expect(parseVersion('')).toBe('')
  })

  it('detectToolchains 汇总探测结果', () => {
    const fake: ProbeFn = (cmd) => {
      if (cmd === 'python') return { found: true, output: 'Python 3.12.4' }
      if (cmd === 'gcc') return { found: true, output: 'gcc 14.2.0' }
      if (cmd === 'g++') return { found: true, output: 'g++ 14.2.0' }
      return { found: false, output: '' }
    }
    const r = detectToolchains(fake)
    expect(r.python.found).toBe(true)
    expect(r.python.version).toBe('3.12.4')
    expect(r.gcc.found).toBe(true)
    expect(r.gpp.version).toBe('14.2.0')
    expect(r.java.found).toBe(false)
  })
})
