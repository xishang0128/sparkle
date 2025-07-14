import { app, Menu, shell, dialog } from 'electron'
import { mainWindow } from '..'
import { getAppConfig } from '../config'
import { quitWithoutCore } from '../core/manager'
import { dataDir, logDir, mihomoCoreDir, mihomoWorkDir } from '../utils/dirs'

export async function createApplicationMenu(): Promise<void> {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }

  const { quitWithoutCoreShortcut = '', restartAppShortcut = '' } = await getAppConfig()

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.getName(),
      submenu: [
        {
          label: '关于 ' + app.getName(),
          role: 'about'
        },
        { type: 'separator' },
        {
          label: '隐藏' + app.getName(),
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: '隐藏其他',
          accelerator: 'Command+Alt+H',
          role: 'hideOthers'
        },
        {
          label: '显示全部',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: '轻量模式',
          accelerator: quitWithoutCoreShortcut,
          click: () => {
            quitWithoutCore()
          }
        },
        {
          label: '重启应用',
          accelerator: restartAppShortcut,
          click: () => {
            app.relaunch()
            app.quit()
          }
        },
        {
          label: '退出应用',
          accelerator: 'Command+Q',
          click: () => {
            app.quit()
          }
        }
      ]
    },
    {
      label: '工具',
      submenu: [
        {
          label: '打开目录',
          submenu: [
            {
              label: '应用目录',
              click: () => shell.openPath(dataDir())
            },
            {
              label: '工作目录',
              click: () => shell.openPath(mihomoWorkDir())
            },
            {
              label: '内核目录',
              click: () => shell.openPath(mihomoCoreDir())
            },
            {
              label: '日志目录',
              click: () => shell.openPath(logDir())
            }
          ]
        },
        { type: 'separator' },
        {
          label: '重新加载',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.reload()
            }
          }
        },
        {
          label: '开发者工具',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools()
            }
          }
        }
      ]
    },
    {
      label: '窗口',
      submenu: [
        {
          label: '最小化',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        },
        {
          label: '关闭',
          accelerator: 'CmdOrCtrl+W',
          role: 'close'
        },
        { type: 'separator' },
        {
          label: '前置所有窗口',
          role: 'front'
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '了解更多',
          click: () => {
            shell.openExternal('https://github.com/xishang0128/sparkle')
          }
        },
        {
          label: '报告问题',
          click: () => {
            shell.openExternal('https://github.com/xishang0128/sparkle/issues')
          }
        },
        { type: 'separator' },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于 Sparkle',
              message: 'Sparkle',
              detail: `版本：${app.getVersion()}\n一个基于 Electron 的代理工具`,
              buttons: ['确定']
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

export async function updateApplicationMenu(): Promise<void> {
  if (process.platform === 'darwin') {
    await createApplicationMenu()
  }
}
