import { spawnSync } from 'child_process'

export interface ToolInfo { found: boolean; version: string; command: string }
export interface ToolchainReport { python: ToolInfo; gcc: ToolInfo; gpp: ToolInfo; java: ToolInfo }

/** 从工具版本输出里提取版本号（如 3.12.4 / 14.2.0 / 21.0.1）。 */
export function parseVersion(output: string): string {
  const lines = (output || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (const l of lines) {
    const m = l.match(/\d+(?:\.\d+)+/)
    if (m) return m[0]
  }
  return lines[0] ?? ''
}

export type ProbeFn = (command: string, args: string[]) => { found: boolean; output: string }

/** 同步探测命令是否存在及其版本（合并 stdout+stderr，兼容 java -version 打到 stderr 的情况）。 */
export function probeSync(command: string, args: string[]): { found: boolean; output: string } {
  const r = spawnSync(command, args, { encoding: 'utf-8', timeout: 8000 })
  const output = ((r.stdout ?? '') + '\n' + (r.stderr ?? '')).trim()
  return { found: r.status === 0 || output.length > 0, output }
}

/** 检测 Python / GCC / G++ / Java 工具链。probe 可注入以便单测。 */
export function detectToolchains(probe: ProbeFn = probeSync): ToolchainReport {
  const python = probe('python', ['--version'])
  const gcc = probe('gcc', ['--version'])
  const gpp = probe('g++', ['--version'])
  const java = probe('java', ['-version'])
  return {
    python: { found: python.found, version: parseVersion(python.output), command: 'python' },
    gcc: { found: gcc.found, version: parseVersion(gcc.output), command: 'gcc' },
    gpp: { found: gpp.found, version: parseVersion(gpp.output), command: 'g++' },
    java: { found: java.found, version: parseVersion(java.output), command: 'java' }
  }
}
