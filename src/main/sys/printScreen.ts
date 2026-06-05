import type { BrowserWindow } from 'electron'
import { createRequire } from 'module'
import path from 'path'
import { getAppConfig } from '../config'
import { appendAppLog } from '../utils/log'
import { resourcesFilesDir } from '../utils/dirs'
import { isRunningAsAdmin } from '../utils/elevation'

const nativeRequire = createRequire(__filename)
const prtScnHookName = 'prtscnhook.node'
const forwardSent = 3

let printScreenForwarding = false
let printScreenHookInstalled = false
let printScreenHookWindowHandle: bigint | null = null
let prtScnHookAddon: PrtScnHookAddon | null | undefined
let printScreenStatsTimer: ReturnType<typeof setInterval> | null = null
let nativeForwardCount = 0
let printScreenHookInstallFailureLogged = false
let printScreenForwardFailureStatus: number | null = null

type PrtScnHookAddon = {
  installHook(windowHandle: bigint): boolean
  uninstallHook(windowHandle: bigint): boolean
  forwardPrtScn(windowHandle: bigint): number
  canForwardPrtScn(windowHandle: bigint): boolean
  getForwardCount(): number
  getLastStatus(): number
}

function prtScnHookPath(): string {
  return path.join(resourcesFilesDir(), prtScnHookName)
}

function getNativeWindowHandle(window: BrowserWindow): bigint | undefined {
  const handle = window.getNativeWindowHandle()
  if (handle.length < 4) return undefined

  // Electron 在 64 位 Windows 下返回 8 字节 HWND, 保留 32 位分支以兼容 ia32 构建
  const value = handle.length >= 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0))

  return value === 0n ? undefined : value
}

function isPlainPrintScreen(input: Electron.Input): boolean {
  // 只处理裸 PrtScn; 带 Ctrl/Alt/Shift/Win 的组合键保持系统或其他软件原行为
  return (
    (input.type === 'keyDown' || input.type === 'keyUp') &&
    (input.code === 'PrintScreen' || input.key === 'PrintScreen' || input.key === 'Printscreen') &&
    !input.isAutoRepeat &&
    !input.isComposing &&
    !input.control &&
    !input.alt &&
    !input.shift &&
    !input.meta
  )
}

function loadPrtScnHookAddon(): PrtScnHookAddon | null {
  if (prtScnHookAddon !== undefined) {
    return prtScnHookAddon
  }

  try {
    const addon = nativeRequire(prtScnHookPath()) as Partial<PrtScnHookAddon>
    // addon 和 helper 都来自 resources/files
    // 导出不完整时直接禁用
    if (
      typeof addon.installHook !== 'function' ||
      typeof addon.uninstallHook !== 'function' ||
      typeof addon.forwardPrtScn !== 'function' ||
      typeof addon.canForwardPrtScn !== 'function' ||
      typeof addon.getForwardCount !== 'function' ||
      typeof addon.getLastStatus !== 'function'
    ) {
      void appendAppLog('[PrintScreen]: native hook addon exports are invalid\n')
      prtScnHookAddon = null
      return null
    }

    prtScnHookAddon = addon as PrtScnHookAddon
    return prtScnHookAddon
  } catch (error) {
    void appendAppLog(`[PrintScreen]: native hook addon load failed, ${error}\n`)
    prtScnHookAddon = null
    return null
  }
}

function forwardStatusText(status: number): string {
  switch (status) {
    case 0:
      return 'helper=0'
    case 1:
      return 'launch=false'
    case 2:
      return 'helper=failed'
    case forwardSent:
      return 'sent=2'
    case 4:
      return 'post=false'
    default:
      return `status=${status}`
  }
}

function logForwardFailure(status: number): void {
  if (printScreenForwardFailureStatus === status) return

  printScreenForwardFailureStatus = status
  void appendAppLog(`[PrintScreen]: native forward skipped, ${forwardStatusText(status)}\n`)
}

function canForwardPrintScreen(window: BrowserWindow): boolean {
  const addon = loadPrtScnHookAddon()
  const windowHandle = getNativeWindowHandle(window)
  if (!addon || !windowHandle) return false

  try {
    return addon.canForwardPrtScn(windowHandle)
  } catch (error) {
    void appendAppLog(`[PrintScreen]: native capability check failed, ${error}\n`)
    return false
  }
}

