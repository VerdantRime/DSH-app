import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createBackupService } from '../src/main/backup-service'

let dir = ''
beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'dsh-bsvc-'))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('backup-service', () => {
  it('创建备份并恢复', async () => {
    const userData = join(dir, 'userData')
    const dsh = join(dir, 'dsh')
    await fs.mkdir(userData, { recursive: true })
    await fs.mkdir(dsh, { recursive: true })
    await fs.writeFile(join(userData, 'config.json'), '{}', 'utf-8')
    await fs.writeFile(join(dsh, 'settings.yaml'), 'x: y', 'utf-8')

    const svc = createBackupService(userData, dsh)
    const { path } = await svc.create()
    expect(path).toContain('.zip')

    await fs.writeFile(join(dsh, 'settings.yaml'), 'broken', 'utf-8')
    await svc.restore(path)
    expect(await fs.readFile(join(dsh, 'settings.yaml'), 'utf-8')).toBe('x: y')
  })
})
