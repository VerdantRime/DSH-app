import { spawnSync } from 'child_process'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { detectToolchains, parseVersion, type ToolchainReport } from './toolchain'
import type { EnvCheckItem, EnvCheckResult } from '../shared/types'

export interface EnvCheckInput {
  node: { found: boolean; version: string }
  tools: ToolchainReport
  dshConfigured: boolean
  githubLoggedIn: boolean
}

/** 纯映射：由检测结果生成自检项（便于单测）。 */
export function buildEnvItems(input: EnvCheckInput): EnvCheckResult {
  const items: EnvCheckItem[] = [
    { id: 'node', label: 'Node.js（聊天 / AI 助手需要）', required: true, ok: input.node.found, detail: input.node.found ? input.node.version : '未检测到', hint: input.node.found ? undefined : '请到 https://nodejs.org 下载安装 LTS 版（一路下一步），装完重启本应用' },
    { id: 'dsh', label: 'DeepSeek AI（API Key）', required: true, ok: input.dshConfigured, detail: input.dshConfigured ? '已配置' : '未配置', hint: input.dshConfigured ? undefined : '打开「聊天」面板，按首次设置提示填写你的 DeepSeek API Key' },
    { id: 'python', label: 'Python', required: false, ok: input.tools.python.found, detail: input.tools.python.found ? input.tools.python.version : '未检测到', hint: input.tools.python.found ? undefined : '如需运行 Python：到 python.org 安装并勾选 Add to PATH，或到「设置 → IDE」手动指定' },
    { id: 'gcc', label: 'C/C++（GCC）', required: false, ok: input.tools.gcc.found, detail: input.tools.gcc.found ? input.tools.gcc.version : '未检测到', hint: input.tools.gcc.found ? undefined : '如需编译 C/C++：安装 MinGW-w64 并把 bin 加入 PATH，或到「设置 → IDE」手动指定' },
    { id: 'java', label: 'Java（JDK）', required: false, ok: input.tools.java.found, detail: input.tools.java.found ? input.tools.java.version : '未检测到', hint: input.tools.java.found ? undefined : '如需编译 Java：安装 JDK 并把 bin 加入 PATH，或到「设置 → IDE」手动指定' },
    { id: 'github', label: 'GitHub 登录', required: false, ok: input.githubLoggedIn, detail: input.githubLoggedIn ? '已登录' : '未登录', hint: input.githubLoggedIn ? undefined : '到「设置 → GitHub」粘贴你的 Personal Access Token（只读可浏览，读写才能上传/新建）' }
  ]
  return { items, allReady: items.filter((i) => i.required).every((i) => i.ok) }
}

/** 探测 Node.js 是否已装。 */
export function detectNode(): { found: boolean; version: string } {
  const r = spawnSync('node', ['--version'], { encoding: 'utf-8', timeout: 8000 })
  const output = ((r.stdout ?? '') + (r.stderr ?? '')).trim()
  return { found: r.status === 0 && output.length > 0, version: parseVersion(output) }
}

async function dshConfigured(dshHome: string): Promise<boolean> {
  try {
    const raw = await readFile(join(dshHome, 'settings.yaml'), 'utf-8')
    return raw.trim().length > 0
  } catch {
    return false
  }
}

/** 完整环境自检（异步，做真实探测）。 */
export async function runEnvCheck(opts: { dshHome: string; githubLoggedIn: boolean }): Promise<EnvCheckResult> {
  const node = detectNode()
  const tools = detectToolchains()
  const dshOk = await dshConfigured(opts.dshHome)
  return buildEnvItems({ node, tools, dshConfigured: dshOk, githubLoggedIn: opts.githubLoggedIn })
}
