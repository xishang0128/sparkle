import { ChildProcess, exec, execFile, spawn } from 'child_process'
import {
  dataDir,
  logPath,
  mihomoCoreDir,
  mihomoCorePath,
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
  patchMihomoConfig
} from './mihomoApi'
import chokidar from 'chokidar'
import { readFile, rm, writeFile } from 'fs/promises'
import { promisify } from 'util'
import { mainWindow } from '..'
import path from 'path'
import os from 'os'
import { createWriteStream, existsSync } from 'fs'
import { uploadRuntimeConfig } from '../resolve/gistApi'
import { startMonitor } from '../resolve/trafficMonitor'
import { disableSysProxy, triggerSysProxy } from '../sys/sysproxy'

chokidar.watch(path.join(mihomoCoreDir(), 'meta-update'), {}).on('unlinkDir', async () => {
  try {
    await stopCore(true)
    await startCore()
  } catch (e) {
    dialog.showErrorBox('内核启动出错', `${e}`)
  }
})

export const mihomoIpcPath =
  process.platform === 'win32' ? '\\\\.\\pipe\\Sparkle\\mihomo' : '/tmp/sparkle.sock'
const ctlParam = process.platform === 'win32' ? '-ext-ctl-pipe' : '-ext-ctl-unix'

let setPublicDNSTimer: NodeJS.Timeout | null = null
let recoverDNSTimer: NodeJS.Timeout | null = null
let networkDetectionTimer: NodeJS.Timeout | null = null
let child: ChildProcess
let retry = 10