function installPrintScreenHook(window: BrowserWindow): void {
  if (printScreenHookInstalled || window.isDestroyed()) return

  const addon = loadPrtScnHookAddon()
  const windowHandle = getNativeWindowHandle(window)
  if (!addon || !windowHandle) return

  try {
    printScreenHookInstalled = addon.installHook(windowHandle)
    printScreenHookWindowHandle = printScreenHookInstalled ? windowHandle : null
    if (printScreenHookInstalled) {
      printScreenHookInstallFailureLogged = false
    }
    if (!printScreenHookInstalled && !printScreenHookInstallFailureLogged) {
      printScreenHookInstallFailureLogged = true
      void appendAppLog('[PrintScreen]: native hook install failed\n')
    }
  } catch (error) {
    printScreenHookInstalled = false
    printScreenHookWindowHandle = null
    if (!printScreenHookInstallFailureLogged) {
      printScreenHookInstallFailureLogged = true
      void appendAppLog(`[PrintScreen]: native hook install failed, ${error}\n`)
    }
  }
}

function uninstallPrintScreenHook(): void {
  if (!printScreenHookInstalled) return

  const addon = loadPrtScnHookAddon()
  const windowHandle = printScreenHookWindowHandle
  printScreenHookInstalled = false
  printScreenHookWindowHandle = null
  if (!addon || !windowHandle) return

  try {
    addon.uninstallHook(windowHandle)
  } catch (error) {
    void appendAppLog(`[PrintScreen]: native hook uninstall failed, ${error}\n`)
  }
}

function stopPrintScreenStats(): void {
  if (!printScreenStatsTimer) return

  clearInterval(printScreenStatsTimer)
  printScreenStatsTimer = null
}

function startPrintScreenStats(window: BrowserWindow): void {
  if (printScreenStatsTimer) return

  const addon = loadPrtScnHookAddon()
  if (!addon) return

  nativeForwardCount = addon.getForwardCount()
  printScreenStatsTimer = setInterval(() => {
    if (window.isDestroyed()) {
      stopPrintScreenStats()
      return
    }

    const currentCount = addon.getForwardCount()
    if (currentCount === nativeForwardCount) return

    nativeForwardCount = currentCount
    const status = addon.getLastStatus()
    if (status === forwardSent) {
      printScreenForwardFailureStatus = null
    } else {
      logForwardFailure(status)
    }
  }, 1000)
}

function restoreForwardingState(window: BrowserWindow): void {
  setTimeout(() => {
    printScreenForwarding = false
    if (window.isDestroyed()) return

    // 转发会让 Sparkle 短暂失焦, 延迟后按当前焦点状态恢复 hook 生命周期
    if (window.isFocused()) {
      installPrintScreenHook(window)
    } else {
      uninstallPrintScreenHook()
    }
  }, 600)
}

function forwardPrintScreen(window: BrowserWindow): void {
  if (printScreenForwarding || window.isDestroyed()) return

  const addon = loadPrtScnHookAddon()
  const windowHandle = getNativeWindowHandle(window)
  if (!addon || !windowHandle) return

  printScreenForwarding = true
  try {
    // Electron before-input-event 测试收不到到 PrtScn
    // 但假设能收到时仍由 native helper 完成
    const status = addon.forwardPrtScn(windowHandle)
    if (status === forwardSent) {
      printScreenForwardFailureStatus = null
    } else {
      logForwardFailure(status)
    }
  } catch (error) {
    void appendAppLog(`[PrintScreen]: native forward failed, ${error}\n`)
  } finally {
    restoreForwardingState(window)
  }
}

function installPrintScreenHookLifecycle(window: BrowserWindow): void {
  // hook 只在 Sparkle 窗口前台时安装, 避免用户切到其他应用后仍拦截全局 PrtScn
  window.on('focus', () => {
    if (!printScreenForwarding) installPrintScreenHook(window)
  })

  window.on('blur', () => {
    if (!printScreenForwarding) uninstallPrintScreenHook()
  })

  window.on('close', () => {
    stopPrintScreenStats()
    uninstallPrintScreenHook()
  })
}

export function installPrintScreenCompatibility(window: BrowserWindow): void {
  if (process.platform !== 'win32') return

  void getAppConfig()
    .then(async ({ disablePrintScreenCompatibility = false }) => {
      if (disablePrintScreenCompatibility || window.isDestroyed()) return

      // 普通权限窗口不会触发该兼容问题; 只在管理员运行时启用 native hook
      const isAdmin = await isRunningAsAdmin()
      if (!isAdmin || window.isDestroyed()) return

      if (!canForwardPrintScreen(window)) return

      installPrintScreenHookLifecycle(window)
      if (window.isFocused()) installPrintScreenHook(window)
      startPrintScreenStats(window)

      window.webContents.on('before-input-event', (event, input) => {
        if (!isPlainPrintScreen(input)) return

        event.preventDefault()
        if (input.type === 'keyDown') {
          forwardPrintScreen(window)
        }
      })
    })
    .catch((error) => {
      void appendAppLog(`[PrintScreen]: compatibility init failed, ${error}\n`)
    })
}
