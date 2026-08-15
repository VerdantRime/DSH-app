import { describe, it, expect } from 'vitest'
import { buildAiTask } from '../src/main/ai'
import { extractCodeBlock } from '../src/renderer/ide-utils'

describe('AI 任务构建与结果解析', () => {
  it('buildAiTask 包含动作与文件路径', () => {
    const t = buildAiTask('explain', 'C:\\x\\main.py', 'python')
    expect(t).toContain('C:\\x\\main.py')
    expect(t).toContain('解释')
    const o = buildAiTask('optimize', 'C:\\x\\main.cpp', 'cpp')
    expect(o).toContain('优化')
    expect(o).toContain('fenced code block')
  })

  it('extractCodeBlock 提取最后一个代码块', () => {
    const md = '说明\n```python\nprint(1)\n```\n再一段\n```python\nprint(2)\n```'
    expect(extractCodeBlock(md)).toBe('print(2)')
    expect(extractCodeBlock('没有代码块')).toBeNull()
  })
})
