import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcMainHandlers } from './utils/ipc'
import windowStateKeeper from 'electron-window-state'
import {
  app,
  shell,
  BrowserWindow,
  Menu,
  dialog,
  Notification,
  powerMonitor,
  ipcMain
} from 'electron'
import { addOverrideItem, addProfileItem, getAppConfig } from './config'
import { quitWithoutCore, startCore, stopCore } from './core/manager'
import { triggerSysProxy } from './sys/sysproxy'
import icon from '../../resources/icon.png?asset'
import { createTray } from './resolve/tray'
import { createApplicationMenu } from './resolve/menu'
import { init } from './utils/init'
import { join } from 'path'
import { initShortcut } from './resolve/shortcut'
import { execSync, spawn } from 'child_process'
import { createElevateTask } from './sys/misc'
import { initProfileUpdater } from './core/profileUpdater'
import { existsSync, writeFileSync } from 'fs'
import { exePath, taskDir } from './utils/dirs'
import path from 'path'
import { startMonitor } from './resolve/trafficMonitor'
import { showFloatingWindow } from './resolve/floatingWindow'
import iconv from 'iconv-lite'
import { getAppConfigSync } from './config/app'

let quitTimeout: NodeJS.Timeout | null = null
export let mainWindow: BrowserWindow | null = null

if (process.platform === 'win32' && !is.dev && !process.argv.includes('noadmin')) {
  try {
    createElevateTask()
  } catch (createError) {
    try {
      if (process.argv.slice(1).length > 0) {
        writeFileSync(path.join(taskDir(), 'param.txt'), process.argv.slice(1).join(' '))
      } else {
        writeFileSync(path.join(taskDir(), 'param.txt'), 'empty')
      }
      if (!existsSync(path.join(taskDir(), 'sparkle-run.exe'))) {
        throw new Error('sparkle-run.exe not found')
      } else {
        execSync('%SystemRoot%\\System32\\schtasks.exe /run /tn sparkle-run')
      }
    } catch (e) {
      let createErrorStr = `${createError}`
      let eStr = `${e}`
      try {
        createErrorStr = iconv.decode((createError as { stderr: Buffer }).stderr, 'gbk')
        eStr = iconv.decode((e as { stderr: Buffer }).stderr, 'gbk')
      } catch {
        // ignore
      }
      dialog.showErrorBox(
        '首次启动请以管理员权限运行',
        `首次启动请以管理员权限运行\n${createErrorStr}\n${eStr}`
      )
    } finally {
      app.exit()
    }
  }
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
}

export function customRelaunch(): void {
  const script = `while kill -0 ${process.pid} 2>/dev/null; do
  sleep 0.1
done
${process.argv.join(' ')} & disown
exit
`
  spawn('sh', ['-c', `"${script}"`], {
    shell: true,
    detached: true,
    stdio: 'ignore'
  })
}

if (process.platform === 'linux') {
  app.relaunch = customRelaunch
}

if (process.platform === 'win32' && !exePath().startsWith('C')) {
  // https://github.com/electron/electron/issues/43278
  // https://github.com/electron/electron/issues/36698
  app.commandLine.appendSwitch('in-process-gpu')
}

const initPromise = init()

const syncConfig = getAppConfigSync()
if (syncConfig.disableGPU) {
  app.disableHardwareAcceleration()
}

app.on('second-instance', async (_event, commandline) => {
  showMainWindow()
  const url = commandline.pop()
  if (url) {
    await handleDeepLink(url)
  }
})

app.on('open-url', async (_event, url) => {
  showMainWindow()
  await handleDeepLink(url)
})

let isQuitting = false,
  notQuit = false

export function setNotQuit(): void {
  notQuit = true
}

function showWindow(): number {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    } else if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
    mainWindow.focusOnWebView()
    mainWindow.setAlwaysOnTop(true, 'pop-up-menu')
    mainWindow.focus()
    mainWindow.setAlwaysOnTop(false)

    if (!mainWindow.isMinimized()) {
      return 100
    }
  }
  return 500
}

function showQuitConfirmDialog(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!mainWindow) {
      resolve(true)
      return
    }

    const delay = showWindow()
    setTimeout(() => {
      mainWindow?.webContents.send('show-quit-confirm')
      const handleQuitConfirm = (_event: Electron.IpcMainEvent, confirmed: boolean): void => {
        ipcMain.off('quit-confirm-result', handleQuitConfirm)
        resolve(confirmed)
      }
      ipcMain.once('quit-confirm-result', handleQuitConfirm)
    }, delay)
  })
}

