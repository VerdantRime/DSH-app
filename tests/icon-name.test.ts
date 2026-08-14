import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const png = readFileSync(join(process.cwd(), 'build', 'icon.png'))
const html = readFileSync(join(process.cwd(), 'src', 'renderer', 'index.html'), 'utf-8')
const yml = readFileSync(join(process.cwd(), 'electron-builder.yml'), 'utf-8')
const tray = readFileSync(join(process.cwd(), 'src', 'main', 'tray.ts'), 'utf-8')

describe('应用图标与名称', () => {
  it('build/icon.png 是有效的 512x512 PNG', () => {
    expect(png[0]).toBe(0x89)
    expect(png[1]).toBe(0x50)
    expect(png[2]).toBe(0x4e)
    expect(png[3]).toBe(0x47)
    expect(png.readUInt32BE(16)).toBe(512)
    expect(png.readUInt32BE(20)).toBe(512)
  })

  it('窗口标题改为 DeepSeek工作台', () => {
    expect(html).toContain('<title>DeepSeek工作台</title>')
    expect(html).not.toContain('DSH 工作台')
  })

  it('electron-builder productName 改为 DeepSeek工作台', () => {
    expect(yml).toContain('productName: DeepSeek工作台')
    expect(yml).not.toContain('DSH Workdesk')
  })

  it('托盘图标改用真实图标（非纯色位图）', () => {
    expect(tray).toContain('createFromDataURL')
    expect(tray).not.toContain('createFromBitmap')
  })
})
