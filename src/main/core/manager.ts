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
  patchMihomoConfig,
  mihomoGroups,
  getAxios
} from './mihomoApi'
import { readFile, rm, writeFile } from 'fs/promises'
import { mainWindow } from '..'
import path from 'path'
import os from 'os'
import { existsSync } from 'fs'
import { uploadRuntimeConfig } from '../resolve/gistApi'
import { startMonitor } from '../resolve/trafficMonitor'
import {
  getCoreStatus,
  startCore as startServiceCore,
  stopCore as stopServiceCore,
  isServiceConnectionError,
  isServiceUnavailableError,
  type ServiceCoreLaunchProfile
} from '../service/api'
import { serviceStatus } from '../service/manager'
import { clearAppUpdateServiceFallbackPause, getServiceFallbackPolicy } from '../service/fallback'
import { appendAppLog, createLogWritable, setMihomoLogSource } from '../utils/log'
import {
  dismissNotification,
  showNotification,
  type AppNotificationPayload,
  type AppNotificationVariant
} from '../utils/notification'
import { createCoreHookWaiter, createCoreStartupHook } from './startupHook'
import { stopChildProcess } from './process-control'
import { recoverDNS, setPublicDNS, startNetworkDetectionController } from './network'
import { checkProfile } from './profile-check'
import {
  createCoreEnvironment,
  createCoreSpawnArgs,
  createProviderInitializationTracker,
  isControllerListenError,
  isControllerReadyLog,
  isTunPermissionError,
  isUpdaterFinishedLog
} from './startup-chain'
import { createServiceCoreRuntime } from './service-core-runtime'

const ctlParam = process.platform === 'win32' ? '-ext-ctl-pipe' : '-ext-ctl-unix'

const serviceConnectionRetryInterval = 500
const tailscaleAuthNotificationKeyPrefix = 'tailscale-auth:'
const directCoreLogLineLimit = 16 * 1024
const coreLogReadyTimeout = 30000

const directCoreState = {
  child: undefined as ChildProcess | undefined,
  retry: 10,
  logLineBuffer: ''
}

const serviceCoreRuntime = createServiceCoreRuntime({
  notifyCoreLog,
  resetDirectCoreRetry: () => {
    directCoreState.retry = 10
  },
  startCore: (detached) => startCoreImpl(detached)
})

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
  directCoreState.retry = 10
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

let lifecycleChain: Promise<unknown> = Promise.resolve()

function enqueueLifecycle<T>(task: () => Promise<T>): Promise<T> {
  const result = lifecycleChain.then(
    () => task(),
    () => task()
  )
  lifecycleChain = result.then(
    () => {},
    () => {}
  )
  return result
}

export function startCore(detached = false): Promise<Promise<void>[]> {
  return enqueueLifecycle(() => startCoreImpl(detached))
}

