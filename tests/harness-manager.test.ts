import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createServer } from 'http'
import { connect } from 'net'
import { HarnessManager } from '../src/main/harness-manager'

// 假 harness：启动一个 HTTP 服务并打印 stdout/stderr + 环境变量（验证 env 透传）
const FIXTURE = [
  "const http = require('http')",
  "const port = Number(process.argv[2])",
  "const server = http.createServer((req, res) => { res.writeHead(200); res.end('ok') })",
  "server.listen(port, '127.0.0.1', () => {",
  "  console.log('listening ' + port)",
  "  console.error('marker ' + process.env.TEST_MARKER)",
  "})"
].join('\n')

let fixDir = ''
let fixturePath = ''

beforeAll(async () => {
  fixDir = await fs.mkdtemp(join(tmpdir(), 'dsh-fix-'))
  fixturePath = join(fixDir, 'fixture.js')
  await fs.writeFile(fixturePath, FIXTURE, 'utf-8')
})

afterAll(async () => {
  await fs.rm(fixDir, { recursive: true, force: true })
})

function makeManager(port: number): HarnessManager {
  return new HarnessManager({
    port,
    command: process.execPath,
    args: [fixturePath, String(port)],
    env: { ...process.env, TEST_MARKER: 'hello-marker' },
    shell: false,
    healthTimeoutMs: 8000,
    healthIntervalMs: 150
  })
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address() as { port: number }
      const p = addr.port
      s.close(() => resolve(p))
    })
    s.on('error', reject)
  })
}

function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = connect({ port, host: '127.0.0.1' })
    sock.on('connect', () => {
      sock.destroy()
      resolve(true)
    })
    sock.on('error', () => resolve(false))
    sock.setTimeout(800, () => {
      sock.destroy()
      resolve(false)
    })
  })
}

describe('HarnessManager', () => {
  it('启动→running→捕获日志(含env透传)→停止→释放端口', async () => {
    const port = await freePort()
    const m = makeManager(port)
    const st = await m.start()
    expect(st.state).toBe('running')
    expect(st.source).toBe('app')
    expect(st.pid).toBeTruthy()

    const logs = m.getLogs().join('\n')
    expect(logs).toContain('[stdout] listening')
    expect(logs).toContain('[stderr] marker hello-marker')

    const stopRes = await m.stop()
    expect(stopRes.stoppedOwn).toBe(true)
    expect(m.getStatus().state).toBe('idle')

    await new Promise((r) => setTimeout(r, 600))
    expect(await portOpen(port)).toBe(false)
  })

  it('端口已被占用时复用外部、且不接管停止', async () => {
    const srv = createServer((_req, res) => {
      res.writeHead(200)
      res.end('ok')
    })
    await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', () => resolve()))
    const addr = srv.address() as { port: number }

    const m = makeManager(addr.port)
    const st = await m.start()
    expect(st.state).toBe('reused')
    expect(st.source).toBe('external')
    expect(st.pid).toBeNull()

    const stopRes = await m.stop()
    expect(stopRes.stoppedOwn).toBe(false)
    expect(await portOpen(addr.port)).toBe(true)

    await new Promise<void>((resolve) => srv.close(() => resolve()))
  })

  it('状态变化会触发 status-changed 事件', async () => {
    const port = await freePort()
    const m = makeManager(port)
    const states: string[] = []
    m.on('status-changed', (s) => states.push(s.state))
    await m.start()
    expect(states).toContain('starting')
    expect(states).toContain('running')
    await m.stop()
    expect(states[states.length - 1]).toBe('idle')
  })

  it('重启后仍为 running 且端口在服务', async () => {
    const port = await freePort()
    const m = makeManager(port)
    await m.start()
    const st = await m.restart()
    expect(st.state).toBe('running')
    expect(await portOpen(port)).toBe(true)
    await m.stop()
  })
})
