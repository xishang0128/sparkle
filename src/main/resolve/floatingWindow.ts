import { is } from '@electron-toolkit/utils'
import { BrowserWindow, ipcMain } from 'electron'
import windowStateKeeper from 'electron-window-state'
import { join } from 'path'
import { getAppConfig, patchAppConfig } from '../config'
import { applyTheme } from './theme'
import { buildContextMenu, showTrayIcon } from './tray'

export let floatingWindow: BrowserWindow | null = null
let triggerTimeoutRef: NodeJS.Timeout | null = null

async function preallocateGpuResources(): Promise<void> {
  const preallocWin = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    frame: false,
    webPreferences: {
      offscreen: true,
      sandbox: true
    }
  })
  await preallocWin.loadURL('about:blank')
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!preallocWin.isDestroyed()) preallocWin.destroy()
      resolve()
    }, 300)
  })
}

async function createFloatingWindow(): Promise<void> {
  // 预分配 GPU 资源，防止在创建悬浮窗时卡死
  await preallocateGpuResources()

  const floatingWindowState = windowStateKeeper({
    file: 'floating-window-state.json'
  })
  const { customTheme = 'default.css' } = await getAppConfig()
  floatingWindow = new BrowserWindow({
    width: 120,
    height: 42,
    x: floatingWindowState.x,
    y: floatingWindowState.y,
    show: false,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    transparent: true,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    closable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      spellcheck: false,
      sandbox: false,
      ...(is.dev ? { webSecurity: false } : {})
    }
  })
  floatingWindowState.manage(floatingWindow)
  floatingWindow.on('ready-to-show', () => {
    applyTheme(customTheme)
    floatingWindow?.show()
    floatingWindow?.setAlwaysOnTop(true, 'screen-saver')
  })
  floatingWindow.on('moved', () => {
    if (floatingWindow) floatingWindowState.saveState(floatingWindow)
  })
  ipcMain.on('updateFloatingWindow', () => {
    if (floatingWindow) {
      floatingWindow?.webContents.send('controledMihomoConfigUpdated')
      floatingWindow?.webContents.send('appConfigUpdated')
    }
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    floatingWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/floating.html`)
  } else {
    floatingWindow.loadFile(join(__dirname, '../renderer/floating.html'))
  }
}

export async function showFloatingWindow(): Promise<void> {
  if (floatingWindow) {
    floatingWindow.show()
  } else {
    await createFloatingWindow()
  }
}

export async function triggerFloatingWindow(): Promise<void> {
  if (triggerTimeoutRef) {
    clearTimeout(triggerTimeoutRef)
    triggerTimeoutRef = null
  }

  if (floatingWindow?.isVisible()) {
    await patchAppConfig({ showFloatingWindow: false })
    await closeFloatingWindow()
  } else {
    await showFloatingWindow()
    triggerTimeoutRef = setTimeout(async () => {
      await patchAppConfig({ showFloatingWindow: true })
      triggerTimeoutRef = null
    }, 1000)
  }
}

export async function closeFloatingWindow(): Promise<void> {
  if (floatingWindow) {
    floatingWindow.close()
    floatingWindow.destroy()
    floatingWindow = null
  }
  await showTrayIcon()
  await patchAppConfig({ disableTray: false })
}

export async function showContextMenu(): Promise<void> {
  const menu = await buildContextMenu()
  menu.popup()
}
