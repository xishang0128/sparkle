import axios, { AxiosInstance } from 'axios'
import { getAppConfig, getControledMihomoConfig } from '../config'
import { mainWindow } from '..'
import WebSocket from 'ws'
import { tray } from '../resolve/tray'
import { calcTraffic } from '../utils/calc'
import { getRuntimeConfig } from './factory'
import { floatingWindow } from '../resolve/floatingWindow'
import { mihomoIpcPath, serviceIpcPath } from '../utils/dirs'
import { publishMihomoLog } from '../utils/log'
import { createSignedServiceAxios, getServiceAuthHeaders } from '../service/api'

let axiosIns: AxiosInstance = null!
let mihomoTrafficWs: WebSocket | null = null
let trafficRetry = 10
let trafficReconnectTimer: NodeJS.Timeout | null = null
let mihomoMemoryWs: WebSocket | null = null
let memoryRetry = 10
let memoryReconnectTimer: NodeJS.Timeout | null = null
let mihomoLogsWs: WebSocket | null = null
let logsRetry = 10
let logsReconnectTimer: NodeJS.Timeout | null = null
let mihomoConnectionsWs: WebSocket | null = null
let connectionsRetry = 10
let connectionsReconnectTimer: NodeJS.Timeout | null = null
let axiosMode: 'direct' | 'service' | null = null
const wsReconnectDelay = 1000

function isWebSocketActive(ws: WebSocket | null): boolean {
  return ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING
}

function closeWebSocket(ws: WebSocket): void {
  ws.removeAllListeners()
  ws.on('error', () => {})
  if (isWebSocketActive(ws)) {
    ws.close()
  }
}

export const getAxios = async (force: boolean = false): Promise<AxiosInstance> => {
  const { corePermissionMode = 'elevated' } = await getAppConfig()
  const nextMode = corePermissionMode === 'service' ? 'service' : 'direct'
  const currentSocketPath = nextMode === 'service' ? serviceIpcPath() : mihomoIpcPath()
  const currentBaseURL =
    nextMode === 'service' ? 'http://localhost/core/controller' : 'http://localhost'

  if (
    axiosIns &&
    (axiosIns.defaults.socketPath !== currentSocketPath ||
      axiosIns.defaults.baseURL !== currentBaseURL ||
      axiosMode !== nextMode)
  ) {
    force = true
  }

  if (axiosIns && !force) return axiosIns

  axiosMode = nextMode
  if (nextMode === 'service') {
    axiosIns = createSignedServiceAxios(currentBaseURL)
  } else {
    axiosIns = axios.create({
      baseURL: currentBaseURL,
      socketPath: currentSocketPath,
      timeout: 15000
    })

    axiosIns.interceptors.response.use(
      (response) => {
        return response.data
      },
      (error) => {
        if (error.response && error.response.data) {
          return Promise.reject(error.response.data)
        }
        return Promise.reject(error)
      }
    )
  }
  return axiosIns
}

const mihomoWs = async (path: string): Promise<WebSocket> => {
  const { corePermissionMode = 'elevated' } = await getAppConfig()
  if (corePermissionMode !== 'service') {
    return new WebSocket(`ws+unix:${mihomoIpcPath()}:${path}`)
  }

  const servicePath = `/core/controller${path}`
  return new WebSocket(`ws+unix:${serviceIpcPath()}:${servicePath}`, {
    headers: getServiceAuthHeaders('GET', servicePath)
  })
}

export async function mihomoVersion(): Promise<ControllerVersion> {
  const instance = await getAxios()
  return await instance.get('/version')
}

export const mihomoConfig = async (): Promise<ControllerConfigs> => {
  const instance = await getAxios()
  return await instance.get('/configs')
}

export const patchMihomoConfig = async (patch: Partial<ControllerConfigs>): Promise<void> => {
  const instance = await getAxios()
  return await instance.patch('/configs', patch)
}

export const mihomoCloseConnection = async (id: string): Promise<void> => {
  const instance = await getAxios()
  return await instance.delete(`/connections/${encodeURIComponent(id)}`)
}

