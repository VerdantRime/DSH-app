import { join, dirname } from 'path'
import { createBackup, restoreBackup } from './backup'

export interface BackupService {
  create: (destPath?: string) => Promise<{ path: string }>
  restore: (srcPath: string) => Promise<{ ok: boolean }>
}

export function createBackupService(userDataDir: string, dshDir: string): BackupService {
  const backupsDir = join(dirname(userDataDir), 'dsh-workdesk-backups')
  const sources = [
    { srcPath: userDataDir, name: 'app-data' },
    { srcPath: dshDir, name: 'dsh' }
  ]
  const targets = [
    { name: 'app-data', destPath: userDataDir },
    { name: 'dsh', destPath: dshDir }
  ]
  return {
    async create(destPath?: string): Promise<{ path: string }> {
      const dest = destPath || join(backupsDir, 'backup-' + Date.now() + '.zip')
      createBackup(sources, dest)
      return { path: dest }
    },
    async restore(srcPath: string): Promise<{ ok: boolean }> {
      // 恢复前先自动备份当前，防止覆盖丢数据
      const pre = join(backupsDir, 'pre-restore-' + Date.now() + '.zip')
      createBackup(sources, pre)
      restoreBackup(srcPath, targets)
      return { ok: true }
    }
  }
}
