import { appendFileSync, existsSync, statSync, renameSync, rmSync, mkdirSync } from 'fs'
import { dirname } from 'path'

/**
 * 滚动日志：把 harness 后端日志落盘，超过 maxBytes 轮转，保留最近 maxFiles 份。
 */
export class RollingLogger {
  constructor(
    private readonly basePath: string,
    private readonly maxBytes = 1024 * 1024,
    private readonly maxFiles = 5
  ) {
    mkdirSync(dirname(basePath), { recursive: true })
  }

  append(line: string): void {
    if (existsSync(this.basePath) && statSync(this.basePath).size + line.length + 1 > this.maxBytes) {
      this.rotate()
    }
    appendFileSync(this.basePath, line + '\n', 'utf-8')
  }

  private rotate(): void {
    const oldest = this.basePath + '.' + (this.maxFiles - 1)
    if (existsSync(oldest)) rmSync(oldest, { force: true })
    for (let i = this.maxFiles - 2; i >= 0; i--) {
      const src = i === 0 ? this.basePath : this.basePath + '.' + i
      const dst = this.basePath + '.' + (i + 1)
      if (existsSync(src)) renameSync(src, dst)
    }
  }
}
