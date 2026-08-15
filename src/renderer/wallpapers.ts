import w1 from './assets/wallpapers/wallpaper-1.png'
import w2 from './assets/wallpapers/wallpaper-2.png'
import w3 from './assets/wallpapers/wallpaper-3.png'
import w4 from './assets/wallpapers/wallpaper-4.png'
import w5 from './assets/wallpapers/wallpaper-5.png'

export interface Wallpaper { id: string; label: string; url: string }

export const WALLPAPERS: Wallpaper[] = [
  { id: 'wallpaper-1', label: '水彩云朵', url: w1 },
  { id: 'wallpaper-2', label: '樱花山丘', url: w2 },
  { id: 'wallpaper-3', label: '渐变云朵', url: w3 },
  { id: 'wallpaper-4', label: '黎明星空', url: w4 },
  { id: 'wallpaper-5', label: '极简白云', url: w5 }
]

/** 解析壁纸 id -> 图片 URL；'none' 返回 null，'random' 返回随机一张。 */
export function resolveWallpaper(id: string): string | null {
  if (!id || id === 'none') return null
  if (id === 'random') return WALLPAPERS[Math.floor(Math.random() * WALLPAPERS.length)].url
  const w = WALLPAPERS.find((x) => x.id === id)
  return w ? w.url : null
}
