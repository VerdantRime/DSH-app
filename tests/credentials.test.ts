import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { CredentialsStore, type SecretCipher } from '../src/main/credentials'

const cipher: SecretCipher = {
  encrypt: (t) => Buffer.from(t, 'utf-8').toString('base64'),
  decrypt: (c) => Buffer.from(c, 'base64').toString('utf-8')
}

let dir = ''
beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'dsh-cred-'))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('CredentialsStore', () => {
  it('加密存取 token，明文不落盘', async () => {
    const p = join(dir, 'github.json')
    const store = new CredentialsStore(p, cipher)
    await store.setToken('secret-token-123', 'alice')
    const raw = await fs.readFile(p, 'utf-8')
    expect(raw).not.toContain('secret-token-123')
    expect(await store.getToken()).toBe('secret-token-123')
    expect(await store.getUsername()).toBe('alice')
  })

  it('clear 后返回 null', async () => {
    const p = join(dir, 'github.json')
    const store = new CredentialsStore(p, cipher)
    await store.setToken('abc', 'bob')
    await store.clear()
    expect(await store.getToken()).toBeNull()
    expect(await store.get()).toBeNull()
  })

  it('文件缺失时返回 null', async () => {
    const store = new CredentialsStore(join(dir, 'nope.json'), cipher)
    expect(await store.get()).toBeNull()
    expect(await store.getToken()).toBeNull()
  })
})
