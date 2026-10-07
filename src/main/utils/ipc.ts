import { app, ipcMain } from 'electron'
import {
  mihomoChangeProxy,
  mihomoCloseConnections,
  mihomoCloseConnection,
  mihomoGroupDelay,
  mihomoGroups,
  mihomoProxies,
  mihomoProxyDelay,
  mihomoProxyProviders,
  mihomoRuleProviders,
  mihomoRules,
  mihomoUnfixedProxy,
  mihomoUpdateProxyProviders,
  mihomoUpdateRuleProviders,
  mihomoUpgrade,
  mihomoUpgradeUI,
  mihomoUpgradeGeo,
  mihomoVersion,
  mihomoConfig,
  patchMihomoConfig,
  restartMihomoLogs,
  restartMihomoConnections,
  mihomoRulesDisable
} from '../core/mihomoApi'
import { checkAutoRun, disableAutoRun, enableAutoRun } from '../sys/autoRun'
import {
  getAppConfig,
  patchAppConfig,
  getControledMihomoConfig,
  patchControledMihomoConfig,
  getProfileConfig,
  getCurrentProfileItem,
  getProfileItem,
  addProfileItem,
  removeProfileItem,
  changeCurrentProfile,
  getProfileStr,
  getFileStr,
  getFilePreviewStr,
  setFileStr,
  saveFileStrWithElevation,
  setProfileStr,
  updateProfileItem,
  setProfileConfig,
  getOverrideConfig,
  setOverrideConfig,
  getOverrideItem,
  addOverrideItem,
  removeOverrideItem,
  getOverride,
  setOverride,
  updateOverrideItem
} from '../config'
import {
  startSubStoreFrontendServer,
  startSubStoreBackendServer,
  stopSubStoreFrontendServer,
  stopSubStoreBackendServer,
  downloadSubStore,
  subStoreFrontendPort,
  subStorePort
} from '../resolve/server'
import { quitWithoutCore, restartCore, startNetworkDetection, stopCore } from '../core/manager'
import { stopNetworkDetection } from '../core/network'
import {
  checkCorePermission,
  manualGrantCorePermition,
  revokeCorePermission
} from '../core/permission'
import { triggerSysProxy } from '../sys/sysproxy'
import { checkUpdate, downloadAndInstallUpdate, cancelUpdate } from '../resolve/autoUpdater'
import {
  checkElevateTask,
  deleteElevateTask,
  getFilePath,
  openFile,
  openUWPTool,
  readImageFileDataURL,
  readTextFile,
  resetAppConfig,
  setNativeTheme,
  setupFirewall
} from '../sys/misc'
import {
  serviceStatus,
  installService,
  uninstallService,
  startService,
  stopService,
  initService,
  testServiceConnection,
  restartService
} from '../service/manager'
import { patchCoreProfile } from '../service/api'
import { coreLogPath, findSystemMihomo, logDir } from './dirs'
import { systemCoreOnlyBuild } from '../../shared/build-flags'
import {
  getRuntimeConfig,
  getRuntimeConfigStr,
  getRawProfileStr,
  getCurrentProfileStr,
  getOverrideProfileStr
} from '../core/factory'
import { listWebdavBackups, webdavBackup, webdavDelete, webdavRestore } from '../resolve/backup'
import { getInterfaces } from '../sys/interface'
import {
  closeTrayIcon,
  copyEnv,
  setDockVisible,
  showTrayIcon,
  updateTrayIcon
} from '../resolve/tray'
import { registerShortcut } from '../resolve/shortcut'
import {
  closeMainWindow,
  mainWindow,
  setNotQuitDialog,
  showMainWindow,
  triggerMainWindow
} from '..'
import {
  applyTheme,
  fetchThemes,
  importThemes,
  readTheme,
  resolveThemes,
  writeTheme
} from '../resolve/theme'
import { subStoreCollections, subStoreSubs } from '../core/subStoreApi'
import path from 'path'
import v8 from 'v8'
import { getGistUrl } from '../resolve/gistApi'
import { getIconDataURL, getImageDataURL } from './icon'
import { startMonitor } from '../resolve/trafficMonitor'
import { closeFloatingWindow, showContextMenu, showFloatingWindow } from '../resolve/floatingWindow'
import { getAppName } from '@uruhalushia/sparkle-native'
import { showNotification } from './notification'
import { getUserAgent } from './userAgent'
import { appendAppLog, clearCachedMihomoLogs, getCachedMihomoLogs } from './log'
import { ageIdentityToRecipient, generateAgeKeyPair } from './age'
import {
  operationData,
  runWebhookOperation,
  testWebhook,
  validateWebhookConfig,
  webhookOperationCategories
} from '../resolve/webhook'

