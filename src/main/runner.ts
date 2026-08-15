import { spawn, spawnSync } from 'child_process'
import { readdirSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname, basename } from 'path'
import * as iconv from 'iconv-lite'

export type RunLanguage = 'python' | 'cpp' | 'java'

export interface ToolPaths { python?: string; gpp?: string; javac?: string; java?: string }
export interface RunRequest { language: RunLanguage; targetPath: string; interactive: boolean; tools?: ToolPaths }
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

/** 判断编译输出是否为“未定义引用”这类链接错误（多文件项目特征）。 */
export function isLinkError(output: string): boolean {
  return /undefined reference|undefined symbol|ld returned/i.test(output)
}

/** 从 Java 源文件名推导主类名。 */
export function javaMainClass(targetPath: string): string {
  return basename(targetPath).replace(/\.java$/i, '')
}

/** 解码子进程输出：先按 UTF-8 严格解码，失败回退 GBK（中文 Windows 控制台/源文件常见编码）。 */
export function decodeOutput(buf: Buffer | string | null | undefined): string {
  if (!buf) return ''
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), 'binary')
  if (b.length === 0) return ''
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b)
  } catch {
    /* 非 UTF-8，回退 GBK */
  }
  try {
    return new TextDecoder('gbk').decode(b)
  } catch {
    return b.toString('utf-8')
  }
}

function runCapture(cmd: string, args: string[], cwd: string, timeoutMs = 30000): { code: number | null; out: string } {
  const r = spawnSync(cmd, args, { cwd, timeout: timeoutMs, windowsHide: true })
  return { code: r.status, out: decodeOutput(r.stdout) + decodeOutput(r.stderr) }
}

function quoteArg(a: string): string {
  if (/[\s"&|<>^]/.test(a)) return '"' + a.replace(/"/g, '') + '"'
  return a
}

/** 生成交互式运行的批处理内容（cd 到工作目录并停留）。 */
export function buildBatchScript(program: string, args: string[], cwd: string): string {
  const line = [program, ...args].map(quoteArg).join(' ')
  return '@echo off\r\ncd /d "' + cwd + '"\r\n' + line + '\r\necho.\r\necho [按任意键关闭]\r\npause >nul\r\n'
}

/** 用 start + 批处理可靠地弹出独立控制台窗口；批处理以 GBK 编码写入，中文路径不乱码。 */
function consoleRun(program: string, args: string[], cwd: string): void {
  try {
    const bat = join(tmpdir(), 'dsh-ide', 'run-' + Date.now() + '.bat')
    mkdirSync(dirname(bat), { recursive: true })
    writeFileSync(bat, iconv.encode(buildBatchScript(program, args, cwd), 'gbk'))
    spawn('cmd.exe', ['/c', 'start', '', bat], { detached: true, stdio: 'ignore', windowsHide: false }).unref()
  } catch {
    const line = [program, ...args].map(quoteArg).join(' ')
    spawn('cmd.exe', ['/c', 'start', '', 'cmd.exe', '/k', line], { detached: true, stdio: 'ignore', windowsHide: false }).unref()
  }
}

function runPython(req: RunRequest): RunResult {
  const python = toolPath(req.tools?.python, 'python.exe')
  if (req.interactive) {
    consoleRun(python, [req.targetPath], dirname(req.targetPath))
    return { ok: true, output: '', exitCode: null, interactive: true }
  }
  const r = runCapture(python, [req.targetPath], dirname(req.targetPath))
  return { ok: r.code === 0, output: r.out, exitCode: r.code, interactive: false }
}

function runCpp(req: RunRequest): RunResult {
  const gpp = toolPath(req.tools?.gpp, 'g++.exe')
  const dir = dirname(req.targetPath)
  const exe = join(dir, basename(req.targetPath).replace(/\.[^.]+$/, '') + '.exe')
  // 先只编译当前文件；出现“未定义引用”（多文件项目）时，再把同目录源文件一起编译重试
  let compile = runCapture(gpp, [req.targetPath, '-o', exe], dir, 60000)
  if (compile.code !== 0 && isLinkError(compile.out)) {
    const files = projectSources(req.targetPath)
    if (files.length > 1) compile = runCapture(gpp, [...files, '-o', exe], dir, 60000)
  }
  if (compile.code !== 0) {
    return { ok: false, output: compile.out, exitCode: compile.code, interactive: false }
  }
  if (req.interactive) {
    consoleRun(exe, [], dir)
    return { ok: true, output: '', exitCode: null, interactive: true }
  }
  const r = runCapture(exe, [], dir)
  return { ok: r.code === 0, output: r.out, exitCode: r.code, interactive: false }
}

function runJava(req: RunRequest): RunResult {
  const javac = toolPath(req.tools?.javac, 'javac.exe')
  const java = toolPath(req.tools?.java, 'java.exe')
  const dir = dirname(req.targetPath)
  const cls = javaMainClass(req.targetPath)
  const compile = runCapture(javac, [req.targetPath], dir, 60000)
  if (compile.code !== 0) {
    return { ok: false, output: compile.out, exitCode: compile.code, interactive: false }
  }
  if (req.interactive) {
    consoleRun(java, ['-cp', dir, cls], dir)
    return { ok: true, output: '', exitCode: null, interactive: true }
  }
  const r = runCapture(java, ['-cp', dir, cls], dir)
  return { ok: r.code === 0, output: r.out, exitCode: r.code, interactive: false }
}

/** 一键编译运行入口。 */
export function run(req: RunRequest): RunResult {
  if (req.language === 'python') return runPython(req)
  if (req.language === 'cpp') return runCpp(req)
  return runJava(req)
}
