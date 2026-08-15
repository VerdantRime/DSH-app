import { describe, it, expect } from 'vitest'
import { parentPath, fileNameOf, joinRepoPath, validateNewFileName, breadcrumbSegments, formatFileSize, isMarkdownFile, githubErrorHint } from '../src/renderer/github-utils'

describe('github-utils 路径工具', () => {
  it('parentPath 返回上级目录', () => {
    expect(parentPath('docs/a/b.md')).toBe('docs/a')
    expect(parentPath('a.md')).toBe('')
    expect(parentPath('docs/a')).toBe('docs')
  })

  it('fileNameOf 返回文件名', () => {
    expect(fileNameOf('docs/a.md')).toBe('a.md')
    expect(fileNameOf('a.md')).toBe('a.md')
  })

  it('joinRepoPath 拼接目录与文件名', () => {
    expect(joinRepoPath('', 'x.md')).toBe('x.md')
    expect(joinRepoPath('docs', 'x.md')).toBe('docs/x.md')
    expect(joinRepoPath(' docs ', 'x.md')).toBe('docs/x.md')
  })

  it('breadcrumbSegments 逐级拆出面包屑', () => {
    expect(breadcrumbSegments('')).toEqual([])
    expect(breadcrumbSegments('docs/a/b')).toEqual([
      { label: 'docs', path: 'docs' },
      { label: 'a', path: 'docs/a' },
      { label: 'b', path: 'docs/a/b' }
    ])
  })

  it('githubErrorHint 转成中文可读提示', () => {
    expect(githubErrorHint(new Error('403 Resource not accessible by integration'))).toContain('无写入权限')
    expect(githubErrorHint(new Error('Unprocessable Entity'))).toContain('422')
    expect(githubErrorHint(new Error('boom'))).toBe('boom')
  })

  it('isMarkdownFile 识别常见 md 扩展名', () => {
    expect(isMarkdownFile('README.md')).toBe(true)
    expect(isMarkdownFile('docs/a.MD')).toBe(true)
    expect(isMarkdownFile('a.markdown')).toBe(true)
    expect(isMarkdownFile('a.ts')).toBe(false)
    expect(isMarkdownFile('a.md.txt')).toBe(false)
  })

  it('formatFileSize 人性化单位换算', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB')
    expect(formatFileSize(-1)).toBe('')
  })
})

describe('validateNewFileName 校验', () => {
  it('合法文件名返回 null', () => {
    expect(validateNewFileName('a.md')).toBeNull()
    expect(validateNewFileName('  你好.txt  ')).toBeNull()
  })

  it('拒绝空名、斜杠、点号与控制字符', () => {
    expect(validateNewFileName('')).toContain('空')
    expect(validateNewFileName('a/b')).toContain('/')
    expect(validateNewFileName('a\\b')).toContain('\\')
    expect(validateNewFileName('..')).toContain('无效')
    expect(validateNewFileName('a\u0000b')).toContain('控制字符')
  })

  it('拒绝超长文件名', () => {
    expect(validateNewFileName('x'.repeat(201))).toContain('过长')
  })
})
