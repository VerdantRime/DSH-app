import { Tray, Menu, nativeImage, type BrowserWindow } from 'electron'
import { IPC } from '../shared/types'

// 应用图标（32x32 PNG，base64 内嵌，避免打包路径问题）
const TRAY_ICON_B64 = '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'

export function createTray(win: BrowserWindow, onQuit: () => void): Tray {
  const image = nativeImage.createFromDataURL('data:image/png;base64,' + TRAY_ICON_B64)
  const tray = new Tray(image)
  tray.setToolTip('DeepSeek工作台')

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