app.on('before-quit', async (e) => {
  if (!isQuitting && !notQuit) {
    e.preventDefault()

    const confirmed = await showQuitConfirmDialog()

    if (confirmed) {
      isQuitting = true
      triggerSysProxy(false, false)
      await stopCore()
      app.exit()
    }
  } else if (notQuit) {
    isQuitting = true
    triggerSysProxy(false, false)
    await stopCore()
    app.exit()
  }
})

powerMonitor.on('shutdown', async () => {
  triggerSysProxy(false, false)
  await stopCore()
  app.exit()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('sparkle.app')
  try {
    await initPromise
  } catch (e) {
    dialog.showErrorBox('应用初始化失败', `${e}`)
    app.quit()
  }
  try {
    const [startPromise] = await startCore()
    startPromise.then(async () => {
      await initProfileUpdater()
    })
  } catch (e) {
    dialog.showErrorBox('内核启动出错', `${e}`)
  }
  try {
    await startMonitor()
  } catch {
    // ignore
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  const { showFloatingWindow: showFloating = false, disableTray = false } = await getAppConfig()
  registerIpcMainHandlers()
  await createWindow()
  if (showFloating) {
    showFloatingWindow()
  }
  if (!disableTray) {
    await createTray()
  }
  await initShortcut()
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    showMainWindow()
  })
})

async function handleDeepLink(url: string): Promise<void> {
  if (!url.startsWith('clash://') && !url.startsWith('mihomo://') && !url.startsWith('sparkle://'))
    return

  const urlObj = new URL(url)
  switch (urlObj.host) {
    case 'install-config': {
      try {
        const profileUrl = urlObj.searchParams.get('url')
        const profileName = urlObj.searchParams.get('name')
        if (!profileUrl) {
          throw new Error('缺少参数 url')
        }

        const confirmed = await showProfileInstallConfirm(profileUrl, profileName)

        if (confirmed) {
          await addProfileItem({
            type: 'remote',
            name: profileName ?? undefined,
            url: profileUrl
          })
          mainWindow?.webContents.send('profileConfigUpdated')
          new Notification({ title: '订阅导入成功' }).show()
        }
      } catch (e) {
        dialog.showErrorBox('订阅导入失败', `${url}\n${e}`)
      }
      break
    }
    case 'install-override': {
      try {
        const urlParam = urlObj.searchParams.get('url')
        const profileName = urlObj.searchParams.get('name')
        if (!urlParam) {
          throw new Error('缺少参数 url')
        }

        const confirmed = await showOverrideInstallConfirm(urlParam, profileName)

        if (confirmed) {
          const url = new URL(urlParam)
          const name = url.pathname.split('/').pop()
          await addOverrideItem({
            type: 'remote',
            name: profileName ?? (name ? decodeURIComponent(name) : undefined),
            url: urlParam,
            ext: url.pathname.endsWith('.js') ? 'js' : 'yaml'
          })
          mainWindow?.webContents.send('overrideConfigUpdated')
          new Notification({ title: '覆写导入成功' }).show()
        }
      } catch (e) {
        dialog.showErrorBox('覆写导入失败', `${url}\n${e}`)
      }
      break
    }
  }
}

async function showProfileInstallConfirm(url: string, name?: string | null): Promise<boolean> {
  if (!mainWindow) {
    return false
  }
  let extractedName = name

  if (!extractedName) {
    try {
      const { userAgent } = await getAppConfig()
      const axios = (await import('axios')).default
      const response = await axios.head(url, {
        headers: {
          'User-Agent': userAgent || 'clash.meta/alpha-de19f92'
        },
        timeout: 5000
      })

      if (response.headers['content-disposition']) {
        extractedName = parseFilename(response.headers['content-disposition'])
      }
    } catch (error) {
      // ignore
    }
  }

  return new Promise((resolve) => {
    const delay = showWindow()
    setTimeout(() => {
      mainWindow?.webContents.send('show-profile-install-confirm', {
        url,
        name: extractedName || name
      })
      const handleConfirm = (_event: Electron.IpcMainEvent, confirmed: boolean): void => {
        ipcMain.off('profile-install-confirm-result', handleConfirm)
        resolve(confirmed)
      }
      ipcMain.once('profile-install-confirm-result', handleConfirm)
    }, delay)
  })
}

