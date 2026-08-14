import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const html = readFileSync(join(process.cwd(), 'src', 'renderer', 'index.html'), 'utf-8')

describe('聊天面板控制条', () => {
  it('已移除 启动/停止/重启 按钮', () => {
    expect(html).not.toContain('id="hc-start"')
    expect(html).not.toContain('id="hc-stop"')
    expect(html).not.toContain('id="hc-restart"')
  })

  it('保留 浏览器打开 / 复制地址 / 日志', () => {
    expect(html).toContain('id="hc-open"')
    expect(html).toContain('id="hc-copy"')
    expect(html).toContain('id="hc-logtoggle"')
  })
})
