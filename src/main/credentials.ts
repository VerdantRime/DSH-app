import { promises as fs } from 'fs'
import { dirname } from 'path'

export interface SecretCipher {
  encrypt(text: string): string
  decrypt(cipherText: string): string
}

export interface GithubCredentials {
  tokenEncrypted: string
  username: string
}

/**
 * GitHub 凭据存储：token 用注入的 cipher（生产环境为 Electron safeStorage/DPAPI）加密，
 * 明文 token 绝不落盘。纯 Node 实现，便于单测。
 */
export class CredentialsStore {
  constructor(private readonly path: string, private readonly cipher: SecretCipher) {}

  async get(): Promise<GithubCredentials | null> {
    try {
      const raw = await fs.readFile(this.path, 'utf-8')
      return JSON.parse(raw) as GithubCredentials
    } catch {
      return null
    }
  }

  async getToken(): Promise<string | null> {
    const c = await this.get()
    if (!c) return null
    try {
      return this.cipher.decrypt(c.tokenEncrypted)
    } catch {
      return null
    }
  }

  async getUsername(): Promise<string | null> {
    const c = await this.get()
    return c?.username ?? null
  }

  async setToken(token: string, username: string): Promise<void> {
    const tokenEncrypted = this.cipher.encrypt(token)
    await this.write({ tokenEncrypted, username })
  }

  async clear(): Promise<void> {
    try {
      await fs.rm(this.path, { force: true })
    } catch {
      // ignore
    }
  }

  private async write(data: GithubCredentials): Promise<void> {
    await fs.mkdir(dirname(this.path), { recursive: true })
    const tmp = this.path + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
    await fs.rename(tmp, this.path)
  }
}