export async function startCore(detached = false): Promise<Promise<void>[]> {
  const {
    core = 'mihomo',
    autoSetDNS = true,
    diffWorkDir = false,
    mihomoCpuPriority = 'PRIORITY_NORMAL',
    disableLoopbackDetector = false,
    disableEmbedCA = false,
    disableSystemCA = false,
    disableNftables = false,
    safePaths = []
  } = await getAppConfig()
  const { 'log-level': logLevel } = await getControledMihomoConfig()
  if (existsSync(path.join(dataDir(), 'core.pid'))) {
    const pid = parseInt(await readFile(path.join(dataDir(), 'core.pid'), 'utf-8'))
    try {
      process.kill(pid, 'SIGINT')
    } catch {
      // ignore
    } finally {
      await rm(path.join(dataDir(), 'core.pid'))
    }
  }
  const { current } = await getProfileConfig()
  const { tun } = await getControledMihomoConfig()
  const corePath = mihomoCorePath(core)
  await generateProfile()
  await checkProfile()
  await stopCore()
  if (tun?.enable && autoSetDNS) {
    try {
      await setPublicDNS()
    } catch (error) {
      await writeFile(logPath(), `[Manager]: set dns failed, ${error}`, {
        flag: 'a'
      })
    }
  }
  const { 'rule-providers': ruleProviders, 'proxy-providers': proxyProviders } =
    await getRuntimeConfig()
  const providerNames = new Set([
    ...Object.keys(ruleProviders || {}),
    ...Object.keys(proxyProviders || {})
  ])
  const matchedProviders = new Set<string>()
  const stdout = createWriteStream(logPath(), { flags: 'a' })
  const stderr = createWriteStream(logPath(), { flags: 'a' })
  const env = {
    DISABLE_LOOPBACK_DETECTOR: String(disableLoopbackDetector),
    DISABLE_EMBED_CA: String(disableEmbedCA),
    DISABLE_SYSTEM_CA: String(disableSystemCA),
    DISABLE_NFTABLES: String(disableNftables),
    SAFE_PATHS: safePaths.join(path.delimiter)
  }
  let initialized = false
  child = spawn(
    corePath,
    ['-d', diffWorkDir ? mihomoProfileWorkDir(current) : mihomoWorkDir(), ctlParam, mihomoIpcPath],
    {
      detached: detached,
      stdio: detached ? 'ignore' : undefined,
      env: env
    }
  )
  if (process.platform === 'win32' && child.pid) {
    os.setPriority(child.pid, os.constants.priority[mihomoCpuPriority])
  }
  if (detached) {
    child.unref()
    return new Promise((resolve) => {
      resolve([new Promise(() => {})])
    })
  }
  child.on('close', async (code, signal) => {
    await writeFile(logPath(), `[Manager]: Core closed, code: ${code}, signal: ${signal}\n`, {
      flag: 'a'
    })
    if (retry) {
      await writeFile(logPath(), `[Manager]: Try Restart Core\n`, { flag: 'a' })
      retry--
      await restartCore()
    } else {
      await stopCore()
    }
  })
  child.stdout?.pipe(stdout)
  child.stderr?.pipe(stderr)
  return new Promise((resolve, reject) => {
    child.stdout?.on('data', async (data) => {
      const str = data.toString()
      if (str.includes('configure tun interface: operation not permitted')) {
        patchControledMihomoConfig({ tun: { enable: false } })
        mainWindow?.webContents.send('controledMihomoConfigUpdated')
        ipcMain.emit('updateTrayMenu')
        reject('虚拟网卡启动失败，请尝试手动授予内核权限')
      }

      if (
        (process.platform !== 'win32' && str.includes('External controller unix listen error')) ||
        (process.platform === 'win32' && str.includes('External controller pipe listen error'))
      ) {
        reject(`控制器监听错误:\n${str}`)
      }

      if (
        (process.platform !== 'win32' && str.includes('RESTful API unix listening at')) ||
        (process.platform === 'win32' && str.includes('RESTful API pipe listening at'))
      ) {
        resolve([
          new Promise((resolve) => {
            const handleProviderInitialization = async (logLine: string): Promise<void> => {
              for (const match of logLine.matchAll(
                /Start initial provider ([\w\-!@#$%^&*()\p{Script=Han}]+)/gu
              )) {
                matchedProviders.add(match[1])
              }

              const isDefaultProvider = logLine.includes(
                'Start initial compatible provider default'
              )
              const isAllProvidersMatched =
                providerNames.size > 0 && matchedProviders.size === providerNames.size

              if ((providerNames.size === 0 && isDefaultProvider) || isAllProvidersMatched) {
                const delay = providerNames.size === 0 ? 100 : 500
                initialized = true
                Promise.all([
                  new Promise((r) => setTimeout(r, delay)).then(() => {
                    mainWindow?.webContents.send('groupsUpdated')
                    mainWindow?.webContents.send('rulesUpdated')
                  }),
                  uploadRuntimeConfig(),
                  new Promise((r) => setTimeout(r, delay)).then(() =>
                    patchMihomoConfig({ 'log-level': logLevel })
                  )
                ]).then(() => resolve())
              }
            }
            child.stdout?.on('data', (data) => {
              if (!initialized) {
                handleProviderInitialization(data.toString())
              }
            })
          })
        ])
        await startMihomoTraffic()
        await startMihomoConnections()
        await startMihomoLogs()
        await startMihomoMemory()
        retry = 10
      }
    })
  })
}

export async function stopCore(force = false): Promise<void> {
  try {
    if (!force) {
      await recoverDNS()
    }
  } catch (error) {
    await writeFile(logPath(), `[Manager]: recover dns failed, ${error}`, {
      flag: 'a'
    })
  }

  if (child) {
    child.removeAllListeners()
    child.kill('SIGINT')
  }
  stopMihomoTraffic()
  stopMihomoConnections()
  stopMihomoLogs()
  stopMihomoMemory()
}

export async function restartCore(): Promise<void> {
  try {
    await startCore()
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

export async function manualGrantCorePermition(): Promise<void> {
  const { core = 'mihomo' } = await getAppConfig()
  const corePath = mihomoCorePath(core)
  const execPromise = promisify(exec)
  const execFilePromise = promisify(execFile)
  if (process.platform === 'darwin') {
    const shell = `chown root:admin ${corePath.replace(' ', '\\\\ ')}\nchmod +sx ${corePath.replace(' ', '\\\\ ')}`
    const command = `do shell script "${shell}" with administrator privileges`
    await execPromise(`osascript -e '${command}'`)
  }
  if (process.platform === 'linux') {
    await execFilePromise('pkexec', [
      'bash',
      '-c',
      `chown root:root "${corePath}" && chmod +sx "${corePath}"`
    ])
  }
}

export async function getDefaultDevice(): Promise<string> {
  const execPromise = promisify(exec)
  const { stdout: deviceOut } = await execPromise(`route -n get default`)
  let device = deviceOut.split('\n').find((s) => s.includes('interface:'))
  device = device?.trim().split(' ').slice(1).join(' ')
  if (!device) throw new Error('Get device failed')
  return device
}

async function getDefaultService(): Promise<string> {
  const execPromise = promisify(exec)
  const device = await getDefaultDevice()
  const { stdout: order } = await execPromise(`networksetup -listnetworkserviceorder`)
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
  const execPromise = promisify(exec)
  const service = await getDefaultService()
  const { stdout: dns } = await execPromise(`networksetup -getdnsservers "${service}"`)
  if (dns.startsWith("There aren't any DNS Servers set on")) {
    await patchAppConfig({ originDNS: 'Empty' })
  } else {
    await patchAppConfig({ originDNS: dns.trim().replace(/\n/g, ' ') })
  }
}

async function setDNS(dns: string): Promise<void> {
  const service = await getDefaultService()
  const execPromise = promisify(exec)
  await execPromise(`networksetup -setdnsservers "${service}" ${dns}`)
}

async function setPublicDNS(): Promise<void> {
  if (process.platform !== 'darwin') return
  if (net.isOnline()) {
    const { originDNS } = await getAppConfig()
    if (!originDNS) {
      await getOriginDNS()
      await setDNS('223.5.5.5')
    }
  } else {
    if (setPublicDNSTimer) clearTimeout(setPublicDNSTimer)
    setPublicDNSTimer = setTimeout(() => setPublicDNS(), 5000)
  }
}

async function recoverDNS(): Promise<void> {
  if (process.platform !== 'darwin') return
  if (net.isOnline()) {
    const { originDNS } = await getAppConfig()
    if (originDNS) {
      await setDNS(originDNS)
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
    networkDetectionInterval = 10
  } = await getAppConfig()
  const { tun: { device = process.platform === 'darwin' ? undefined : 'mihomo' } = {} } =
    await getControledMihomoConfig()
  if (networkDetectionTimer) {
    clearInterval(networkDetectionTimer)
  }
  const extendedBypass = networkDetectionBypass.concat(
    [device, 'lo', 'docker0', 'utun'].filter((item): item is string => item !== undefined)
  )

  networkDetectionTimer = setInterval(() => {
    if (isAnyNetworkInterfaceUp(extendedBypass) && net.isOnline()) {
      if (child && child.killed) {
        startCore()
        triggerSysProxy(true, onlyActiveDevice)
      }
    } else {
      disableSysProxy(false)
      stopCore()
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
