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
import { app, dialog, ipcMain } from 'electron'
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
  subscribeServiceCoreEvents,
  subscribeServiceCoreEventStream,
  type ServiceCoreEvent,
  type ServiceCoreLaunchProfile
} from '../service/api'
import { appendAppLog, createLogWritable, setMihomoLogSource } from '../utils/log'
import { createCoreHookWaiter, createCoreStartupHook } from './startupHook'
import { stopChildProcess } from './process-control'
import {
  recoverDNS,
  setPublicDNS,
  startNetworkDetection as startNetworkDetectionWithCore,
  stopNetworkDetection as stopNetworkDetectionController
} from './network'
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
let serviceCoreReconnectResumePromise: Promise<void> | null = null

async function startMihomoApiStreams(): Promise<void> {
  await startMihomoTraffic()
  await startMihomoConnections()
  await startMihomoLogs()
  await startMihomoMemory()
  retry = 10
}

async function completeCoreInitialization(logLevel?: LogLevel): Promise<void> {
  const tasks: Promise<unknown>[] = [
    new Promise<void>((resolve) => setTimeout(resolve, 100)).then(() => {
      mainWindow?.webContents.send('groupsUpdated')
      mainWindow?.webContents.send('rulesUpdated')
    }),
    uploadRuntimeConfig()
  ]

  if (logLevel) {
    tasks.push(
      new Promise<void>((resolve) => setTimeout(resolve, 100)).then(() =>
        patchMihomoConfig({ 'log-level': logLevel })
      )
    )
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
      await new Promise((resolve) => setTimeout(resolve, retryInterval))
    }
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
      if (isServiceConnectionError(error)) {
        return fallbackToElevatedCore(detached, error)
      }
    }
  }
  if (!serviceCoreRunning) {
    await stopCore()
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
    } catch (error) {
      if (isServiceConnectionError(error)) {
        return fallbackToElevatedCore(detached, error)
      }
      throw error
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
        dialog.showErrorBox('内核启动出错', `${e}`)
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
  if (corePermissionMode === 'service') {
    try {
      await stopServiceCore()
    } catch (error) {
      await appendAppLog(`[Manager]: stop service core failed, ${error}\n`)
    } finally {
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
        await new Promise((resolve) => setTimeout(resolve, 1000))
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
  if (isDuplicateServiceCoreEvent(event)) {
    return
  }

  await appendAppLog(
    `[Manager]: Service core event: ${event.type}${event.pid ? `, pid: ${event.pid}` : ''}${event.error ? `, error: ${event.error}` : ''}\n`
  )

  mainWindow?.webContents.send('core-status-changed', event)

  switch (event.type) {
    case 'started':
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
      if (event.type === 'restart_failed') {
        mainWindow?.webContents.reload()
      }
      break
    case 'stopped':
      serviceCoreStreamsActive = false
      mainWindow?.webContents.send('core-stopped', event)
      break
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
  await new Promise((resolve) => setTimeout(resolve, 500))
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
  return startCore(detached)
}

function isServiceConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return [
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOENT',
    'EPIPE',
    'ETIMEDOUT',
    'socket hang up',
    'connect ',
    'no such file'
  ].some((fragment) => message.toLowerCase().includes(fragment.toLowerCase()))
}

export async function restartCore(): Promise<void> {
  try {
    await stopCore()
    const promises = await startCore()
    await Promise.all(promises)
  } catch (e) {
    dialog.showErrorBox('内核启动出错', `${e}`)
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
    dialog.showErrorBox('内核启动出错', `${e}`)
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
