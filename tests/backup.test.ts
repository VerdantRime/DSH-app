import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createBackup, restoreBackup } from '../src/main/backup'

let dir = ''
beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'dsh-bak-'))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('backup', () => {
  it('打包并恢复往返一致', async () => {
    const src = join(dir, 'dsh')
    await fs.mkdir(join(src, 'sessions'), { recursive: true })
    await fs.writeFile(join(src, 'settings.yaml'), 'a: 1', 'utf-8')
    await fs.writeFile(join(src, 'sessions', 's.jsonl'), 'line', 'utf-8')

    const zipPath = join(dir, 'backup.zip')
    createBackup([{ srcPath: src, name: 'dsh' }], zipPath)
    expect(existsSync(zipPath)).toBe(true)

    const dest = join(dir, 'restored')
    restoreBackup(zipPath, [{ name: 'dsh', destPath: dest }])
    expect(await fs.readFile(join(dest, 'settings.yaml'), 'utf-8')).toBe('a: 1')
    expect(await fs.readFile(join(dest, 'sessions', 's.jsonl'), 'utf-8')).toBe('line')
  })
})