export const mihomoGetConnections = async (): Promise<ControllerConnections> => {
  const instance = await getAxios()
  return await instance.get('/connections')
}

export const mihomoCloseConnections = async (name?: string): Promise<void> => {
  const instance = await getAxios()
  if (name) {
    const connectionsInfo = await mihomoGetConnections()
    const targetConnections =
      connectionsInfo?.connections?.filter((conn) => conn.chains && conn.chains.includes(name)) ||
      []
    for (const conn of targetConnections) {
      try {
        await mihomoCloseConnection(conn.id)
      } catch (error) {
        // ignore
      }
    }
  } else {
    return await instance.delete('/connections')
  }
}

export const mihomoRules = async (): Promise<ControllerRules> => {
  const instance = await getAxios()
  return await instance.get('/rules')
}

export const mihomoProxies = async (): Promise<ControllerProxies> => {
  const instance = await getAxios()
  return await instance.get('/proxies')
}

export const mihomoGroups = async (): Promise<ControllerMixedGroup[]> => {
  const { mode = 'rule' } = await getControledMihomoConfig()
  if (mode === 'direct') return []
  const proxies = await mihomoProxies()
  const runtime = await getRuntimeConfig()
  const groups: ControllerMixedGroup[] = []
  runtime?.['proxy-groups']?.forEach((group: { name: string; url?: string }) => {
    const { name, url } = group
    if (proxies.proxies[name] && 'all' in proxies.proxies[name] && !proxies.proxies[name].hidden) {
      const newGroup = proxies.proxies[name]
      newGroup.testUrl = url
      const newAll = newGroup.all.map((name) => proxies.proxies[name])
      groups.push({ ...newGroup, all: newAll })
    }
  })
  if (!groups.find((group) => group.name === 'GLOBAL')) {
    const newGlobal = proxies.proxies['GLOBAL'] as ControllerGroupDetail
    if (!newGlobal.hidden) {
      const newAll = newGlobal.all.map((name) => proxies.proxies[name])
      groups.push({ ...newGlobal, all: newAll })
    }
  }
  if (mode === 'global') {
    const global = groups.findIndex((group) => group.name === 'GLOBAL')
    groups.unshift(groups.splice(global, 1)[0])
  }
  return groups
}

export const mihomoProxyProviders = async (): Promise<ControllerProxyProviders> => {
  const instance = await getAxios()
  return await instance.get('/providers/proxies')
}

export const mihomoUpdateProxyProviders = async (name: string): Promise<void> => {
  const instance = await getAxios()
  return await instance.put(`/providers/proxies/${encodeURIComponent(name)}`)
}

export const mihomoRuleProviders = async (): Promise<ControllerRuleProviders> => {
  const instance = await getAxios()
  return await instance.get('/providers/rules')
}

export const mihomoUpdateRuleProviders = async (name: string): Promise<void> => {
  const instance = await getAxios()
  return await instance.put(`/providers/rules/${encodeURIComponent(name)}`)
}

export const mihomoChangeProxy = async (
  group: string,
  proxy: string
): Promise<ControllerProxiesDetail> => {
  const instance = await getAxios()
  return await instance.put(`/proxies/${encodeURIComponent(group)}`, { name: proxy })
}

export const mihomoUnfixedProxy = async (group: string): Promise<ControllerProxiesDetail> => {
  const instance = await getAxios()
  return await instance.delete(`/proxies/${encodeURIComponent(group)}`)
}

export const mihomoProxyDelay = async (
  proxy: string,
  url?: string
): Promise<ControllerProxiesDelay> => {
  const appConfig = await getAppConfig()
  const { delayTestUrl, delayTestTimeout } = appConfig
  const instance = await getAxios()
  return await instance.get(`/proxies/${encodeURIComponent(proxy)}/delay`, {
    params: {
      url: url || delayTestUrl || 'https://www.gstatic.com/generate_204',
      timeout: delayTestTimeout || 5000
    }
  })
}

