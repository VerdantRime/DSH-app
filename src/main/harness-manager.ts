import { spawn, type ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { connect } from 'net'
import { get } from 'http'
import type { HarnessState, HarnessStatus } from '../shared/types'

export interface HarnessManagerOptions {
  port: number
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
  shell?: boolean
  healthTimeoutMs?: number
  healthIntervalMs?: number
  logMaxLines?: number
}

/**
 * 管理 DeepSeek Harness 后端进程：
 * - 用 child_process 启动 npx.cmd（Windows 需 shell:true）
 * - 捕获 stdout/stderr 作为「后端日志」（harness 网页 UI 看不到）
 * - 端口 + HTTP 双重健康检查，已占用则标记为「复用外部」、不接管停止
 * - 停止时用 taskkill /T /F 杀进程树，避免残留
 * 纯 Node 实现，不依赖 Electron，便于单测。
 */
export class HarnessManager extends EventEmitter {
  private state: HarnessState = 'idle'
  private child: ChildProcess | null = null
  private ownPid: number | null = null
  private startedAt: number | null = null
  private errorMessage: string | null = null
  private logs: string[] = []
  private stdoutBuf = ''
  private stderrBuf = ''
  private childExited = false
  private spawnError: string | null = null
  private stopping = false
  private readonly opts: Required<HarnessManagerOptions>

  constructor(opts: HarnessManagerOptions) {
    super()
    this.opts = {
      shell: true,
      healthTimeoutMs: 30000,
      healthIntervalMs: 300,
      logMaxLines: 2000,
      ...opts
    } as Required<HarnessManagerOptions>
  }

  getStatus(): HarnessStatus {
    const source =
      this.state === 'running' ? 'app' : this.state === 'reused' ? 'external' : null
    return {
      state: this.state,
      pid: this.ownPid,
      startedAt: this.startedAt,
      port: this.opts.port,
      url: 'http://127.0.0.1:' + this.opts.port,
      source,
      error: this.errorMessage ?? undefined
    }
  }

  getLogs(): string[] {
    return [...this.logs]
  }

  async start(): Promise<HarnessStatus> {
    if (this.state === 'starting' || this.state === 'running') {
      return this.getStatus()
    }
    // 复用检测：端口已有 HTTP 服务则复用，不重复启动、不接管停止
    if (await this.isHealthy()) {
      this.setState('reused')
      return this.getStatus()
    }
    this.setState('starting')
    this.childExited = false
    this.spawnError = null
    this.stopping = false
    this.startedAt = Date.now()
    this.ownPid = null

    let child: ChildProcess
    try {
      child = spawn(this.opts.command, this.opts.args, {
        env: this.opts.env,
        shell: this.opts.shell,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })
    } catch (e) {
      this.spawnError = e instanceof Error ? e.message : String(e)
      this.setState('error', this.spawnError)
      return this.getStatus()
    }

    this.child = child
    this.ownPid = child.pid ?? null
    child.stdout?.on('data', (d) => this.onData('stdout', String(d)))
    child.stderr?.on('data', (d) => this.onData('stderr', String(d)))
    child.stdout?.on('end', () => this.onStreamEnd('stdout'))
    child.stderr?.on('end', () => this.onStreamEnd('stderr'))
    child.on('error', (err) => {
      this.spawnError = err.message
      this.childExited = true
      this.emitLine('stderr', 'spawn error: ' + err.message)
    })
    child.on('exit', (code, signal) => {
      this.childExited = true
      this.emitLine('stderr', 'process exited (code=' + code + ', signal=' + signal + ')')
      if (!this.stopping && (this.state === 'starting' || this.state === 'running')) {
        this.setState('error', 'harness 进程意外退出')
        this.child = null
        this.ownPid = null
      }
    })

    const healthy = await this.waitForHealthy()
    if (healthy) {
      this.setState('running')
    } else {
      this.setState('error', this.spawnError ?? '健康检查超时')
    }
    return this.getStatus()
  }

  async stop(): Promise<{ stoppedOwn: boolean }> {
    if (this.state === 'reused' || this.state === 'idle') {
      return { stoppedOwn: false }
    }
    this.stopping = true
    const pid = this.ownPid
    if (pid) {
      await this.killTree(pid)
    }
    this.child = null
    this.ownPid = null
    this.startedAt = null
    this.childExited = false
    this.spawnError = null
    this.stopping = false
    this.setState('idle')
    return { stoppedOwn: true }
  }

  async restart(): Promise<HarnessStatus> {
    await this.stop()
    // 等待端口完全释放，避免新进程 EADDRINUSE
    await this.sleep(300)
    return this.start()
  }

  private setState(s: HarnessState, error?: string): void {
    this.state = s
    this.errorMessage = error ?? null
    this.emit('status-changed', this.getStatus())
  }

  private emitLine(stream: 'stdout' | 'stderr', line: string): void {
    let clean = line
    if (clean.endsWith('\r')) clean = clean.slice(0, -1)
    if (clean.length === 0) return
    const tagged = '[' + stream + '] ' + clean
    this.logs.push(tagged)
    if (this.logs.length > this.opts.logMaxLines) {
      this.logs.splice(0, this.logs.length - this.opts.logMaxLines)
    }
    this.emit('log', tagged)
  }

  private onData(stream: 'stdout' | 'stderr', data: string): void {
    const buf = stream === 'stdout' ? this.stdoutBuf : this.stderrBuf
    const combined = buf + data
    const lines = combined.split('\n')
    const rest = lines.pop() ?? ''
    if (stream === 'stdout') this.stdoutBuf = rest
    else this.stderrBuf = rest
    for (const line of lines) this.emitLine(stream, line)
  }

  private onStreamEnd(stream: 'stdout' | 'stderr'): void {
    const rest = stream === 'stdout' ? this.stdoutBuf : this.stderrBuf
    if (stream === 'stdout') this.stdoutBuf = ''
    else this.stderrBuf = ''
    if (rest.length > 0) this.emitLine(stream, rest)
  }

  private checkTcp(): Promise<boolean> {
    return new Promise((resolve) => {
      const sock = connect({ port: this.opts.port, host: '127.0.0.1' })
      let settled = false
      const done = (v: boolean): void => {
        if (!settled) {
          settled = true
          resolve(v)
        }
      }
      sock.on('connect', () => {
        sock.destroy()
        done(true)
      })
      sock.on('error', () => {
        sock.destroy()
        done(false)
      })
      sock.setTimeout(500, () => {
        sock.destroy()
        done(false)
      })
    })
  }

  private checkHttp(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = get(
        { host: '127.0.0.1', port: this.opts.port, path: '/', timeout: 1000 },
        (res) => {
          res.resume()
          resolve(true)
        }
      )
      req.on('error', () => resolve(false))
      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
    })
  }

  private async isHealthy(): Promise<boolean> {
    if (!(await this.checkTcp())) return false
    return this.checkHttp()
  }

  private async waitForHealthy(): Promise<boolean> {
    const deadline = Date.now() + this.opts.healthTimeoutMs
    while (Date.now() < deadline) {
      if (this.spawnError) return false
      if (this.childExited && this.child === null) return false
      if (await this.isHealthy()) return true
      await this.sleep(this.opts.healthIntervalMs)
    }
    return false
  }

  private killTree(pid: number): Promise<void> {
    return new Promise((resolve) => {
      try {
        const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
          windowsHide: true
        })
        killer.on('error', () => resolve())
        killer.on('exit', () => resolve())
      } catch {
        resolve()
      }
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
  }
}
