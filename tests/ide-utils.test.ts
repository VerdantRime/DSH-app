import { describe, it, expect } from 'vitest'
import { languageForFile, tabTitleFromPath, githubTabKey, canApplyAi, clamp, diffHunks, applyHunks } from '../src/renderer/ide-utils'

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

  it('diffHunks 识别修改/删除/插入块', () => {
    expect(diffHunks('a\nb\nc', 'a\nx\nc')).toEqual([{ oldStart: 1, oldCount: 1, newLines: ['x'] }])
    expect(diffHunks('a\nb\nc', 'a\nc')).toEqual([{ oldStart: 1, oldCount: 1, newLines: [] }])
    expect(diffHunks('a\nc', 'a\nb\nc')).toEqual([{ oldStart: 1, oldCount: 0, newLines: ['b'] }])
  })

  it('applyHunks 只应用 accepted 的块', () => {
    const hunks = diffHunks('a\nb\nc', 'a\nx\ny\nc')
    expect(applyHunks('a\nb\nc', hunks, [true])).toBe('a\nx\ny\nc')
    expect(applyHunks('a\nb\nc', hunks, [false])).toBe('a\nb\nc')
  })

  it('clamp 限制数值范围', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(50, 0, 10)).toBe(10)
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