function parseFilename(str: string): string {
  if (str.match(/filename\*=.*''/)) {
    const filename = decodeURIComponent(str.split(/filename\*=.*''/)[1])
    return filename
  } else {
    const filename = str.split('filename=')[1]
    return filename?.replace(/"/g, '') || ''
  }
}

function showOverrideInstallConfirm(url: string, name?: string | null): Promise<boolean> {
  return new Promise((resolve) => {
    if (!mainWindow) {
      resolve(false)
      return
    }

    let finalName = name
    if (!finalName) {
      const urlObj = new URL(url)
      const pathName = urlObj.pathname.split('/').pop()
      finalName = pathName ? decodeURIComponent(pathName) : undefined
    }

    const delay = showWindow()
    setTimeout(() => {
      mainWindow?.webContents.send('show-override-install-confirm', {
        url,
        name: finalName
      })
      const handleConfirm = (_event: Electron.IpcMainEvent, confirmed: boolean): void => {
        ipcMain.off('override-install-confirm-result', handleConfirm)
        resolve(confirmed)
      }
      ipcMain.once('override-install-confirm-result', handleConfirm)
    }, delay)
  })
}

export async function createWindow(): Promise<void> {
  const { useWindowFrame = false } = await getAppConfig()
  const mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 700,
    file: 'window-state.json'
  })
  // https://github.com/electron/electron/issues/16521#issuecomment-582955104
  if (process.platform === 'darwin') {
    await createApplicationMenu()
  } else {
    Menu.setApplicationMenu(null)
  }
  mainWindow = new BrowserWindow({
    minWidth: 800,
    minHeight: 600,
    width: mainWindowState.width,
    height: mainWindowState.height,
    x: mainWindowState.x,
    y: mainWindowState.y,
    show: false,
    frame: useWindowFrame,
    fullscreenable: false,
    titleBarStyle: useWindowFrame ? 'default' : 'hidden',
    titleBarOverlay: useWindowFrame
      ? false
      : {
          height: 49
        },
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon: icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      spellcheck: false,
      sandbox: false
    }
  })
  mainWindowState.manage(mainWindow)
  mainWindow.on('ready-to-show', async () => {
    const {
      silentStart = false,
      autoQuitWithoutCore = false,
      autoQuitWithoutCoreDelay = 60
    } = await getAppConfig()
    if (autoQuitWithoutCore && !mainWindow?.isVisible()) {
      if (quitTimeout) {
        clearTimeout(quitTimeout)
      }
      quitTimeout = setTimeout(async () => {
        await quitWithoutCore()
      }, autoQuitWithoutCoreDelay * 1000)
    }
    if (!silentStart) {
      if (quitTimeout) {
        clearTimeout(quitTimeout)
      }
      mainWindow?.show()
      mainWindow?.focusOnWebView()
    }
  })
  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow?.webContents.reload()
  })

  mainWindow.on('close', async (event) => {
    event.preventDefault()
    mainWindow?.hide()
    const { autoQuitWithoutCore = false, autoQuitWithoutCoreDelay = 60 } = await getAppConfig()
    if (autoQuitWithoutCore) {
      if (quitTimeout) {
        clearTimeout(quitTimeout)
      }
      quitTimeout = setTimeout(async () => {
        await quitWithoutCore()
      }, autoQuitWithoutCoreDelay * 1000)
    }
  })

  mainWindow.on('resized', () => {
    if (mainWindow) mainWindowState.saveState(mainWindow)
  })

  mainWindow.on('move', () => {
    if (mainWindow) mainWindowState.saveState(mainWindow)
  })

  mainWindow.on('session-end', async () => {
    triggerSysProxy(false, false)
    await stopCore()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

export function triggerMainWindow(): void {
  if (mainWindow?.isVisible()) {
    closeMainWindow()
  } else {
    showMainWindow()
  }
}

export function showMainWindow(): void {
  if (mainWindow) {
    if (quitTimeout) {
      clearTimeout(quitTimeout)
    }
    mainWindow.show()
    mainWindow.focusOnWebView()
  }
}

export function closeMainWindow(): void {
  if (mainWindow) {
    mainWindow.close()
  }
}
