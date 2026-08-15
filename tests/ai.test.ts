import { describe, it, expect } from 'vitest'
import { buildPromptTask, withModel, currentModelOf, listModels, DEEPSEEK_MODELS } from '../src/main/ai'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
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

  it('currentModelOf 读取当前模型', () => {
    expect(currentModelOf('agent-default-model:\n  model: deepseek-v4-pro\n')).toBe('deepseek-v4-pro')
    expect(currentModelOf('')).toBe('deepseek-v4-pro')
  })

  it('DEEPSEEK_MODELS 为真实模型名（无 V3/R1）', () => {
    expect(DEEPSEEK_MODELS).toContain('deepseek-v4-flash')
    expect(DEEPSEEK_MODELS).toContain('deepseek-v4-pro')
    expect(DEEPSEEK_MODELS).not.toContain('deepseek-chat')
    expect(DEEPSEEK_MODELS).not.toContain('deepseek-reasoner')
  })

  it('listModels 返回内置清单并去重当前模型', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'dsh-models-'))
    await fs.writeFile(join(dir, 'settings.yaml'), 'agent-default-model:\n  model: deepseek-v4-flash\n')
    const r = await listModels(dir)
    expect(r.current).toBe('deepseek-v4-flash')
    expect(r.models.length).toBe(2)
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('extractCodeBlock 提取最后一个代码块', () => {
    const md = '说明\n```python\nprint(1)\n```\n再一段\n```python\nprint(2)\n```'
    expect(extractCodeBlock(md)).toBe('print(2)')
    expect(extractCodeBlock('没有代码块')).toBeNull()
  })
})
