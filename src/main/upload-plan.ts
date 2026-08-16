import { promises as fs } from 'fs'
import { join } from 'path'

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

export interface UploadPlanFile { localPath: string; repoPath: string; size: number }
export interface UploadSkip { path: string; reason: string }

export function toPosix(p: string): string {
  return p.replace(/\\/g, '/')
}

/** 递归列出目录下所有文件（跳过 .git 目录）。 */
export async function walkFiles(dir: string): Promise<{ path: string; size: number }[]> {
  const out: { path: string; size: number }[] = []
  const stack = [dir]
  while (stack.length) {
    const cur = stack.pop()!
    let entries
    try { entries = await fs.readdir(cur, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      const p = join(cur, e.name)
      if (e.isDirectory()) {
        if (e.name !== '.git') stack.push(p)
      } else if (e.isFile()) {
        const st = await fs.stat(p).catch(() => null)
        out.push({ path: p, size: st?.size ?? 0 })
      }
    }
  }
  return out
}

/** 由扫描到的本地文件构建上传计划：映射仓库相对路径、跳过 .git 与超大文件。 */
export function buildUploadPlan(
  entries: { path: string; size: number }[],
  rootDir: string,
  baseRepoDir: string,
  mode: 'files' | 'folder'
): { files: UploadPlanFile[]; skipped: UploadSkip[] } {
  const root = toPosix(rootDir)
  const base = baseRepoDir.replace(/^\/+|\/+$/g, '')
  const files: UploadPlanFile[] = []
  const skipped: UploadSkip[] = []
  for (const e of entries) {
    const local = toPosix(e.path)
    let rel: string
    if (mode === 'folder') {
      rel = local === root ? '' : local.startsWith(root + '/') ? local.slice(root.length + 1) : local
    } else {
      const i = local.lastIndexOf('/')
      rel = i < 0 ? local : local.slice(i + 1)
    }
    if (rel.split('/').includes('.git')) {
      skipped.push({ path: e.path, reason: '跳过 .git' })
      continue
    }
    if (e.size > MAX_UPLOAD_BYTES) {
      skipped.push({ path: e.path, reason: '超过 100MB' })
      continue
    }
    const repoPath = base ? base + '/' + rel : rel
    files.push({ localPath: e.path, repoPath, size: e.size })
  }
  return { files, skipped }
}
