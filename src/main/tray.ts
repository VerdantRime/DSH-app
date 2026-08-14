import { Tray, Menu, nativeImage, type BrowserWindow, type NativeImage } from 'electron'
import { IPC } from '../shared/types'

// 生成一个可见的 16x16 占位图标（纯色方块，Phase 后续可换成正式图标）
function makeTrayImage(): NativeImage {
  const size = 16
  const buf = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    buf[i * 4 + 0] = 0xda // B
    buf[i * 4 + 1] = 0x69 // G
    buf[i * 4 + 2] = 0x09 // R
    buf[i * 4 + 3] = 0xff // A
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}

export function createTray(win: BrowserWindow, onQuit: () => void): Tray {
  const image = makeTrayImage()
  const tray = new Tray(image)
  tray.setToolTip('DSH 工作台')

  function showAndNav(panel: string): void {
    win.show()
    win.webContents.send(IPC.appNavigate, panel)
  }

  const menu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => win.show() },
    { type: 'separator' },
    { label: '聊天', click: () => showAndNav('chat') },
    { label: 'GitHub', click: () => showAndNav('github') },
    { label: '设置', click: () => showAndNav('settings') },
    { type: 'separator' },
    { label: '退出', click: onQuit }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => {
    if (win.isVisible()) win.hide()
    else win.show()
  })
  return tray
}
