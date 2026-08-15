import { spawn, spawnSync } from 'child_process'
import { readdirSync } from 'fs'
import { join, dirname, basename } from 'path'

export type RunLanguage = 'python' | 'cpp' | 'java'

export interface ToolPaths { python?: string; gpp?: string; javac?: string; java?: string }
export interface RunRequest { language: RunLanguage; targetPath: string; multiFile: boolean; interactive: boolean; tools?: ToolPaths }
export interface RunResult { ok: boolean; output: string; exitCode: number | null; interactive: boolean }

/** 解析工具路径：配置为空用 PATH 默认名；配置为目录则拼接工具名；为 .exe 直接用。 */
export function toolPath(configured: string | undefined, fallback: string): string {
  const p = (configured || '').trim()
  if (!p) return fallback
  if (/\.(exe|bat|cmd)$/i.test(p)) return p
  return join(p, fallback)
}

/** 目录下所有 C/C++ 源文件（多文件项目整体编译用）。 */
export function projectSources(targetPath: string): string[] {
  const dir = dirname(targetPath)
  try {
    return readdirSync(dir).filter((f) => /\.(c|cpp|cc|cxx)$/i.test(f)).map((f) => join(dir, f))
  } catch {
    return [targetPath]
  }
}

/** 从 Java 源文件名推导主类名。 */
export function javaMainClass(targetPath: string): string {
  return basename(targetPath).replace(/\.java$/i, '')
}

function capture(cmd: string, args: string[], cwd: string): { code: number | null; out: string } {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf-8', timeout: 30000 })
  return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') }
}

function consoleRun(cmdline: string): void {
  const child = spawn('cmd.exe', ['/k', cmdline], { detached: true, stdio: 'ignore', windowsHide: false })
  child.unref()
}

function runPython(req: RunRequest): RunResult {
  const python = toolPath(req.tools?.python, 'python.exe')
  if (req.interactive) {
    consoleRun('"' + python + '" "' + req.targetPath + '"')
    return { ok: true, output: '', exitCode: null, interactive: true }
  }
  const r = capture(python, [req.targetPath], dirname(req.targetPath))
  return { ok: r.code === 0, output: r.out, exitCode: r.code, interactive: false }
}

function runCpp(req: RunRequest): RunResult {
  const gpp = toolPath(req.tools?.gpp, 'g++.exe')
  const dir = dirname(req.targetPath)
  const files = req.multiFile ? projectSources(req.targetPath) : [req.targetPath]
  const exe = join(dir, basename(req.targetPath).replace(/\.[^.]+$/, '') + '.exe')
  const compile = spawnSync(gpp, [...files, '-o', exe], { cwd: dir, encoding: 'utf-8', timeout: 60000 })
  if (compile.status !== 0) {
    return { ok: false, output: (compile.stdout ?? '') + (compile.stderr ?? ''), exitCode: compile.status, interactive: false }
  }
  if (req.interactive) {
    consoleRun('"' + exe + '"')
    return { ok: true, output: '', exitCode: null, interactive: true }
  }
  const r = capture(exe, [], dir)
  return { ok: r.code === 0, output: r.out, exitCode: r.code, interactive: false }
}

function runJava(req: RunRequest): RunResult {
  const javac = toolPath(req.tools?.javac, 'javac.exe')
  const java = toolPath(req.tools?.java, 'java.exe')
  const dir = dirname(req.targetPath)
  const cls = javaMainClass(req.targetPath)
  const compile = spawnSync(javac, [req.targetPath], { cwd: dir, encoding: 'utf-8', timeout: 60000 })
  if (compile.status !== 0) {
    return { ok: false, output: (compile.stdout ?? '') + (compile.stderr ?? ''), exitCode: compile.status, interactive: false }
  }
  if (req.interactive) {
    consoleRun('"' + java + '" -cp "' + dir + '" ' + cls)
    return { ok: true, output: '', exitCode: null, interactive: true }
  }
  const r = capture(java, ['-cp', dir, cls], dir)
  return { ok: r.code === 0, output: r.out, exitCode: r.code, interactive: false }
}

/** 一键编译运行入口。 */
export function run(req: RunRequest): RunResult {
  if (req.language === 'python') return runPython(req)
  if (req.language === 'cpp') return runCpp(req)
  return runJava(req)
}
