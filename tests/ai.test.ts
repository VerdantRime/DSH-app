import { describe, it, expect } from 'vitest'
import { buildPromptTask, withModel } from '../src/main/ai'
import { extractCodeBlock, buildChatPrompt } from '../src/renderer/ide-utils'

describe('AI 任务构建与结果解析', () => {
  it('buildPromptTask 引用 prompt 文件', () => {
    const t = buildPromptTask('C:\\x\\ai_prompt.txt')
    expect(t).toContain('C:\\x\\ai_prompt.txt')
    expect(t).toContain('读取')
  })

  it('buildChatPrompt 包含代码上下文、历史与最新问题', () => {
    const p = buildChatPrompt(
      [{ role: 'user', content: '这是什么？' }, { role: 'assistant', content: '这是主函数' }],
      '再解释一遍',
      'int main() { return 0; }',
      'cpp'
    )
    expect(p).toContain('int main() { return 0; }')
    expect(p).toContain('用户：这是什么？')
    expect(p).toContain('助手：这是主函数')
    expect(p).toContain('再解释一遍')
  })

  it('withModel 覆盖模型并保留其它字段', () => {
    const src = 'ui-onboarding:\n  welcomeNoticeVersion: 1\nagent-default-model:\n  provider: deepseek-official\n  model: deepseek-v4-pro\n  reasoningEffort: high\n'
    const out = withModel(src, 'deepseek-chat')
    expect(out).toContain('model: deepseek-chat')
    expect(out).toContain('provider: deepseek-official')
    expect(out).toContain('ui-onboarding')
    expect(out).not.toContain('deepseek-v4-pro')
  })

  it('extractCodeBlock 提取最后一个代码块', () => {
    const md = '说明\n```python\nprint(1)\n```\n再一段\n```python\nprint(2)\n```'
    expect(extractCodeBlock(md)).toBe('print(2)')
    expect(extractCodeBlock('没有代码块')).toBeNull()
  })
})