function ipcErrorWrapper<T>( // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (...args: any[]) => T | Promise<T> // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (...args: any[]) => Promise<T | { invokeError: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (e) {
      if (e && typeof e === 'object') {
        if ('message' in e) {
          return { invokeError: e.message }
        } else {
          return { invokeError: JSON.stringify(e) }
        }
      }
      if (e instanceof Error || typeof e === 'string') {
        return { invokeError: e }
      }
      return { invokeError: 'Unknown Error' }
    }
  }
}

async function patchAppConfigWithServiceSync(patch: Partial<AppConfig>): Promise<AppConfig> {
  if (patch.webhook) {
    const { webhook } = await getAppConfig()
    validateWebhookConfig({ ...webhook, ...patch.webhook })
  }
  const nextConfig = await patchAppConfig(await normalizeServiceModePatch(patch))

  if (!('saveLogs' in patch || 'maxLogFileSizeMB' in patch || 'serviceCpuAffinity' in patch)) {
    return nextConfig
  }

  const {
    corePermissionMode = 'elevated',
    saveLogs = true,
    maxLogFileSizeMB = 20,
    serviceCpuAffinity = []
  } = await getAppConfig()
  if (corePermissionMode !== 'service') {
    return nextConfig
  }

  const syncCoreProfile = patchCoreProfile({
    log_path: coreLogPath(),
    save_logs: saveLogs,
    max_log_file_size_mb: maxLogFileSizeMB,
    cpu_affinity: serviceCpuAffinity
  })

  if ('serviceCpuAffinity' in patch) {
    try {
      await syncCoreProfile
    } catch (error) {
      await appendAppLog(`[Service]: sync core profile failed, ${error}\n`).catch(() => {})
      throw error
    }
  } else {
    void syncCoreProfile.catch((error) => {
      appendAppLog(`[Service]: sync core log config failed, ${error}\n`).catch(() => {})
    })
  }

  return nextConfig
}

async function normalizeServiceModePatch(patch: Partial<AppConfig>): Promise<Partial<AppConfig>> {
  if (patch.sysProxy?.settingMode !== 'service') {
    return patch
  }

  const status = await serviceStatus().catch(() => 'unknown' as const)
  if (status === 'running') {
    return patch
  }

  void showNotification({ title: '服务不可用，已切换到执行命令模式' })
  return {
    ...patch,
    sysProxy: {
      ...patch.sysProxy,
      settingMode: 'exec',
      guard: false,
      guardNotify: false
    }
  }
}

