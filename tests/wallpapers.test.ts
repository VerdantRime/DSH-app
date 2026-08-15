import { describe, it, expect } from 'vitest'
import { WALLPAPERS, resolveWallpaper } from '../src/renderer/wallpapers'

describe('壁纸', () => {
  it('打包 5 张壁纸', () => {
    expect(WALLPAPERS.length).toBe(5)
    expect(WALLPAPERS.every((w) => w.url && w.label)).toBe(true)
  })

  it('resolveWallpaper 解析 none/random/id', () => {
    expect(resolveWallpaper('none')).toBeNull()
    expect(resolveWallpaper('')).toBeNull()
    expect(resolveWallpaper('wallpaper-3')).toBe(WALLPAPERS[2].url)
    expect(resolveWallpaper('random')).toBeTruthy()
    expect(resolveWallpaper('bad')).toBeNull()
  })
})
