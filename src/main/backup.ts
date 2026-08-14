import AdmZip from 'adm-zip'
import { existsSync, cpSync, mkdtempSync, rmSync, mkdirSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname } from 'path'

export interface BackupSource {
  srcPath: string
  name: string
}

export interface RestoreTarget {
  name: string
  destPath: string
}

export function createBackup(sources: BackupSource[], destZipPath: string): string {
  mkdirSync(dirname(destZipPath), { recursive: true })
  const zip = new AdmZip()
  for (const s of sources) {
    if (existsSync(s.srcPath)) zip.addLocalFolder(s.srcPath, s.name)
  }
  zip.writeZip(destZipPath)
  return destZipPath
}

export function restoreBackup(zipPath: string, targets: RestoreTarget[]): void {
  const zip = new AdmZip(zipPath)
  const tmp = mkdtempSync(join(tmpdir(), 'dsh-restore-'))
  zip.extractAllTo(tmp, true)
  for (const t of targets) {
    const src = join(tmp, t.name)
    if (!existsSync(src)) continue
    mkdirSync(t.destPath, { recursive: true })
    for (const entry of readdirSync(src)) {
      cpSync(join(src, entry), join(t.destPath, entry), { recursive: true, force: true })
    }
  }
  rmSync(tmp, { recursive: true, force: true })
}
