import { spawn } from 'child_process'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { load, dump } from 'js-yaml'
import { extractCodeBlock } from '../renderer/ide-utils'

export type AiAction = 'explain' | 'debug' | 'optimize'

/** 构建给 headless 智能体的单行任务（代码写入临时文件，任务里引用路径，避免命令行换行/引号问题）。 */
export function buildAiTask(action: AiAction, codePath: string, language: string): string {
  const verb =
    action === 'explain'
      ? '解释这段代码的功能与关键逻辑，要求简明清晰'
      : action === 'debug'
        ? '找出代码中的 bug 或潜在问题，说明原因并给出修复建议'
        : '优化这段代码，使其更简洁、高效、可读；请先简要列出优化点，然后在回答末尾用一个 fenced code block（```）给出完整优化后的代码'
  return '你是代码助手。请读取文件 ' + codePath + ' 中的代码（语言：' + language + '），然后' + verb + '。只输出最终结果（中文 Markdown），不要描述过程。'
}

export { extractCodeBlock } from '../renderer/ide-utils'

export interface AskOptions { dshHome: string; timeoutMs?: number }

/** 在 settings.yaml 文本里覆盖 agent-default-model.model（保留 provider 与其它字段）。 */
export function withModel(yamlText: string, model: string): string {
  const doc = (load(yamlText) as Record<string, unknown>) ?? {}
  const cur = (doc['agent-default-model'] as Record<string, unknown>) ?? {}
  doc['agent-default-model'] = { ...cur, provider: cur.provider ?? 'deepseek-official', model }
  return dump(doc, { lineWidth: -1 })
}

/** 带模型切换的一次询问：临时改写 settings.yaml 后运行，finally 恢复原样。 */
export async function askWithModel(task: string, opts: AskOptions & { model?: string }): Promise<string> {
  if (!opts.model) return askHeadless(task, opts)
  const sp = join(opts.dshHome, 'settings.yaml')
  const original = await readFile(sp, 'utf-8').catch(() => null)
  try {
    if (original !== null) await writeFile(sp, withModel(original, opts.model), 'utf-8')
    return await askHeadless(task, opts)
  } finally {
    if (original !== null) await writeFile(sp, original, 'utf-8').catch(() => {})
  }
}

/** 调起 dsh --profile headless 极简智能体，返回最后一条 assistant 文本。 */
export function askHeadless(task: string, opts: AskOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx.cmd', ['@deepseek-ai/dsh', '--profile', 'headless', task], {
      shell: true,
      env: { ...process.env, DSH_HOME: opts.dshHome },
      windowsHide: true
    })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch { /* noop */ }
      reject(new Error('AI 调用超时，请稍后重试'))
    }, opts.timeoutMs ?? 180000)
    child.stdout?.on('data', (d) => { out += d })
    child.stderr?.on('data', (d) => { err += d })
    child.on('error', (e) => { clearTimeout(timer); reject(e) })
    child.on('close', (code) => {
      clearTimeout(timer)
      const text = (out || '').trim()
      if (code === 0 && text) resolve(text)
      else reject(new Error('AI 调用失败：' + (err.trim() || ('退出码 ' + code))))
    })
  })
}
