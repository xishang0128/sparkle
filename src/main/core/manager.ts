import { ChildProcess, spawn } from 'child_process'
import { dataDir, coreLogPath, mihomoCorePath } from '../utils/dirs'
import { generateProfile, getRuntimeConfig } from './factory'
import {
  getAppConfig,
  getControledMihomoConfig,
  getProfileConfig,
  patchAppConfig,
  patchControledMihomoConfig
} from '../config'
import { app, ipcMain } from 'electron'
import {
  startMihomoTraffic,
  startMihomoConnections,
  startMihomoLogs,
  startMihomoMemory,
  stopMihomoConnections,
  stopMihomoTraffic,
  stopMihomoLogs,
  stopMihomoMemory,
  patchMihomoConfig,
  mihomoGroups
} from './mihomoApi'
import { readFile, rm, writeFile } from 'fs/promises'
import { mainWindow } from '..'
import path from 'path'
import os from 'os'
import { existsSync } from 'fs'
import { uploadRuntimeConfig } from '../resolve/gistApi'
import { startMonitor } from '../resolve/trafficMonitor'
import { floatingWindow } from '../resolve/floatingWindow'
import { getAxios } from './mihomoApi'
import {
  getCoreStatus,
  startCore as startServiceCore,
  stopCore as stopServiceCore,
  startServiceCoreEventStream,
  stopServiceCoreEventStream,
  stopServiceSysproxyEventStream,
  subscribeServiceCoreEvents,
  subscribeServiceCoreEventStream,
  setServiceUnavailableFallbackHandler,
  isServiceConnectionError,
  isServiceUnavailableError,
  type ServiceCoreEvent,
  type ServiceCoreLaunchProfile
} from '../service/api'
import { serviceStatus } from '../service/manager'
import {
  clearAppUpdateServiceFallbackPause,
  getServiceFallbackPolicy,
  shouldSkipServiceUnavailableFallback
} from '../service/fallback'
import { appendAppLog, createLogWritable, setMihomoLogSource } from '../utils/log'
import {
  dismissNotification,
  showNotification,
  type AppNotificationPayload,
  type AppNotificationVariant
} from '../utils/notification'
import { createCoreHookWaiter, createCoreStartupHook } from './startupHook'
import { stopChildProcess } from './process-control'
import {
  recoverDNS,
  setPublicDNS,
  startNetworkDetection as startNetworkDetectionWithCore,
  stopNetworkDetection as stopNetworkDetectionController
} from './network'
import { checkProfile } from './profile-check'
import { resetForwardingForTun, recoverForwardingForTun } from '../sys/misc'
import {
  createCoreEnvironment,
  createCoreSpawnArgs,
  createProviderInitializationTracker,
  isControllerListenError,
  isControllerReadyLog,
  isTunPermissionError,
  isUpdaterFinishedLog
} from './startup-chain'
export {
  checkCorePermission,
  checkCorePermissionSync,
  manualGrantCorePermition,
  revokeCorePermission
} from './permission'
export { getDefaultDevice } from './network'

const ctlParam = process.platform === 'win32' ? '-ext-ctl-pipe' : '-ext-ctl-unix'

let child: ChildProcess
let retry = 10
let serviceCoreStreamsRestartTimer: NodeJS.Timeout | null = null
let unsubscribeServiceCoreEvents: (() => void) | null = null
let unsubscribeServiceCoreEventStream: (() => void) | null = null
let serviceCoreStreamsActive = false
let serviceCoreStreamsStarting: Promise<void> | null = null
let lastServiceCoreEventKey = ''
let serviceCoreStartupActive = false
let serviceCoreManaged = false
let serviceCoreReconnectResumePromise: Promise<void> | null = null
let serviceUnavailableModeFallbackPromise: Promise<void> | null = null
const serviceConnectionRetryInterval = 500
const tailscaleAuthNotificationKeyPrefix = 'tailscale-auth:'
const directCoreLogLineLimit = 16 * 1024

type CoreLogNotification = AppNotificationPayload & {
  key: string
  name?: string
  variant?: AppNotificationVariant
}

interface CoreLogAction {
  closeName: string
}

interface CoreLogNotificationSource {
  message?: string
  data?: Record<string, string>
  text?: string
}