export const mihomoGroupDelay = async (
  group: string,
  url?: string
): Promise<ControllerGroupDelay> => {
  const appConfig = await getAppConfig()
  const { delayTestUrl, delayTestTimeout } = appConfig
  const instance = await getAxios()
  return await instance.get(`/group/${encodeURIComponent(group)}/delay`, {
    params: {
      url: url || delayTestUrl || 'https://www.gstatic.com/generate_204',
      timeout: delayTestTimeout || 5000
    }
  })
}

export const mihomoRulesDisable = async (rules: Record<string, boolean>): Promise<void> => {
  const instance = await getAxios()
  return await instance.patch(`/rules/disable`, rules)
}

export const mihomoUpgrade = async (channel: string): Promise<void> => {
  if (process.platform === 'win32') await patchMihomoConfig({ 'log-level': 'info' })
  const instance = await getAxios()
  return await instance.post(`/upgrade?channel=${encodeURIComponent(channel)}`)
}

export const mihomoUpgradeGeo = async (): Promise<void> => {
  const instance = await getAxios()
  return await instance.post('/upgrade/geo')
}

export const mihomoUpgradeUI = async (): Promise<void> => {
  const instance = await getAxios()
  return await instance.post('/upgrade/ui')
}

export const startMihomoTraffic = async (): Promise<void> => {
  if (isWebSocketActive(mihomoTrafficWs)) return
  if (trafficReconnectTimer) {
    clearTimeout(trafficReconnectTimer)
    trafficReconnectTimer = null
  }
  await mihomoTraffic()
}

export const stopMihomoTraffic = (): void => {
  trafficRetry = 10
  if (trafficReconnectTimer) {
    clearTimeout(trafficReconnectTimer)
    trafficReconnectTimer = null
  }
  if (mihomoTrafficWs) {
    closeWebSocket(mihomoTrafficWs)
    mihomoTrafficWs = null
  }
}

const mihomoTraffic = async (): Promise<void> => {
  const ws = await mihomoWs('/traffic')
  mihomoTrafficWs = ws

  ws.onmessage = async (e): Promise<void> => {
    const data = e.data as string
    const json = JSON.parse(data) as ControllerTraffic
    trafficRetry = 10
    try {
      mainWindow?.webContents.send('mihomoTraffic', json)
      if (process.platform !== 'linux') {
        tray?.setToolTip(
          '↑' +
            `${calcTraffic(json.up)}/s`.padStart(9) +
            '\n↓' +
            `${calcTraffic(json.down)}/s`.padStart(9)
        )
      }
      floatingWindow?.webContents.send('mihomoTraffic', json)
    } catch {
      // ignore
    }
  }

  ws.onclose = (): void => {
    if (mihomoTrafficWs === ws) {
      mihomoTrafficWs = null
    }
    if (mihomoTrafficWs !== null || !trafficRetry || trafficReconnectTimer) return

    trafficRetry--
    trafficReconnectTimer = setTimeout(() => {
      trafficReconnectTimer = null
      mihomoTraffic().catch(() => {})
    }, wsReconnectDelay)
  }

  ws.onerror = (): void => {
    ws.close()
  }
}

export const startMihomoMemory = async (): Promise<void> => {
  if (isWebSocketActive(mihomoMemoryWs)) return
  if (memoryReconnectTimer) {
    clearTimeout(memoryReconnectTimer)
    memoryReconnectTimer = null
  }
  await mihomoMemory()
}

export const stopMihomoMemory = (): void => {
  memoryRetry = 10
  if (memoryReconnectTimer) {
    clearTimeout(memoryReconnectTimer)
    memoryReconnectTimer = null
  }
  if (mihomoMemoryWs) {
    closeWebSocket(mihomoMemoryWs)
    mihomoMemoryWs = null
  }
}

