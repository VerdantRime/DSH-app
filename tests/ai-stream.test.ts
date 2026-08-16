import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ai = readFileSync(join(process.cwd(), 'src', 'main', 'ai.ts'), 'utf-8')
const types = readFileSync(join(process.cwd(), 'src', 'shared', 'types.ts'), 'utf-8')
const preload = readFileSync(join(process.cwd(), 'src', 'preload', 'index.ts'), 'utf-8')
const ide = readFileSync(join(process.cwd(), 'src', 'renderer', 'ide.ts'), 'utf-8')

describe('AI 流式输出接线', () => {
  it('askHeadless 支持 onChunk 逐块回调', () => {
    expect(ai).toMatch(/onChunk\?/);
  })
  it('暴露 aiChunk 事件与 onAiChunk 订阅', () => {
    expect(types).toContain("aiChunk: 'ai:chunk'");
    expect(types).toContain('onAiChunk');
    expect(preload).toContain('onAiChunk');
  })
  it('渲染端流式追加到气泡', () => {
    expect(ide).toContain('onAiChunk');
    expect(ide).toContain('ide-ai-streaming');
  })
})