export function registerIpcMainHandlers(): void {
  const handle = (channel: string, listener: Parameters<typeof ipcMain.handle>[1]): void => {
    const category = webhookOperationCategories.get(channel)
    ipcMain.handle(
      channel,
      category
        ? (event, ...args) =>
            runWebhookOperation(
              category,
              channel,
              () => listener(event, ...args),
              operationData(channel, args)
            )
        : listener
    )
  }
  handle('testWebhook', (_event, config) => ipcErrorWrapper(testWebhook)(config))
  handle('mihomoVersion', ipcErrorWrapper(mihomoVersion))
  handle('mihomoConfig', ipcErrorWrapper(mihomoConfig))
  handle('mihomoCloseConnection', (_e, id) => ipcErrorWrapper(mihomoCloseConnection)(id))
  handle('mihomoCloseConnections', (_e, name) => ipcErrorWrapper(mihomoCloseConnections)(name))
  handle('mihomoRules', ipcErrorWrapper(mihomoRules))
  handle('mihomoProxies', ipcErrorWrapper(mihomoProxies))
  handle('mihomoGroups', ipcErrorWrapper(mihomoGroups))
  handle('mihomoProxyProviders', ipcErrorWrapper(mihomoProxyProviders))
  handle('mihomoUpdateProxyProviders', (_e, name) =>
    ipcErrorWrapper(mihomoUpdateProxyProviders)(name)
  )
  handle('mihomoRuleProviders', ipcErrorWrapper(mihomoRuleProviders))
  handle('mihomoUpdateRuleProviders', (_e, name) =>
    ipcErrorWrapper(mihomoUpdateRuleProviders)(name)
  )
  handle('mihomoChangeProxy', (_e, group, proxy) =>
    ipcErrorWrapper(mihomoChangeProxy)(group, proxy)
  )
  handle('mihomoUnfixedProxy', (_e, group) => ipcErrorWrapper(mihomoUnfixedProxy)(group))
  handle('mihomoUpgradeGeo', ipcErrorWrapper(mihomoUpgradeGeo))
  handle('mihomoUpgradeUI', ipcErrorWrapper(mihomoUpgradeUI))
  if (!systemCoreOnlyBuild) {
    handle('mihomoUpgrade', (_e, channel) => ipcErrorWrapper(mihomoUpgrade)(channel))
  }
  handle('mihomoProxyDelay', (_e, proxy, url, provider) =>
    ipcErrorWrapper(mihomoProxyDelay)(proxy, url, provider)
  )
  handle('mihomoGroupDelay', (_e, group, url) => ipcErrorWrapper(mihomoGroupDelay)(group, url))
  handle('mihomoRulesDisable', (_e, rules) => ipcErrorWrapper(mihomoRulesDisable)(rules))
  handle('patchMihomoConfig', (_e, patch) => ipcErrorWrapper(patchMihomoConfig)(patch))
  handle('restartMihomoLogs', ipcErrorWrapper(restartMihomoLogs))
  handle('checkAutoRun', ipcErrorWrapper(checkAutoRun))
  handle('enableAutoRun', ipcErrorWrapper(enableAutoRun))
  handle('disableAutoRun', ipcErrorWrapper(disableAutoRun))
  handle('getAppConfig', (_e, force) => ipcErrorWrapper(getAppConfig)(force))
  handle('getCachedMihomoLogs', () => getCachedMihomoLogs())
  handle('clearCachedMihomoLogs', () => clearCachedMihomoLogs())
  handle('patchAppConfig', (_e, config) => ipcErrorWrapper(patchAppConfigWithServiceSync)(config))
  handle('getControledMihomoConfig', (_e, force) =>
    ipcErrorWrapper(getControledMihomoConfig)(force)
  )
  handle('patchControledMihomoConfig', (_e, config) =>
    ipcErrorWrapper(patchControledMihomoConfig)(config)
  )
  handle('getProfileConfig', (_e, force) => ipcErrorWrapper(getProfileConfig)(force))
  handle('setProfileConfig', (_e, config) => ipcErrorWrapper(setProfileConfig)(config))
  handle('getCurrentProfileItem', ipcErrorWrapper(getCurrentProfileItem))
  handle('getProfileItem', (_e, id) => ipcErrorWrapper(getProfileItem)(id))
  handle('getProfileStr', (_e, id) => ipcErrorWrapper(getProfileStr)(id))
  handle('getFileStr', (_e, path, ageSecretKey) => ipcErrorWrapper(getFileStr)(path, ageSecretKey))
  handle('getFilePreviewStr', (_e, path, format) =>
    ipcErrorWrapper(getFilePreviewStr)(path, format)
  )
  handle('setFileStr', (_e, path, str) => ipcErrorWrapper(setFileStr)(path, str))
  if (!systemCoreOnlyBuild) {
    handle('saveFileStrWithElevation', (_e, path, str) =>
      ipcErrorWrapper(saveFileStrWithElevation)(path, str)
    )
  }
  handle('setProfileStr', (_e, id, str) => ipcErrorWrapper(setProfileStr)(id, str))
  handle('updateProfileItem', (_e, item) => ipcErrorWrapper(updateProfileItem)(item))
  handle('changeCurrentProfile', (_e, id) => ipcErrorWrapper(changeCurrentProfile)(id))
  handle('addProfileItem', (_e, item) => ipcErrorWrapper(addProfileItem)(item))
  handle('removeProfileItem', (_e, id) => ipcErrorWrapper(removeProfileItem)(id))
  handle('getOverrideConfig', (_e, force) => ipcErrorWrapper(getOverrideConfig)(force))
  handle('setOverrideConfig', (_e, config) => ipcErrorWrapper(setOverrideConfig)(config))
  handle('getOverrideItem', (_e, id) => ipcErrorWrapper(getOverrideItem)(id))
  handle('addOverrideItem', (_e, item) => ipcErrorWrapper(addOverrideItem)(item))
  handle('removeOverrideItem', (_e, id) => ipcErrorWrapper(removeOverrideItem)(id))
  handle('updateOverrideItem', (_e, item) => ipcErrorWrapper(updateOverrideItem)(item))
  handle('getOverride', (_e, id, ext) => ipcErrorWrapper(getOverride)(id, ext))
  handle('setOverride', (_e, id, ext, str) => ipcErrorWrapper(setOverride)(id, ext, str))
  handle('restartCore', ipcErrorWrapper(restartCore))
  handle('stopCore', ipcErrorWrapper(stopCore))
  handle('restartMihomoConnections', ipcErrorWrapper(restartMihomoConnections))
  handle('startMonitor', (_e, detached) => ipcErrorWrapper(startMonitor)(detached))
  handle('triggerSysProxy', (_e, enable, onlyActiveDevice, useRegistry) =>
    ipcErrorWrapper(triggerSysProxy)(enable, onlyActiveDevice, useRegistry)
  )
  if (!systemCoreOnlyBuild) {
    handle('manualGrantCorePermition', (_e, cores?: ('mihomo' | 'mihomo-alpha')[]) =>
      ipcErrorWrapper(manualGrantCorePermition)(cores)
    )
    handle('checkCorePermission', () => ipcErrorWrapper(checkCorePermission)())
    handle('revokeCorePermission', (_e, cores?: ('mihomo' | 'mihomo-alpha')[]) =>
      ipcErrorWrapper(revokeCorePermission)(cores)
    )
    handle('checkElevateTask', () => ipcErrorWrapper(checkElevateTask)())
    handle('deleteElevateTask', () => ipcErrorWrapper(deleteElevateTask)())
  }
  handle('serviceStatus', () => ipcErrorWrapper(serviceStatus)())
  handle('testServiceConnection', () => ipcErrorWrapper(testServiceConnection)())
  handle('initService', () => ipcErrorWrapper(initService)())
  handle('installService', () => ipcErrorWrapper(installService)())
  handle('uninstallService', () => ipcErrorWrapper(uninstallService)())
  handle('startService', () => ipcErrorWrapper(startService)())
  handle('restartService', () => ipcErrorWrapper(restartService)())
  handle('stopService', () => ipcErrorWrapper(stopService)())
  handle('findSystemMihomo', () => findSystemMihomo())
  handle('getFilePath', (_e, ext, title, filterName) => getFilePath(ext, title, filterName))
  handle('readTextFile', (_e, filePath) => ipcErrorWrapper(readTextFile)(filePath))
  handle('readImageFileDataURL', (_e, filePath) => ipcErrorWrapper(readImageFileDataURL)(filePath))
  handle('getRuntimeConfigStr', ipcErrorWrapper(getRuntimeConfigStr))
  handle('getRawProfileStr', ipcErrorWrapper(getRawProfileStr))
  handle('getCurrentProfileStr', ipcErrorWrapper(getCurrentProfileStr))
  handle('getOverrideProfileStr', ipcErrorWrapper(getOverrideProfileStr))
  handle('getRuntimeConfig', ipcErrorWrapper(getRuntimeConfig))
  handle('downloadAndInstallUpdate', (_e, version, tag) =>
    ipcErrorWrapper(downloadAndInstallUpdate)(version, tag)
  )
  handle('checkUpdate', ipcErrorWrapper(checkUpdate))
  handle('cancelUpdate', ipcErrorWrapper(cancelUpdate))
  handle('getVersion', () => app.getVersion())
  handle('platform', () => process.platform)
  handle('openUWPTool', ipcErrorWrapper(openUWPTool))
  handle('setupFirewall', ipcErrorWrapper(setupFirewall))
  handle('getInterfaces', getInterfaces)
  handle('webdavBackup', ipcErrorWrapper(webdavBackup))
  handle('webdavRestore', (_e, filename) => ipcErrorWrapper(webdavRestore)(filename))
  handle('listWebdavBackups', ipcErrorWrapper(listWebdavBackups))
  handle('webdavDelete', (_e, filename) => ipcErrorWrapper(webdavDelete)(filename))
  handle('registerShortcut', (_e, oldShortcut, newShortcut, action) =>
    ipcErrorWrapper(registerShortcut)(oldShortcut, newShortcut, action)
  )
  handle('startSubStoreFrontendServer', () => ipcErrorWrapper(startSubStoreFrontendServer)())
  handle('stopSubStoreFrontendServer', () => ipcErrorWrapper(stopSubStoreFrontendServer)())
  handle('startSubStoreBackendServer', () => ipcErrorWrapper(startSubStoreBackendServer)())
  handle('stopSubStoreBackendServer', () => ipcErrorWrapper(stopSubStoreBackendServer)())
  handle('downloadSubStore', () => ipcErrorWrapper(downloadSubStore)())

  handle('subStorePort', () => subStorePort)
  handle('subStoreFrontendPort', () => subStoreFrontendPort)
  handle('subStoreSubs', () => ipcErrorWrapper(subStoreSubs)())
  handle('subStoreCollections', () => ipcErrorWrapper(subStoreCollections)())
  handle('getGistUrl', ipcErrorWrapper(getGistUrl))
  handle('setNativeTheme', (_e, theme) => {
    setNativeTheme(theme)
  })
  handle('setTitleBarOverlay', (_e, overlay) =>
    ipcErrorWrapper(async (overlay): Promise<void> => {
      if (typeof mainWindow?.setTitleBarOverlay === 'function') {
        mainWindow.setTitleBarOverlay(overlay)
      }
    })(overlay)
  )
  handle('setAlwaysOnTop', (_e, alwaysOnTop) => {
    mainWindow?.setAlwaysOnTop(alwaysOnTop)
  })
  handle('isAlwaysOnTop', () => {
    return mainWindow?.isAlwaysOnTop()
  })
  handle('showTrayIcon', () => ipcErrorWrapper(showTrayIcon)())
  handle('closeTrayIcon', () => ipcErrorWrapper(closeTrayIcon)())
  handle('updateTrayIcon', () => ipcErrorWrapper(updateTrayIcon)())
  handle('setDockVisible', (_e, visible: boolean) => setDockVisible(visible))
  handle('showMainWindow', showMainWindow)
  handle('closeMainWindow', closeMainWindow)
  handle('triggerMainWindow', triggerMainWindow)
  handle('showFloatingWindow', () => ipcErrorWrapper(showFloatingWindow)())
  handle('closeFloatingWindow', () => ipcErrorWrapper(closeFloatingWindow)())
  handle('showContextMenu', () => ipcErrorWrapper(showContextMenu)())
  handle('openFile', (_e, type, id, ext) => openFile(type, id, ext))
  handle('openDevTools', () => {
    mainWindow?.webContents.openDevTools()
  })
  handle('createHeapSnapshot', () => {
    return v8.writeHeapSnapshot(path.join(logDir(), `${Date.now()}.heapsnapshot`))
  })
  handle('getUserAgent', () => ipcErrorWrapper(getUserAgent)())
  handle('generateAgeKeyPair', () => ipcErrorWrapper(generateAgeKeyPair)())
  handle('ageIdentityToRecipient', (_e, identity) =>
    ipcErrorWrapper(ageIdentityToRecipient)(identity)
  )
  handle('getAppName', (_e, appPath) => ipcErrorWrapper(getAppName)(appPath))
  handle('getImageDataURL', (_e, url) => ipcErrorWrapper(getImageDataURL)(url))
  handle('getIconDataURL', (_e, appPath) => ipcErrorWrapper(getIconDataURL)(appPath))
  handle('resolveThemes', () => ipcErrorWrapper(resolveThemes)())
  handle('fetchThemes', () => ipcErrorWrapper(fetchThemes)())
  handle('importThemes', (_e, file) => ipcErrorWrapper(importThemes)(file))
  handle('readTheme', (_e, theme) => ipcErrorWrapper(readTheme)(theme))
  handle('writeTheme', (_e, theme, css) => ipcErrorWrapper(writeTheme)(theme, css))
  handle('applyTheme', (_e, theme) => ipcErrorWrapper(applyTheme)(theme))
  handle('copyEnv', (_e, type) => ipcErrorWrapper(copyEnv)(type))
  handle('alert', (_e, msg) => {
    void showNotification({ title: 'Sparkle', body: msg, variant: 'danger' })
  })
  handle('resetAppConfig', resetAppConfig)
  handle('relaunchApp', () => {
    setNotQuitDialog()
    app.relaunch()
    app.quit()
  })
  handle('quitWithoutCore', ipcErrorWrapper(quitWithoutCore))
  handle('startNetworkDetection', ipcErrorWrapper(startNetworkDetection))
  handle('stopNetworkDetection', ipcErrorWrapper(stopNetworkDetection))
  handle('quitApp', () => app.quit())
  handle('notDialogQuit', () => {
    setNotQuitDialog()
    app.quit()
  })
}