async function startCoreImpl(detached = false): Promise<Promise<void>[]> {
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
      return startCoreImpl(detached)
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
          return serviceCoreRuntime.fallbackToElevatedCore(detached, probe.error)
        }
        serviceCoreRunning = probe.running
      }
    }
  }
  if (!serviceCoreRunning) {
    await stopCoreImpl()
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
    serviceCoreRuntime.resumeAutoResume()
    serviceCoreRuntime.ensureEventHandler()
    serviceCoreRuntime.beginStartup()
    try {
      await serviceCoreRuntime.startEventStream()
      if (!serviceCoreRunning) {
        await startServiceCore(serviceProfile)
      }
      serviceCoreRuntime.setManaged(true)
    } catch (error) {
      if (isServiceUnavailableError(error)) {
        const probe = await waitForServiceCoreConnection(error)
        if (!probe.reachable) {
          return serviceCoreRuntime.fallbackToElevatedCore(detached, probe.error)
        }
        await serviceCoreRuntime.startEventStream()
        if (!probe.running) {
          await startServiceCore(serviceProfile)
        }
        serviceCoreRuntime.setManaged(true)
      } else {
        throw error
      }
    } finally {
      serviceCoreRuntime.endStartup()
    }
    await serviceCoreRuntime.ensureStreamsStarted()
    initialized = true
    return [completeCoreInitialization(logLevel)]
  }

  const providerTracker = createProviderInitializationTracker(await getRuntimeConfig())
  const stdout = createLogWritable('core', 'info')
  const stderr = createLogWritable('core', 'error')
  directCoreState.logLineBuffer = ''

  const child = spawn(corePath, spawnArgs, {
    detached: detached,
    stdio: detached ? 'ignore' : undefined,
    env: env
  })
  directCoreState.child = child
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
    if (directCoreState.retry) {
      await appendAppLog(`[Manager]: Try Restart Core\n`)
      directCoreState.retry--
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
      let settled = false

      const settleResolve = (value: Promise<void>[]): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      }

      const settleReject = (reason?: unknown): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(reason)
      }

      const timer = setTimeout(() => {
        settleReject(new Error(`等待内核启动超时：${coreLogReadyTimeout}ms`))
      }, coreLogReadyTimeout)

      child.once('close', (code, signal) => {
        settleReject(new Error(`内核启动失败，code: ${code}, signal: ${signal}`))
      })

      child.stdout?.on('data', async (data) => {
        const str = data.toString()
        await handleCoreOutput(str, settleReject)

        if (!controllerReady && isControllerReadyLog(str)) {
          controllerReady = true
          settleResolve([
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

              child.once('close', (code, signal) => {
                if (!initialized) {
                  reject(new Error(`内核启动失败，code: ${code}, signal: ${signal}`))
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

export function stopCore(force = false): Promise<void> {
  return enqueueLifecycle(() => stopCoreImpl(force))
}

async function stopCoreImpl(force = false): Promise<void> {
  serviceCoreRuntime.pauseAutoResume()

  try {
    if (!force) {
      await recoverDNS()
    }
  } catch (error) {
    await appendAppLog(`[Manager]: recover dns failed, ${error}\n`)
  }

  serviceCoreRuntime.clearStreams()

  const { corePermissionMode = 'elevated' } = await getAppConfig()
  const shouldStopServiceCore = serviceCoreRuntime.isManaged() || corePermissionMode === 'service'
  if (shouldStopServiceCore) {
    try {
      await stopServiceCore()
    } catch (error) {
      await appendAppLog(`[Manager]: stop service core failed, ${error}\n`)
    } finally {
      serviceCoreRuntime.setManaged(false)
      serviceCoreRuntime.stopEventHandlers()
    }
  }

  const child = directCoreState.child
  if (child) {
    directCoreState.child = undefined
    await stopChildProcess(child)
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
  const combined = directCoreState.logLineBuffer + text
  const lines = combined.split('\n')

  if (combined.endsWith('\n')) {
    directCoreState.logLineBuffer = ''
  } else {
    directCoreState.logLineBuffer = lines.pop() ?? ''
    if (directCoreState.logLineBuffer.length > directCoreLogLineLimit) {
      directCoreState.logLineBuffer = directCoreState.logLineBuffer.slice(-directCoreLogLineLimit)
    }
  }

  for (const line of lines) {
    notifyCoreLog({ text: line })
  }
}

function flushDirectCoreLogNotifications(): void {
  if (!directCoreState.logLineBuffer) return

  notifyCoreLog({ text: directCoreState.logLineBuffer })
  directCoreState.logLineBuffer = ''
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

export async function restartCore(): Promise<void> {
  try {
    const promises = await enqueueLifecycle(() => restartCoreImpl())
    await Promise.all(promises)
  } catch (e) {
    void showNotification({ title: '内核启动出错', body: `${e}`, variant: 'danger' })
  }
}

async function restartCoreImpl(): Promise<Promise<void>[]> {
  clearTailscaleAuthNotifications()
  await stopCoreImpl()
  return startCoreImpl()
}

export async function keepCoreAlive(): Promise<void> {
  try {
    const { corePermissionMode = 'elevated' } = await getAppConfig()
    if (corePermissionMode === 'service') {
      return
    }

    await startCore(true)
    if (directCoreState.child?.pid) {
      await writeFile(path.join(dataDir(), 'core.pid'), directCoreState.child.pid.toString())
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
  await startNetworkDetectionController({
    shouldStartCore: (networkDownHandled) => networkDownHandled && !directCoreState.child,
    startCore: async () => {
      try {
        const promises = await startCore()
        await Promise.all(promises)
      } catch (error) {
        await appendAppLog(`[Manager]: network detection start core failed, ${error}\n`)
      }
    },
    stopCore
  })
}
