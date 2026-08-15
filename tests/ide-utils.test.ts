import { describe, it, expect } from 'vitest'
import { languageForFile, tabTitleFromPath, githubTabKey, canApplyAi } from '../src/renderer/ide-utils'

describe('IDE 语言识别', () => {
  it('按扩展名识别语言', () => {
    expect(languageForFile('main.py')).toBe('python')
    expect(languageForFile('a.c')).toBe('cpp')
    expect(languageForFile('a.cpp')).toBe('cpp')
    expect(languageForFile('a.h')).toBe('cpp')
    expect(languageForFile('Main.java')).toBe('java')
    expect(languageForFile('a.js')).toBe('javascript')
    expect(languageForFile('a.ts')).toBe('typescript')
    expect(languageForFile('a.json')).toBe('json')
    expect(languageForFile('README.md')).toBe('markdown')
    expect(languageForFile('a.html')).toBe('html')
    expect(languageForFile('a.css')).toBe('css')
    expect(languageForFile('noext')).toBe('plaintext')
  })

  it('大小写不敏感', () => {
    expect(languageForFile('MAIN.PY')).toBe('python')
    expect(languageForFile('A.CPP')).toBe('cpp')
  })

  it('canApplyAi 仅找错/优化且含代码块可应用', () => {
    expect(canApplyAi('optimize', true)).toBe(true)
    expect(canApplyAi('debug', true)).toBe(true)
    expect(canApplyAi('explain', true)).toBe(false)
    expect(canApplyAi('chat', true)).toBe(false)
    expect(canApplyAi('debug', false)).toBe(false)
  })

  it('githubTabKey 生成稳定标识', () => {
    expect(githubTabKey('a', 'b', 'c/x.md')).toBe('github:a/b/c/x.md')
  })

  it('从路径取标签标题', () => {
    expect(tabTitleFromPath('C:\\a\\b\\main.py')).toBe('main.py')
    expect(tabTitleFromPath('/x/y/z.c')).toBe('z.c')
    expect(tabTitleFromPath('README.md')).toBe('README.md')
  })
})
