import { ChildProcess, execFile, execFileSync, spawn } from 'child_process'
import {
  dataDir,
  coreLogPath,
  mihomoCorePath,
  mihomoIpcPath,
  mihomoProfileWorkDir,
  mihomoTestDir,
  mihomoWorkConfigPath,
  mihomoWorkDir
} from '../utils/dirs'
import { generateProfile, getRuntimeConfig } from './factory'
import {
  getAppConfig,
  getControledMihomoConfig,
  getProfileConfig,
  patchAppConfig,
  patchControledMihomoConfig
} from '../config'
import { app, dialog, ipcMain, net } from 'electron'
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
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { promisify } from 'util'
import { mainWindow } from '..'
import path from 'path'
import os from 'os'
import { existsSync, watch } from 'fs'
import type { FSWatcher } from 'fs'
import { uploadRuntimeConfig } from '../resolve/gistApi'
import { startMonitor } from '../resolve/trafficMonitor'
import { triggerSysProxy } from '../sys/sysproxy'
import { getAxios } from './mihomoApi'
import {
  setSysDns,
  startCore as startServiceCore,
  stopCore as stopServiceCore,
  startServiceCoreEventStream,
  stopServiceCoreEventStream,
  subscribeServiceCoreEvents,
  type ServiceCoreEvent,
  type ServiceCoreLaunchProfile
} from '../service/api'
import { randomUUID } from 'crypto'
import { appendAppLog, createLogWritable, setMihomoLogSource } from '../utils/log'

const ctlParam = process.platform === 'win32' ? '-ext-ctl-pipe' : '-ext-ctl-unix'
const coreHookTimeout = 30000

class UserCancelledError extends Error {
  constructor(message = '用户取消操作') {
    super(message)
    this.name = 'UserCancelledError'
  }
}

function isUserCancelledError(error: unknown): boolean {
  if (error instanceof UserCancelledError) {
    return true
  }
  const errorMsg = error instanceof Error ? error.message : String(error)
  return (
    errorMsg.includes('用户已取消') ||
    errorMsg.includes('User canceled') ||
    errorMsg.includes('(-128)') ||
    errorMsg.includes('user cancelled') ||
    errorMsg.includes('dismissed')
  )
}

let setPublicDNSTimer: NodeJS.Timeout | null = null
let recoverDNSTimer: NodeJS.Timeout | null = null
let networkDetectionTimer: NodeJS.Timeout | null = null
let networkDownHandled = false

let child: ChildProcess
let retry = 10
let serviceCoreStreamsRestartTimer: NodeJS.Timeout | null = null
let unsubscribeServiceCoreEvents: (() => void) | null = null
let serviceCoreStreamsActive = false
let serviceCoreStreamsStarting: Promise<void> | null = null
let lastServiceCoreEventKey = ''

interface CoreStartupHook {
  hookDir: string
  upFile: string
  upFileName: string
  postUpCommand: string
  postDownCommand: string
}

interface CoreHookWaiter {
  promise: Promise<void>
  attachProcess: (process: ChildProcess) => void
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function hookTouchCommand(file: string): string {
  return process.platform === 'win32' ? `type nul > ${file}` : `: > ${shellQuote(file)}`
}

function coreHookDir(): string {
  if (process.platform === 'win32' && process.env.ProgramData) {
    return path.join(process.env.ProgramData, 'sparkle', 'core-hooks')
  }
  return path.join(dataDir(), 'core-hooks')
}

async function createCoreStartupHook(): Promise<CoreStartupHook> {
  const runId = randomUUID()
  const hookDir = coreHookDir()

  await rm(hookDir, { recursive: true, force: true })
  await mkdir(hookDir, { recursive: true })

  const upFileName = `${runId}.up`
  const downFileName = `${runId}.down`
  const upFile = path.join(hookDir, upFileName)
  const downFile = path.join(hookDir, downFileName)

  return {
    hookDir,
    upFile,
    upFileName,
    postUpCommand: hookTouchCommand(upFile),
    postDownCommand: hookTouchCommand(downFile)
  }
}

function createCoreHookWaiter(hook: CoreStartupHook): CoreHookWaiter {
  let watcher: FSWatcher | undefined
  let timer: NodeJS.Timeout | undefined
  let attachedProcess: ChildProcess | undefined
  let completed = false

  let resolvePromise: () => void
  let rejectPromise: (reason?: unknown) => void

  const cleanup = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    if (watcher) {
      watcher.close()
      watcher = undefined
    }
    if (attachedProcess) {
      attachedProcess.off('close', handleClose)
      attachedProcess = undefined
    }
  }