interface CoreLogNotificationRule {
  match: (source: CoreLogNotificationSource) => CoreLogNotification | CoreLogAction | undefined
}

const notifiedCoreLogKeys = new Set<string>()
const tailscaleAuthNotificationKeysByName = new Map<string, Set<string>>()
let directCoreLogLineBuffer = ''
const coreLogNotificationRules: CoreLogNotificationRule[] = [
  {
    match: (source) => {
      const doneName =
        source.message === 'tailscale_auth_done'
          ? source.data?.name
          : source.text
            ? parseTailscaleAuthDoneLog(source.text)
            : undefined
      if (doneName) {
        return { closeName: doneName }
      }

      const auth =
        source.message === 'tailscale_auth'
          ? source.data
          : source.text
            ? parseTailscaleAuthLog(source.text)
            : undefined

      const name = auth?.name
      const url = auth?.url
      if (!name || !url) return undefined

      return {
        key: `${tailscaleAuthNotificationKeyPrefix}${url}`,
        name,
        id: `${tailscaleAuthNotificationKeyPrefix}${url}`,
        title: `${name} 需要 Tailscale 认证`,
        body: '点击打开认证链接',
        persistent: true,
        url,
        variant: 'warning'
      }
    }
  }
]

function parseTailscaleAuthLog(line: string): { name: string; url: string } | undefined {
  const prefix = '[Tailscale]('
  const marker = ') To start this tsnet server, restart with TS_AUTHKEY set, or go to: '
  const prefixIndex = line.indexOf(prefix)
  if (prefixIndex < 0) return undefined

  const rest = line.slice(prefixIndex + prefix.length)
  const markerIndex = rest.indexOf(marker)
  if (markerIndex <= 0) return undefined

  const name = rest.slice(0, markerIndex)
  let url = rest.slice(markerIndex + marker.length).trim()
  const urlEnd = findTailscaleAuthUrlEnd(url)
  if (urlEnd >= 0) {
    url = url.slice(0, urlEnd)
  }

  if (!name || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return undefined
  }

  return { name, url }
}

function parseTailscaleAuthDoneLog(line: string): string | undefined {
  const prefix = '[Tailscale]('
  const marker = ') AuthLoop: state is Starting; done'
  const prefixIndex = line.indexOf(prefix)
  if (prefixIndex < 0) return undefined

  const rest = line.slice(prefixIndex + prefix.length)
  const markerIndex = rest.indexOf(marker)
  if (markerIndex <= 0) return undefined

  return rest.slice(0, markerIndex) || undefined
}