const mihomoMemory = async (): Promise<void> => {
  const ws = await mihomoWs('/memory')
  mihomoMemoryWs = ws

  ws.onmessage = (e): void => {
    const data = e.data as string
    memoryRetry = 10
    try {
      mainWindow?.webContents.send('mihomoMemory', JSON.parse(data) as ControllerMemory)
    } catch {
      // ignore
    }
  }

  ws.onclose = (): void => {
    if (mihomoMemoryWs === ws) {
      mihomoMemoryWs = null
    }
    if (mihomoMemoryWs !== null || !memoryRetry || memoryReconnectTimer) return

    memoryRetry--
    memoryReconnectTimer = setTimeout(() => {
      memoryReconnectTimer = null
      mihomoMemory().catch(() => {})
    }, wsReconnectDelay)
  }

  ws.onerror = (): void => {
    ws.close()
  }
}

export const startMihomoLogs = async (): Promise<void> => {
  if (isWebSocketActive(mihomoLogsWs)) return
  if (logsReconnectTimer) {
    clearTimeout(logsReconnectTimer)
    logsReconnectTimer = null
  }
  await mihomoLogs()
}

export const stopMihomoLogs = (): void => {
  logsRetry = 10
  if (logsReconnectTimer) {
    clearTimeout(logsReconnectTimer)
    logsReconnectTimer = null
  }
  if (mihomoLogsWs) {
    closeWebSocket(mihomoLogsWs)
    mihomoLogsWs = null
  }
}

export const restartMihomoLogs = async (): Promise<void> => {
  stopMihomoLogs()
  await startMihomoLogs()
}

const mihomoLogs = async (): Promise<void> => {
  const { realtimeLogLevel } = await getAppConfig()
  const { 'log-level': logLevel = 'info' } = await getControledMihomoConfig()
  const activeLogLevel = realtimeLogLevel ?? logLevel

  const ws = await mihomoWs(`/logs?level=${activeLogLevel}`)
  mihomoLogsWs = ws

  ws.onmessage = (e): void => {
    const data = e.data as string
    logsRetry = 10
    try {
      publishMihomoLog(JSON.parse(data) as ControllerLog)
    } catch {
      // ignore
    }
  }

  ws.onclose = (): void => {
    if (mihomoLogsWs === ws) {
      mihomoLogsWs = null
    }
    if (mihomoLogsWs !== null || !logsRetry || logsReconnectTimer) return

    logsRetry--
    logsReconnectTimer = setTimeout(() => {
      logsReconnectTimer = null
      mihomoLogs().catch(() => {})
    }, wsReconnectDelay)
  }

  ws.onerror = (): void => {
    ws.close()
  }
}

export const startMihomoConnections = async (): Promise<void> => {
  if (isWebSocketActive(mihomoConnectionsWs)) return
  if (connectionsReconnectTimer) {
    clearTimeout(connectionsReconnectTimer)
    connectionsReconnectTimer = null
  }
  await mihomoConnections()
}

export const stopMihomoConnections = (): void => {
  connectionsRetry = 10
  if (connectionsReconnectTimer) {
    clearTimeout(connectionsReconnectTimer)
    connectionsReconnectTimer = null
  }
  if (mihomoConnectionsWs) {
    closeWebSocket(mihomoConnectionsWs)
    mihomoConnectionsWs = null
  }
}

export const restartMihomoConnections = async (): Promise<void> => {
  stopMihomoConnections()
  await startMihomoConnections()
}

const mihomoConnections = async (): Promise<void> => {
  const { connectionInterval = 500 } = await getAppConfig()
  const ws = await mihomoWs(`/connections?interval=${connectionInterval}`)
  mihomoConnectionsWs = ws

  ws.onmessage = (e): void => {
    const data = e.data as string
    connectionsRetry = 10
    try {
      mainWindow?.webContents.send('mihomoConnections', JSON.parse(data) as ControllerConnections)
    } catch {
      // ignore
    }
  }

  ws.onclose = (): void => {
    if (mihomoConnectionsWs === ws) {
      mihomoConnectionsWs = null
    }
    if (mihomoConnectionsWs !== null || !connectionsRetry || connectionsReconnectTimer) return

    connectionsRetry--
    connectionsReconnectTimer = setTimeout(() => {
      connectionsReconnectTimer = null
      mihomoConnections().catch(() => {})
    }, wsReconnectDelay)
  }

  ws.onerror = (): void => {
    ws.close()
  }
}