  const complete = (error?: unknown): void => {
    if (completed) return
    completed = true
    cleanup()
    if (error) {
      rejectPromise(error)
    } else {
      resolvePromise()
    }
  }

  const handleClose = (code: number | null, signal: NodeJS.Signals | null): void => {
    complete(new Error(`内核启动失败，post-up 未触发，code: ${code}, signal: ${signal}`))
  }

  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject

    watcher = watch(hook.hookDir, (_eventType, filename) => {
      const changedFile = filename?.toString()
      if (changedFile === hook.upFileName || (!changedFile && existsSync(hook.upFile))) {
        complete()
      }
    })

    watcher.on('error', complete)

    timer = setTimeout(() => {
      complete(new Error(`等待内核 post-up 超时：${coreHookTimeout}ms`))
    }, coreHookTimeout)
  })

  return {
    promise,
    attachProcess: (process) => {
      attachedProcess = process
      attachedProcess.once('close', handleClose)
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
  const { 'log-level': logLevel } = await getControledMihomoConfig()
  const { current } = await getProfileConfig()
  const { tun } = await getControledMihomoConfig()

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
  await stopCore()
  setMihomoLogSource('out')
  if (tun?.enable && autoSetDNSMode !== 'none') {
    try {
      await setPublicDNS()
    } catch (error) {
      await appendAppLog(`[Manager]: set dns failed, ${error}\n`)
    }
  }
  const { 'rule-providers': ruleProviders, 'proxy-providers': proxyProviders } =
    await getRuntimeConfig()

  const normalize = (s: string): string =>
    s
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .normalize('NFC')

  const providerNames = new Set(
    [...Object.keys(ruleProviders || {}), ...Object.keys(proxyProviders || {})].map(normalize)
  )
  const unmatchedProviders = new Set(providerNames)
  const stdout = createLogWritable('core', 'info')
  const stderr = createLogWritable('core', 'error')
  const env = {
    DISABLE_LOOPBACK_DETECTOR: String(disableLoopbackDetector),
    DISABLE_EMBED_CA: String(disableEmbedCA),
    DISABLE_SYSTEM_CA: String(disableSystemCA),
    DISABLE_NFTABLES: String(disableNftables),
    SAFE_PATHS: safePaths.join(path.delimiter),
    PATH: process.env.PATH
  }
  const useServiceCore = corePermissionMode === 'service' && !detached

  const startMihomoApiStreams = async (): Promise<void> => {
    await startMihomoTraffic()
    await startMihomoConnections()
    await startMihomoLogs()
    await startMihomoMemory()
    retry = 10
  }

  const completeCoreInitialization = async (): Promise<void> => {
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

  let initialized = false
  const coreHook =
    !useServiceCore && !detached && coreStartupMode === 'post-up'
      ? await createCoreStartupHook()
      : undefined
  const hookWaiter = coreHook ? createCoreHookWaiter(coreHook) : undefined
  const spawnArgs = [
    '-d',
    diffWorkDir ? mihomoProfileWorkDir(current) : mihomoWorkDir(),
    ctlParam,
    mihomoIpcPath()
  ]

  if (coreHook) {
    await appendAppLog(
      `[Manager]: Core startup mode: post-up, post-up command: ${coreHook.postUpCommand}\n`
    )
    spawnArgs.push('-post-up', coreHook.postUpCommand, '-post-down', coreHook.postDownCommand)
  } else if (!detached) {
    await appendAppLog(`[Manager]: Core startup mode: log\n`)
  }

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
    await startServiceCoreEventStream()
    await startServiceCore(serviceProfile)
    await ensureServiceCoreStreamsStarted()
    initialized = true
    return [completeCoreInitialization()]
  }

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
    if (
      (process.platform !== 'win32' && str.includes('External controller unix listen error')) ||
      (process.platform === 'win32' && str.includes('External controller pipe listen error'))
    ) {
      reject(`控制器监听错误:\n${str}`)
    }

    if (process.platform === 'win32' && str.includes('updater: finished')) {
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

        if (
          !controllerReady &&
          ((process.platform !== 'win32' && str.includes('RESTful API unix listening at')) ||
            (process.platform === 'win32' && str.includes('RESTful API pipe listening at')))
        ) {
          controllerReady = true
          resolve([
            new Promise((resolve, reject) => {
              const handleProviderInitialization = async (logLine: string): Promise<void> => {
                for (const match of logLine.matchAll(/Start initial provider ([^"]+)"/g)) {
                  const name = normalize(match[1])
                  if (providerNames.has(name)) {
                    unmatchedProviders.delete(name)
                  }
                }

                if (
                  logLine.includes(
                    'Start TUN listening error: configure tun interface: Connect: operation not permitted'
                  )
                ) {
                  patchControledMihomoConfig({ tun: { enable: false } })
                  mainWindow?.webContents.send('controledMihomoConfigUpdated')
                  ipcMain.emit('updateTrayMenu')
                  reject('虚拟网卡启动失败，前往内核设置页尝试手动授予内核权限')
                }

                const isDefaultProvider = logLine.includes(
                  'Start initial compatible provider default'
                )
                const isAllProvidersMatched =
                  providerNames.size > 0 && unmatchedProviders.size === 0

                if ((providerNames.size === 0 && isDefaultProvider) || isAllProvidersMatched) {
                  const waitForMihomoReady = async (): Promise<void> => {
                    const maxRetries = 30
                    const retryInterval = 100

                    for (let i = 0; i < maxRetries; i++) {
                      try {
                        await mihomoGroups()
                        break
                      } catch (error) {
                        await new Promise((r) => setTimeout(r, retryInterval))
                      }
                    }
                  }

                  await waitForMihomoReady()
                  initialized = true
                  completeCoreInitialization()
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
          resolve([completeCoreInitialization()])
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
  if (unsubscribeServiceCoreEvents) {
    return
  }
  unsubscribeServiceCoreEvents = subscribeServiceCoreEvents((event) =>
    handleServiceCoreEvent(event)
  )
}

function releaseServiceCoreEventHandler(): void {
  if (!unsubscribeServiceCoreEvents) {
    return
  }
  unsubscribeServiceCoreEvents()
  unsubscribeServiceCoreEvents = null
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

async function stopChildProcess(process: ChildProcess): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!process || process.killed) {
      resolve()
      return
    }

    const pid = process.pid
    if (!pid) {
      resolve()
      return
    }

    process.removeAllListeners()

    let isResolved = false
    const timers: NodeJS.Timeout[] = []

    const resolveOnce = async (): Promise<void> => {
      if (!isResolved) {
        isResolved = true

        timers.forEach((timer) => clearTimeout(timer))
        resolve()
      }
    }

    process.once('close', resolveOnce)
    process.once('exit', resolveOnce)

    try {
      process.kill('SIGINT')

      const timer1 = setTimeout(async () => {
        if (!process.killed && !isResolved) {
          try {
            if (pid) {
              globalThis.process.kill(pid, 0)
              process.kill('SIGTERM')
            }
          } catch {
            await resolveOnce()
          }
        }
      }, 3000)
      timers.push(timer1)

      const timer2 = setTimeout(async () => {
        if (!process.killed && !isResolved) {
          try {
            if (pid) {
              globalThis.process.kill(pid, 0)
              process.kill('SIGKILL')
              await appendAppLog(`[Manager]: Force killed process ${pid} with SIGKILL\n`)
            }
          } catch {
            // ignore
          }
          await resolveOnce()
        }
      }, 6000)
      timers.push(timer2)
    } catch (error) {
      resolveOnce()
      return
    }
  })
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

async function checkProfile(): Promise<void> {
  const { core = 'mihomo', diffWorkDir = false, safePaths = [] } = await getAppConfig()
  const { current } = await getProfileConfig()
  const corePath = mihomoCorePath(core)
  const execFilePromise = promisify(execFile)
  const env = {
    SAFE_PATHS: safePaths.join(path.delimiter)
  }
  try {
    await execFilePromise(
      corePath,
      [
        '-t',
        '-f',
        diffWorkDir ? mihomoWorkConfigPath(current) : mihomoWorkConfigPath('work'),
        '-d',
        mihomoTestDir()
      ],
      { env }
    )
  } catch (error) {
    if (error instanceof Error && 'stdout' in error) {
      const { stdout } = error as { stdout: string }
      const errorLines = stdout
        .split('\n')
        .filter((line) => line.includes('level=error'))
        .map((line) => line.split('level=error')[1])
      throw new Error(`Profile Check Failed:\n${errorLines.join('\n')}`)
    } else {
      throw error
    }
  }
}

export async function manualGrantCorePermition(
  cores?: ('mihomo' | 'mihomo-alpha')[]
): Promise<void> {
  const execFilePromise = promisify(execFile)

  const grantPermission = async (coreName: 'mihomo' | 'mihomo-alpha'): Promise<void> => {
    const corePath = mihomoCorePath(coreName)
    try {
      if (process.platform === 'darwin') {
        const escapedPath = corePath.replace(/"/g, '\\"')
        const shell = `chown root:admin \\"${escapedPath}\\" && chmod +sx \\"${escapedPath}\\"`
        const command = `do shell script "${shell}" with administrator privileges`
        await execFilePromise('osascript', ['-e', command])
      }
      if (process.platform === 'linux') {
        await execFilePromise('pkexec', [
          'bash',
          '-c',
          `chown root:root "${corePath}" && chmod +sx "${corePath}"`
        ])
      }
    } catch (error) {
      if (isUserCancelledError(error)) {
        throw new UserCancelledError()
      }
      throw error
    }
  }

  const targetCores = cores || ['mihomo', 'mihomo-alpha']
  await Promise.all(targetCores.map((core) => grantPermission(core)))
}

export function checkCorePermissionSync(coreName: 'mihomo' | 'mihomo-alpha'): boolean {
  if (process.platform === 'win32') return true
  try {
    const corePath = mihomoCorePath(coreName)
    const stdout = execFileSync('ls', ['-l', corePath], { encoding: 'utf8' })
    const permissions = stdout.trim().split(/\s+/)[0]
    return permissions.includes('s') || permissions.includes('S')
  } catch {
    return false
  }
}

export async function checkCorePermission(): Promise<{ mihomo: boolean; 'mihomo-alpha': boolean }> {
  const execFilePromise = promisify(execFile)

  const checkPermission = async (coreName: 'mihomo' | 'mihomo-alpha'): Promise<boolean> => {
    try {
      const corePath = mihomoCorePath(coreName)
      const { stdout } = await execFilePromise('ls', ['-l', corePath])
      const permissions = stdout.trim().split(/\s+/)[0]
      return permissions.includes('s') || permissions.includes('S')
    } catch (error) {
      return false
    }
  }

  const [mihomoPermission, mihomoAlphaPermission] = await Promise.all([
    checkPermission('mihomo'),
    checkPermission('mihomo-alpha')
  ])

  return {
    mihomo: mihomoPermission,
    'mihomo-alpha': mihomoAlphaPermission
  }
}

export async function revokeCorePermission(cores?: ('mihomo' | 'mihomo-alpha')[]): Promise<void> {
  const execFilePromise = promisify(execFile)

  const revokePermission = async (coreName: 'mihomo' | 'mihomo-alpha'): Promise<void> => {
    const corePath = mihomoCorePath(coreName)
    try {
      if (process.platform === 'darwin') {
        const escapedPath = corePath.replace(/"/g, '\\"')
        const shell = `chmod a-s \\"${escapedPath}\\"`
        const command = `do shell script "${shell}" with administrator privileges`
        await execFilePromise('osascript', ['-e', command])
      }
      if (process.platform === 'linux') {
        await execFilePromise('pkexec', ['bash', '-c', `chmod a-s "${corePath}"`])
      }
    } catch (error) {
      if (isUserCancelledError(error)) {
        throw new UserCancelledError()
      }
      throw error
    }
  }

  const targetCores = cores || ['mihomo', 'mihomo-alpha']
  await Promise.all(targetCores.map((core) => revokePermission(core)))
}

export async function getDefaultDevice(): Promise<string> {
  const execFilePromise = promisify(execFile)
  const { stdout: deviceOut } = await execFilePromise('route', ['-n', 'get', 'default'])
  let device = deviceOut.split('\n').find((s) => s.includes('interface:'))
  device = device?.trim().split(' ').slice(1).join(' ')
  if (!device) throw new Error('Get device failed')
  return device
}

async function getDefaultService(): Promise<string> {
  const execFilePromise = promisify(execFile)
  const device = await getDefaultDevice()
  const { stdout: order } = await execFilePromise('networksetup', ['-listnetworkserviceorder'])
  const block = order.split('\n\n').find((s) => s.includes(`Device: ${device}`))
  if (!block) throw new Error('Get networkservice failed')
  for (const line of block.split('\n')) {
    if (line.match(/^\(\d+\).*/)) {
      return line.trim().split(' ').slice(1).join(' ')
    }
  }
  throw new Error('Get service failed')
}

async function getOriginDNS(): Promise<void> {
  const execFilePromise = promisify(execFile)
  const service = await getDefaultService()
  const { stdout: dns } = await execFilePromise('networksetup', ['-getdnsservers', service])
  if (dns.startsWith("There aren't any DNS Servers set on")) {
    await patchAppConfig({ originDNS: 'Empty' })
  } else {
    await patchAppConfig({ originDNS: dns.trim().replace(/\n/g, ' ') })
  }
}

async function setDNS(dns: string, mode: 'none' | 'exec' | 'service'): Promise<void> {
  const service = await getDefaultService()
  const dnsServers = dns.split(' ')
  if (mode === 'exec') {
    const execFilePromise = promisify(execFile)
    await execFilePromise('networksetup', ['-setdnsservers', service, ...dnsServers])
    return
  }
  if (mode === 'service') {
    await setSysDns(service, dnsServers)
    return
  }
}

async function setPublicDNS(): Promise<void> {
  if (process.platform !== 'darwin') return
  if (net.isOnline()) {
    const { originDNS, autoSetDNSMode = 'none' } = await getAppConfig()
    if (!originDNS) {
      await getOriginDNS()
      await setDNS('223.5.5.5', autoSetDNSMode)
    }
  } else {
    if (setPublicDNSTimer) clearTimeout(setPublicDNSTimer)
    setPublicDNSTimer = setTimeout(() => setPublicDNS(), 5000)
  }
}

async function recoverDNS(): Promise<void> {
  if (process.platform !== 'darwin') return
  if (net.isOnline()) {
    const { originDNS, autoSetDNSMode = 'none' } = await getAppConfig()
    if (originDNS) {
      await setDNS(originDNS, autoSetDNSMode)
      await patchAppConfig({ originDNS: undefined })
    }
  } else {
    if (recoverDNSTimer) clearTimeout(recoverDNSTimer)
    recoverDNSTimer = setTimeout(() => recoverDNS(), 5000)
  }
}

export async function startNetworkDetection(): Promise<void> {
  const {
    onlyActiveDevice = false,
    networkDetectionBypass = [],
    networkDetectionInterval = 10,
    sysProxy = { enable: false }
  } = await getAppConfig()
  const { tun: { device = process.platform === 'darwin' ? undefined : 'mihomo' } = {} } =
    await getControledMihomoConfig()
  if (networkDetectionTimer) {
    clearInterval(networkDetectionTimer)
  }
  const extendedBypass = networkDetectionBypass.concat(
    [device, 'lo', 'docker0', 'utun'].filter((item): item is string => item !== undefined)
  )

  networkDetectionTimer = setInterval(async () => {
    if (isAnyNetworkInterfaceUp(extendedBypass) && net.isOnline()) {
      if ((networkDownHandled && !child) || (child && child.killed)) {
        const promises = await startCore()
        await Promise.all(promises)
        if (sysProxy.enable) triggerSysProxy(true, onlyActiveDevice)
        networkDownHandled = false
      }
    } else {
      if (!networkDownHandled) {
        if (sysProxy.enable) triggerSysProxy(false, onlyActiveDevice, true)
        await stopCore()
        networkDownHandled = true
      }
    }
  }, networkDetectionInterval * 1000)
}

export async function stopNetworkDetection(): Promise<void> {
  if (networkDetectionTimer) {
    clearInterval(networkDetectionTimer)
    networkDetectionTimer = null
  }
}

function isAnyNetworkInterfaceUp(excludedKeywords: string[] = []): boolean {
  const interfaces = os.networkInterfaces()
  return Object.entries(interfaces).some(([name, ifaces]) => {
    if (excludedKeywords.some((keyword) => name.includes(keyword))) return false

    return ifaces?.some((iface) => {
      return !iface.internal && (iface.family === 'IPv4' || iface.family === 'IPv6')
    })
  })
}
