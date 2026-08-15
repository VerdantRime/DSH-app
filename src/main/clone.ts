import { spawn } from 'child_process'

/** 从仓库 URL 提取目录名（去 .git、取最后一段）。 */
export function repoNameFromUrl(url: string): string {
  const cleaned = url.trim().replace(/\/+$/, '')
  const noSuffix = cleaned.replace(/\.git$/i, '')
  const i = Math.max(noSuffix.lastIndexOf('/'), noSuffix.lastIndexOf(':'))
  return i < 0 ? noSuffix : noSuffix.slice(i + 1)
}

/** 校验克隆地址；合法返回 null，否则返回中文错误。 */
export function validateCloneUrl(url: string): string | null {
  const u = url.trim()
  if (!u) return '请输入仓库地址'
  if (/\s/.test(u)) return '地址不能包含空格'
  if (!/^(https?:\/\/|git@)/i.test(u)) return '地址需以 https:// 或 git@ 开头'
  return null
}

/** 用系统 git 克隆仓库到目标目录。 */
export function cloneRepo(url: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['clone', url, destDir], { windowsHide: true })
    let err = ''
    child.stderr?.on('data', (d) => { err += d })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(err.trim() || ('git clone 退出码 ' + code)))
    })
  })
}
