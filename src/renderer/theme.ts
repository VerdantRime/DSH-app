import type { ThemeMode } from '../shared/types'

export type ResolvedTheme = 'light' | 'dark' | 'anime'

export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === 'light') return 'light'
  if (mode === 'dark') return 'dark'
  if (mode === 'anime') return 'anime'
  return systemDark ? 'dark' : 'light'
}

export function nextTheme(current: ThemeMode): ThemeMode {
  if (current === 'system') return 'light'
  if (current === 'light') return 'dark'
  if (current === 'dark') return 'anime'
  return 'system'
}

export function themeLabel(mode: ThemeMode): string {
  if (mode === 'system') return '跟随系统'
  if (mode === 'light') return '浅色'
  if (mode === 'dark') return '深色'
  return '二次元'
}