function findTailscaleAuthUrlEnd(url: string): number {
  for (let index = 0; index < url.length; index++) {
    const code = url.charCodeAt(index)
    if (
      code <= 32 ||
      url[index] === '"' ||
      url[index] === "'" ||
      url[index] === '<' ||
      url[index] === '>'
    ) {
      return index
    }
  }

  return -1
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

setServiceUnavailableFallbackHandler(async (reason) => {
  if (shouldSkipServiceUnavailableFallback()) {
    await appendAppLog(
      `[Manager]: skip service unavailable fallback during app update, ${reason}\n`
    )
    return
  }

  if (!serviceUnavailableModeFallbackPromise) {
    serviceUnavailableModeFallbackPromise = fallbackUnavailableServiceModes(reason).finally(() => {
      serviceUnavailableModeFallbackPromise = null
    })
  }

  return serviceUnavailableModeFallbackPromise
})

type ServiceCoreConnectionProbe = {
  reachable: boolean
  running: boolean
  error: unknown
}

async function startMihomoApiStreams(): Promise<void> {
  await startMihomoTraffic()
  await startMihomoConnections()
  await startMihomoLogs()
  await startMihomoMemory()
  retry = 10
}

async function completeCoreInitialization(logLevel?: LogLevel): Promise<void> {
  const tasks: Promise<unknown>[] = [
    delay(100).then(() => {
      mainWindow?.webContents.send('groupsUpdated')
      mainWindow?.webContents.send('rulesUpdated')
    }),
    (async () => {
      try {
        await uploadRuntimeConfig()
      } catch (error) {
        await appendAppLog(`[Manager]: upload runtime config failed, ${error}\n`)
        void showNotification({
          title: '同步 Gist 配置失败',
          body: `${error}`,
          variant: 'danger'
        })
      }
    })()
  ]

  if (logLevel) {
    tasks.push(delay(100).then(() => patchMihomoConfig({ 'log-level': logLevel })))
  }

  await Promise.all(tasks)
  setMihomoLogSource('ws')
}

async function waitForMihomoReady(): Promise<void> {
  const maxRetries = 30
  const retryInterval = 100

  for (let i = 0; i < maxRetries; i++) {
    try {
      await mihomoGroups()
      break
    } catch (error) {
      await delay(retryInterval)
    }
  }
}

async function waitForServiceCoreConnection(
  initialError: unknown
): Promise<ServiceCoreConnectionProbe> {
  await appendAppLog(
    `[Manager]: Service connection failed, waiting before fallback, ${initialError}\n`
  )

  const fallbackPolicy = getServiceFallbackPolicy()
  const { pausedForAppUpdate, connectionRetryTimeout } = fallbackPolicy

  if (!isServiceConnectionError(initialError) && !pausedForAppUpdate) {
    return { reachable: false, running: false, error: initialError }
  }

  const status = await getServiceStatusAfterConnectionError()
  if (status && status !== 'running') {
    if (!pausedForAppUpdate) {
      await appendAppLog(`[Manager]: Service status is ${status}, fallback immediately\n`)
      return { reachable: false, running: false, error: initialError }
    }
    await appendAppLog(`[Manager]: Service status is ${status} during app update, keep waiting\n`)
  }

  const startedAt = Date.now()
  let lastError = initialError

  while (Date.now() - startedAt < connectionRetryTimeout) {
    await delay(serviceConnectionRetryInterval)

    try {
      await getCoreStatus()
      if (pausedForAppUpdate) {
        await clearAppUpdateServiceFallbackPause()
      }
      return { reachable: true, running: true, error: lastError }
    } catch (error) {
      lastError = error
      if (isServiceUnavailableError(error) && !isServiceConnectionError(error)) {
        if (!pausedForAppUpdate) {
          return { reachable: false, running: false, error }
        }
        continue
      }
      if (!isServiceConnectionError(error)) {
        return { reachable: true, running: false, error }
      }
    }
  }

  await appendAppLog(
    `[Manager]: Service still unavailable after ${connectionRetryTimeout}ms, ${lastError}\n`
  )
  return { reachable: false, running: false, error: lastError }
}

async function getServiceStatusAfterConnectionError(): Promise<
  Awaited<ReturnType<typeof serviceStatus>> | undefined
> {
  try {
    return await serviceStatus()
  } catch (error) {
    await appendAppLog(`[Manager]: query service status failed before fallback, ${error}\n`)
    return undefined
  }
}

export async function startCore(detached = false): Promise<Promise<void>[]> {
  const {
    core = 'mihomo',
    corePermissionMode = 'elevated',
    coreStartupMode = 'post-up',
    autoSetDNSMode = 'none',
    diffWorkDir = false,
    mihomoCpuPriority = 'PRIORITY_NORMAL',
    saveLogs = true,
    maxLogFileSizeMB = 20,
    disableLoopbackDetector = false,
    disableEmbedCA = false,
    disableSystemCA = false,
    disableNftables = false,
    safePaths = []
  } = await getAppConfig()
  const controlledMihomoConfig = await getControledMihomoConfig()
  const { 'log-level': logLevel, tun } = controlledMihomoConfig
  const { current } = await getProfileConfig()
  const useServiceCore = corePermissionMode === 'service' && !detached

  let corePath: string
  try {
    corePath = mihomoCorePath(core)
  } catch (error) {
    if (core === 'system') {
      await patchAppConfig({ core: 'mihomo' })
      return startCore(detached)
    }
    throw error
  }

  await generateProfile()
  await checkProfile()
  let serviceCoreRunning = false
  if (useServiceCore) {
    try {
      await getCoreStatus()
      serviceCoreRunning = true
    } catch (error) {
      if (isServiceUnavailableError(error)) {
        const probe = await waitForServiceCoreConnection(error)
        if (!probe.reachable) {
          return fallbackToElevatedCore(detached, probe.error)
        }
        serviceCoreRunning = probe.running
      }
    }
  }
  if (!serviceCoreRunning) {
    await stopCore()
  }
  if (process.platform === 'win32' && tun?.enable) {
    try {
      const resetCount = await resetForwardingForTun()
      if (resetCount > 0) {
        await appendAppLog(`[Manager]: reset ipv4 forwarding on ${resetCount} interface(s)\n`)
      }
    } catch (error) {
      await appendAppLog(`[Manager]: reset ipv4 forwarding failed, ${error}\n`)
    }
  }
  setMihomoLogSource('out')
  if (tun?.enable && autoSetDNSMode !== 'none') {
    try {
      await setPublicDNS()
    } catch (error) {
      await appendAppLog(`[Manager]: set dns failed, ${error}\n`)
    }
  }
  const env = createCoreEnvironment({
    disableLoopbackDetector,
    disableEmbedCA,
    disableSystemCA,
    disableNftables,
    safePaths
  })

  let initialized = false
  const coreHook =
    !useServiceCore && !detached && coreStartupMode === 'post-up'
      ? await createCoreStartupHook()
      : undefined
  const hookWaiter = coreHook ? createCoreHookWaiter(coreHook) : undefined
  if (coreHook) {
    await appendAppLog(
      `[Manager]: Core startup mode: post-up, post-up command: ${coreHook.postUpCommand}\n`
    )
  } else if (!detached) {
    await appendAppLog(`[Manager]: Core startup mode: log\n`)
  }

  const spawnArgs = createCoreSpawnArgs({
    current,
    diffWorkDir,
    ctlParam,
    coreHook
  })

  if (useServiceCore) {
    const serviceProfile: ServiceCoreLaunchProfile = {
      core_path: corePath,
      args: spawnArgs,
      safe_paths: safePaths,
      env,
      mihomo_cpu_priority: mihomoCpuPriority,
      log_path: coreLogPath(),
      save_logs: saveLogs,
      max_log_file_size_mb: maxLogFileSizeMB
    }

    await appendAppLog(`[Manager]: Core permission mode: service\n`)
    ensureServiceCoreEventHandler()
    serviceCoreStartupActive = true
    try {
      await startServiceCoreEventStream()
      if (!serviceCoreRunning) {
        await startServiceCore(serviceProfile)
      }
      serviceCoreManaged = true
    } catch (error) {
      if (isServiceUnavailableError(error)) {
        const probe = await waitForServiceCoreConnection(error)
        if (!probe.reachable) {
          return fallbackToElevatedCore(detached, probe.error)
        }
        await startServiceCoreEventStream()
        if (!probe.running) {
          await startServiceCore(serviceProfile)
        }
        serviceCoreManaged = true
      } else {
        throw error
      }
    } finally {
      serviceCoreStartupActive = false
    }
    await ensureServiceCoreStreamsStarted()
    initialized = true
    return [completeCoreInitialization(logLevel)]
  }

  const providerTracker = createProviderInitializationTracker(await getRuntimeConfig())
  const stdout = createLogWritable('core', 'info')
  const stderr = createLogWritable('core', 'error')
  directCoreLogLineBuffer = ''

  child = spawn(corePath, spawnArgs, {
    detached: detached,
    stdio: detached ? 'ignore' : undefined,
    env: env
  })
  hookWaiter?.attachProcess(child)
  if (child.pid) {
    try {
      os.setPriority(child.pid, os.constants.priority[mihomoCpuPriority])
    } catch (error) {
      await appendAppLog(`[Manager]: set core priority failed, ${error}\n`)
    }
  }
  if (detached) {
    child.unref()
    return new Promise((resolve) => {
      resolve([new Promise(() => {})])
    })
  }
  child.on('close', async (code, signal) => {
    flushDirectCoreLogNotifications()
    await appendAppLog(`[Manager]: Core closed, code: ${code}, signal: ${signal}\n`)
    if (retry) {
      await appendAppLog(`[Manager]: Try Restart Core\n`)
      retry--
      await restartCore()
    } else {
      await stopCore()
    }
  })
  child.stdout?.pipe(stdout)
  child.stderr?.pipe(stderr)
  child.stdout?.on('data', handleDirectCoreLogData)
  child.stderr?.on('data', handleDirectCoreLogData)

  const handleCoreOutput = async (
    str: string,
    reject: (reason?: unknown) => void
  ): Promise<void> => {
    if (isControllerListenError(str)) {
      reject(`控制器监听错误:\n${str}`)
    }

    if (isUpdaterFinishedLog(str)) {
      try {
        await stopCore(true)
        const promises = await startCore()
        await Promise.all(promises)
      } catch (e) {
        void showNotification({ title: '内核启动出错', body: `${e}`, variant: 'danger' })
      }
    }
  }

  const waitForCoreReadyByLog = (): Promise<Promise<void>[]> => {
    let controllerReady = false

    return new Promise((resolve, reject) => {
      child.stdout?.on('data', async (data) => {
        const str = data.toString()
        await handleCoreOutput(str, reject)

        if (!controllerReady && isControllerReadyLog(str)) {
          controllerReady = true
          resolve([
            new Promise((resolve, reject) => {
              const handleProviderInitialization = async (logLine: string): Promise<void> => {
                providerTracker.track(logLine)

                if (isTunPermissionError(logLine)) {
                  patchControledMihomoConfig({ tun: { enable: false } })
                  mainWindow?.webContents.send('controledMihomoConfigUpdated')
                  ipcMain.emit('updateTrayMenu')
                  reject('虚拟网卡启动失败，前往内核设置页尝试手动授予内核权限')
                }

                if (providerTracker.isReady(logLine)) {
                  await waitForMihomoReady()
                  initialized = true
                  completeCoreInitialization(logLevel)
                    .then(() => resolve())
                    .catch(reject)
                }
              }

              child.stdout?.on('data', (data) => {
                if (!initialized) {
                  handleProviderInitialization(data.toString()).catch(reject)
                }
              })
            })
          ])
          await startMihomoApiStreams()
        }
      })
    })
  }

  const waitForCoreReadyByHook = (): Promise<Promise<void>[]> => {
    if (!hookWaiter) return waitForCoreReadyByLog()

    return new Promise((resolve, reject) => {
      child.stdout?.on('data', (data) => {
        handleCoreOutput(data.toString(), reject).catch(reject)
      })

      hookWaiter.promise
        .then(async () => {
          initialized = true
          await startMihomoApiStreams()
          resolve([completeCoreInitialization(logLevel)])
        })
        .catch(reject)
    })
  }

  return coreStartupMode === 'post-up' ? waitForCoreReadyByHook() : waitForCoreReadyByLog()
}

export async function stopCore(force = false): Promise<void> {
  try {
    if (!force) {
      await recoverDNS()
    }
  } catch (error) {
    await appendAppLog(`[Manager]: recover dns failed, ${error}\n`)
  }

  try {
    const recoveredCount = await recoverForwardingForTun()
    if (recoveredCount > 0) {
      await appendAppLog(`[Manager]: restored ipv4 forwarding on ${recoveredCount} interface(s)\n`)
    }
  } catch (error) {
    await appendAppLog(`[Manager]: restore ipv4 forwarding failed, ${error}\n`)
  }

  stopMihomoTraffic()
  stopMihomoConnections()
  stopMihomoLogs()
  stopMihomoMemory()
  serviceCoreStreamsActive = false
  if (serviceCoreStreamsRestartTimer) {
    clearTimeout(serviceCoreStreamsRestartTimer)
    serviceCoreStreamsRestartTimer = null
  }

  const { corePermissionMode = 'elevated' } = await getAppConfig()
  const shouldStopServiceCore = serviceCoreManaged || corePermissionMode === 'service'
  if (shouldStopServiceCore) {
    try {
      await stopServiceCore()
    } catch (error) {
      await appendAppLog(`[Manager]: stop service core failed, ${error}\n`)
    } finally {
      serviceCoreManaged = false
      stopServiceCoreEventStream()
      releaseServiceCoreEventHandler()
    }
  }

  if (child && !child.killed) {
    await stopChildProcess(child)
    child = undefined as unknown as ChildProcess
  }

  await getAxios(true).catch(() => {})

  if (existsSync(path.join(dataDir(), 'core.pid'))) {
    const pidString = await readFile(path.join(dataDir(), 'core.pid'), 'utf-8')
    const pid = parseInt(pidString.trim())
    if (!isNaN(pid)) {
      try {
        process.kill(pid, 0)
        process.kill(pid, 'SIGINT')
        await delay(1000)
        try {
          process.kill(pid, 0)
          process.kill(pid, 'SIGKILL')
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    }
    await rm(path.join(dataDir(), 'core.pid')).catch(() => {})
  }
}

function ensureServiceCoreEventHandler(): void {
  if (!unsubscribeServiceCoreEvents) {
    unsubscribeServiceCoreEvents = subscribeServiceCoreEvents((event) =>
      handleServiceCoreEvent(event)
    )
  }
  if (!unsubscribeServiceCoreEventStream) {
    unsubscribeServiceCoreEventStream = subscribeServiceCoreEventStream((state) =>
      handleServiceCoreEventStreamState(state)
    )
  }
}

function releaseServiceCoreEventHandler(): void {
  if (unsubscribeServiceCoreEvents) {
    unsubscribeServiceCoreEvents()
    unsubscribeServiceCoreEvents = null
  }
  if (unsubscribeServiceCoreEventStream) {
    unsubscribeServiceCoreEventStream()
    unsubscribeServiceCoreEventStream = null
  }
}

async function handleServiceCoreEvent(event: ServiceCoreEvent): Promise<void> {
  if (event.type === 'log') {
    notifyCoreLog(event)
    return
  }

  if (isDuplicateServiceCoreEvent(event)) {
    return
  }

  await appendAppLog(
    `[Manager]: Service core event: ${event.type}${event.pid ? `, pid: ${event.pid}` : ''}${event.error ? `, error: ${event.error}` : ''}\n`
  )

  mainWindow?.webContents.send('core-status-changed', event)

  switch (event.type) {
    case 'started':
      serviceCoreManaged = true
      await getAxios(true).catch(() => {})
      mainWindow?.webContents.send('core-started', event)
      mainWindow?.webContents.send('groupsUpdated')
      mainWindow?.webContents.send('rulesUpdated')
      ipcMain.emit('updateTrayMenu')
      void ensureServiceCoreStreamsStarted().catch((error) => {
        appendAppLog(`[Manager]: start service core streams failed, ${error}\n`).catch(() => {})
      })
      break
    case 'takeover':
    case 'ready':
      serviceCoreManaged = true
      await getAxios(true).catch(() => {})
      mainWindow?.webContents.send('core-started', event)
      mainWindow?.webContents.send('groupsUpdated')
      mainWindow?.webContents.send('rulesUpdated')
      ipcMain.emit('updateTrayMenu')
      scheduleServiceCoreStreamsRestart()
      break
    case 'exited':
    case 'failed':
    case 'restart_failed':
      stopMihomoTraffic()
      stopMihomoConnections()
      stopMihomoLogs()
      stopMihomoMemory()
      serviceCoreStreamsActive = false
      setMihomoLogSource('out')
      mainWindow?.webContents.send('core-stopped', event)
      if (event.type === 'failed' || event.type === 'restart_failed') {
        serviceCoreManaged = false
      }
      if (event.type === 'restart_failed') {
        mainWindow?.webContents.reload()
      }
      break
    case 'stopped':
      serviceCoreManaged = false
      serviceCoreStreamsActive = false
      mainWindow?.webContents.send('core-stopped', event)
      break
  }
}

function notifyCoreLog(source: CoreLogNotificationSource): void {
  for (const rule of coreLogNotificationRules) {
    const result = rule.match(source)
    if (!result) continue
    if ('closeName' in result) {
      clearTailscaleAuthNotifications(result.closeName)
      continue
    }

    const notification = result
    if (notifiedCoreLogKeys.has(notification.key)) continue

    notifiedCoreLogKeys.add(notification.key)
    if (notification.name) {
      const keys = tailscaleAuthNotificationKeysByName.get(notification.name) ?? new Set<string>()
      keys.add(notification.key)
      tailscaleAuthNotificationKeysByName.set(notification.name, keys)
    }
    const { key: _key, name: _name, ...payload } = notification
    void showNotification(payload)
  }
}

function handleDirectCoreLogData(data: Buffer | string): void {
  const text = data.toString().replaceAll('\r\n', '\n')
  const combined = directCoreLogLineBuffer + text
  const lines = combined.split('\n')

  if (combined.endsWith('\n')) {
    directCoreLogLineBuffer = ''
  } else {
    directCoreLogLineBuffer = lines.pop() ?? ''
    if (directCoreLogLineBuffer.length > directCoreLogLineLimit) {
      directCoreLogLineBuffer = directCoreLogLineBuffer.slice(-directCoreLogLineLimit)
    }
  }

  for (const line of lines) {
    notifyCoreLog({ text: line })
  }
}

function flushDirectCoreLogNotifications(): void {
  if (!directCoreLogLineBuffer) return

  notifyCoreLog({ text: directCoreLogLineBuffer })
  directCoreLogLineBuffer = ''
}

function clearTailscaleAuthNotifications(name?: string): void {
  const indexedKeys = name ? tailscaleAuthNotificationKeysByName.get(name) : undefined
  const keys =
    indexedKeys ??
    new Set(
      Array.from(notifiedCoreLogKeys).filter((key) =>
        key.startsWith(tailscaleAuthNotificationKeyPrefix)
      )
    )
  if (keys.size === 0) return

  for (const key of keys) {
    notifiedCoreLogKeys.delete(key)
    dismissNotification(key)
  }

  if (name) {
    tailscaleAuthNotificationKeysByName.delete(name)
  } else {
    tailscaleAuthNotificationKeysByName.clear()
  }
}

async function handleServiceCoreEventStreamState(
  state: 'connected' | 'disconnected'
): Promise<void> {
  await appendAppLog(`[Manager]: Service core event stream ${state}\n`)
  if (state !== 'connected') {
    return
  }
  if (serviceCoreStartupActive || serviceCoreReconnectResumePromise) {
    return
  }

  serviceCoreReconnectResumePromise = resumeServiceCoreAfterReconnect()
  try {
    await serviceCoreReconnectResumePromise
  } finally {
    serviceCoreReconnectResumePromise = null
  }
}

async function resumeServiceCoreAfterReconnect(): Promise<void> {
  await delay(500)
  if (serviceCoreStartupActive) {
    return
  }

  const { corePermissionMode = 'elevated' } = await getAppConfig()
  if (corePermissionMode !== 'service') {
    return
  }

  try {
    await getCoreStatus()
    return
  } catch (error) {
    if (isServiceConnectionError(error)) {
      return
    }
  }

  await appendAppLog(`[Manager]: Service reconnected without running core, starting core\n`)
  const promises = await startCore()
  await Promise.all(promises)
  mainWindow?.webContents.send('core-started')
}

function isDuplicateServiceCoreEvent(event: ServiceCoreEvent): boolean {
  const key =
    event.seq !== undefined
      ? `seq:${event.seq}`
      : [event.type, event.time, event.pid ?? '', event.old_pid ?? '', event.error ?? ''].join('|')
  if (key === lastServiceCoreEventKey) {
    return true
  }
  lastServiceCoreEventKey = key
  return false
}

function scheduleServiceCoreStreamsRestart(): void {
  if (serviceCoreStreamsRestartTimer) {
    clearTimeout(serviceCoreStreamsRestartTimer)
  }

  serviceCoreStreamsRestartTimer = setTimeout(() => {
    serviceCoreStreamsRestartTimer = null
    restartServiceCoreStreams().catch((error) => {
      appendAppLog(`[Manager]: restart service core streams failed, ${error}\n`).catch(() => {})
    })
  }, 300)
}

async function restartServiceCoreStreams(): Promise<void> {
  stopMihomoTraffic()
  stopMihomoConnections()
  stopMihomoLogs()
  stopMihomoMemory()
  serviceCoreStreamsActive = false
  await ensureServiceCoreStreamsStarted()
}

async function ensureServiceCoreStreamsStarted(): Promise<void> {
  if (serviceCoreStreamsRestartTimer) {
    clearTimeout(serviceCoreStreamsRestartTimer)
    serviceCoreStreamsRestartTimer = null
  }
  if (serviceCoreStreamsActive) {
    return
  }
  if (serviceCoreStreamsStarting) {
    return serviceCoreStreamsStarting
  }

  serviceCoreStreamsStarting = (async () => {
    await getAxios(true).catch(() => {})
    await startMihomoTraffic()
    await startMihomoConnections()
    await startMihomoLogs()
    await startMihomoMemory()
    setMihomoLogSource('ws')
    retry = 10
    serviceCoreStreamsActive = true
  })()

  try {
    await serviceCoreStreamsStarting
  } finally {
    serviceCoreStreamsStarting = null
  }
}

async function fallbackToElevatedCore(
  detached: boolean,
  reason: unknown
): Promise<Promise<void>[]> {
  await appendAppLog(`[Manager]: Service unavailable, fallback to elevated core, ${reason}\n`)
  stopServiceCoreEventStream()
  releaseServiceCoreEventHandler()
  await patchAppConfig({ corePermissionMode: 'elevated' })
  mainWindow?.webContents.send('appConfigUpdated')
  floatingWindow?.webContents.send('appConfigUpdated')
  void showNotification({ title: '服务不可用，已切换到非服务模式' })
  return startCore(detached)
}

async function fallbackUnavailableServiceModes(reason: unknown): Promise<void> {
  const appConfig = await getAppConfig()
  const { sysProxy, corePermissionMode = 'elevated', autoSetDNSMode = 'none' } = appConfig
  const useServiceCore = corePermissionMode === 'service'
  const useServiceSysProxy = sysProxy?.settingMode === 'service'
  const useServiceDNS = autoSetDNSMode === 'service'

  if (!useServiceCore && !useServiceSysProxy && !useServiceDNS) {
    return
  }

  await appendAppLog(`[Manager]: Service unavailable, fallback service modes, ${reason}\n`)

  if (useServiceCore) {
    stopMihomoTraffic()
    stopMihomoConnections()
    stopMihomoLogs()
    stopMihomoMemory()
    serviceCoreStreamsActive = false
    if (serviceCoreStreamsRestartTimer) {
      clearTimeout(serviceCoreStreamsRestartTimer)
      serviceCoreStreamsRestartTimer = null
    }
    stopServiceCoreEventStream()
    releaseServiceCoreEventHandler()
    setMihomoLogSource('out')
  }

  if (useServiceSysProxy) {
    stopServiceSysproxyEventStream()
  }

  await patchAppConfig({
    ...(useServiceCore ? { corePermissionMode: 'elevated' as const } : {}),
    ...(useServiceSysProxy && sysProxy
      ? {
          sysProxy: {
            ...sysProxy,
            settingMode: 'exec' as const,
            guard: false,
            guardNotify: false
          }
        }
      : {}),
    ...(useServiceDNS ? { autoSetDNSMode: 'exec' as const } : {})
  })

  mainWindow?.webContents.send('appConfigUpdated')
  floatingWindow?.webContents.send('appConfigUpdated')

  try {
    if (useServiceCore) {
      const promises = await startCore()
      await Promise.all(promises)
      mainWindow?.webContents.send('core-started')
    }
    void showNotification({ title: '服务不可用，已切换到非服务模式' })
  } finally {
    mainWindow?.webContents.reload()
    floatingWindow?.webContents.reload()
  }
}

export async function restartCore(): Promise<void> {
  try {
    clearTailscaleAuthNotifications()
    await stopCore()
    const promises = await startCore()
    await Promise.all(promises)
  } catch (e) {
    void showNotification({ title: '内核启动出错', body: `${e}`, variant: 'danger' })
  }
}

export async function keepCoreAlive(): Promise<void> {
  try {
    const { corePermissionMode = 'elevated' } = await getAppConfig()
    if (corePermissionMode === 'service') {
      return
    }

    await startCore(true)
    if (child && child.pid) {
      await writeFile(path.join(dataDir(), 'core.pid'), child.pid.toString())
    }
  } catch (e) {
    void showNotification({ title: '内核启动出错', body: `${e}`, variant: 'danger' })
  }
}

export async function quitWithoutCore(): Promise<void> {
  await keepCoreAlive()
  await startMonitor(true)
  app.exit()
}

export async function startNetworkDetection(): Promise<void> {
  await startNetworkDetectionWithCore({
    shouldStartCore: (networkDownHandled) =>
      (networkDownHandled && !child) || Boolean(child?.killed),
    startCore: async () => {
      const promises = await startCore()
      await Promise.all(promises)
    },
    stopCore
  })
}

export const stopNetworkDetection = stopNetworkDetectionController
