import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import crypto from 'crypto'
import WebSocket from 'ws'
import { KeyManager } from './key'
import { serviceIpcPath } from '../utils/dirs'
import { appendAppLog } from '../utils/log'

let serviceAxios: AxiosInstance | null = null
let keyManager: KeyManager | null = null
let serviceUnavailableFallbackHandler: ((reason: unknown) => Promise<void>) | null = null
let serviceUnavailableFallbackTimer: NodeJS.Timeout | null = null
let serviceUnavailableFallbackPromise: Promise<void> | null = null
const serviceUnavailableFallbackDelay = 12000

export class ServiceAPIError extends Error {
  status?: number
  responseData?: unknown

  constructor(message: string, options?: { status?: number; responseData?: unknown }) {
    super(message)
    this.name = 'ServiceAPIError'
    this.status = options?.status
    this.responseData = options?.responseData
  }
}

function getHeaderValue(config: AxiosRequestConfig, name: string): string {
  const headers = config.headers as
    | Record<string, unknown>
    | { get?: (headerName: string) => string | undefined | null }
    | undefined

  if (!headers) {
    return ''
  }

  if ('get' in headers && typeof headers.get === 'function') {
    return String(headers.get(name) || headers.get(name.toLowerCase()) || '')
  }

  return String(headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '')
}

function shouldUseJsonEncoding(config: AxiosRequestConfig): boolean {
  const contentType = getHeaderValue(config, 'Content-Type').toLowerCase()
  return contentType === '' || contentType.includes('application/json')
}

function getRequestBodyBytes(config: AxiosRequestConfig): Buffer {
  const data = config.data

  if (data == null) {
    return Buffer.alloc(0)
  }

  if (Buffer.isBuffer(data)) {
    return data
  }

  if (data instanceof Uint8Array) {
    return Buffer.from(data)
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data)
  }

  if (typeof data === 'string') {
    return Buffer.from(shouldUseJsonEncoding(config) ? JSON.stringify(data) : data)
  }

  if (data instanceof URLSearchParams) {
    return Buffer.from(data.toString())
  }

  if (typeof data === 'object') {
    return Buffer.from(JSON.stringify(data))
  }

  return Buffer.from(String(data))
}

function canonicalizeQuery(urlObj: URL): string {
  const source = new URLSearchParams(urlObj.search)
  const keys = Array.from(new Set(source.keys())).sort()
  const target = new URLSearchParams()

  for (const key of keys) {
    const values = source.getAll(key).sort()
    for (const value of values) {
      target.append(key, value)
    }
  }

  return target.toString()
}

function resolveRequestUrl(instance: AxiosInstance, config: AxiosRequestConfig): URL {
  return new URL(instance.getUri(config))
}

function buildCanonicalRequest(
  instance: AxiosInstance,
  config: AxiosRequestConfig,
  timestamp: string,
  nonce: string,
  keyId: string,
  bodyHash: string
): string {
  const resolvedUrl = resolveRequestUrl(instance, config)
  const path = resolvedUrl.pathname || '/'
  const query = canonicalizeQuery(resolvedUrl)

  return [
    'SPARKLE-AUTH-V2',
    timestamp,
    nonce,
    keyId,
    (config.method || 'GET').toUpperCase(),
    path,
    query,
    bodyHash
  ].join('\n')
}

function signServiceRequest(
  instance: AxiosInstance,
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  if (keyManager?.isInitialized()) {
    const bodyBytes = getRequestBodyBytes(config)
    const bodyHash = crypto.createHash('sha256').update(bodyBytes).digest('hex')
    const timestamp = Date.now().toString()
    const nonce = crypto.randomBytes(16).toString('base64url')
    const keyId = keyManager.getKeyID()
    const canonical = buildCanonicalRequest(instance, config, timestamp, nonce, keyId, bodyHash)
    const signature = keyManager.signData(canonical)

    config.headers['X-Auth-Version'] = '2'
    config.headers['X-Key-Id'] = keyId
    config.headers['X-Nonce'] = nonce
    config.headers['X-Content-SHA256'] = bodyHash
    config.headers['X-Timestamp'] = timestamp
    config.headers['X-Signature'] = signature
  }

  return config
}

function attachServiceAuth(instance: AxiosInstance): void {
  instance.interceptors.request.use((config) => signServiceRequest(instance, config))
}

export function setServiceUnavailableFallbackHandler(
  handler: (reason: unknown) => Promise<void>
): void {
  serviceUnavailableFallbackHandler = handler
}

export function isServiceConnectionError(error: unknown): boolean {
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

function scheduleServiceUnavailableFallback(reason: unknown): void {
  if (serviceUnavailableFallbackTimer || serviceUnavailableFallbackPromise) return

  serviceUnavailableFallbackTimer = setTimeout(() => {
    serviceUnavailableFallbackTimer = null
    serviceUnavailableFallbackPromise = runServiceUnavailableFallback(reason).finally(() => {
      serviceUnavailableFallbackPromise = null
    })
  }, serviceUnavailableFallbackDelay)
}

async function runServiceUnavailableFallback(reason: unknown): Promise<void> {
  if (await isServiceReachable()) return

  if (!serviceUnavailableFallbackHandler) {
    await appendAppLog(`[Service]: service unavailable fallback handler is not registered\n`)
    return
  }

  await serviceUnavailableFallbackHandler(reason).catch((error) =>
    appendAppLog(`[Service]: service unavailable fallback failed, ${error}\n`)
  )
}

async function isServiceReachable(): Promise<boolean> {
  try {
    await axios.get('/ping', {
      baseURL: 'http://localhost',
      socketPath: serviceIpcPath(),
      timeout: 1000,
      validateStatus: () => true
    })
    return true
  } catch {
    return false
  }
}

function getResponseErrorMessage(responseData: unknown, fallback: string): string {
  if (responseData && typeof responseData === 'object') {
    const data = responseData as Record<string, unknown>
    return String(data.message || data.error || fallback)
  }

  return fallback
}

function createServiceAPIError(error: unknown): unknown {
  const serviceError = error as {
    response?: { data?: unknown; status?: number }
    message?: string
  }

  if (serviceError.response?.data) {
    const message = getResponseErrorMessage(
      serviceError.response.data,
      serviceError.message || '请求失败'
    )

    return new ServiceAPIError(message, {
      status: serviceError.response.status,
      responseData: serviceError.response.data
    })
  }

  if (error instanceof Error) {
    return new ServiceAPIError(error.message)
  }

  return error
}

function handleServiceAxiosError(error: unknown): Promise<never> {
  if (isServiceConnectionError(error)) {
    scheduleServiceUnavailableFallback(error)
  }

  return Promise.reject(createServiceAPIError(error))
}

export const initServiceAPI = (km: KeyManager): void => {
  keyManager = km

  serviceAxios = axios.create({
    baseURL: 'http://localhost',
    socketPath: serviceIpcPath(),
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json'
    }
  })

  attachServiceAuth(serviceAxios)

  serviceAxios.interceptors.response.use(
    (response) => response.data,
    handleServiceAxiosError
  )
}

export const createSignedServiceAxios = (baseURL = 'http://localhost'): AxiosInstance => {
  const instance = axios.create({
    baseURL,
    socketPath: serviceIpcPath(),
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json'
    }
  })

  attachServiceAuth(instance)

  instance.interceptors.response.use(
    (response) => response.data,
    handleServiceAxiosError
  )

  return instance
}

export const getServiceAuthHeaders = (
  method: string,
  pathWithQuery: string,
  body: Buffer = Buffer.alloc(0)
): Record<string, string> => {
  if (!keyManager?.isInitialized()) {
    throw new Error('服务 API 未初始化')
  }

  const bodyHash = crypto.createHash('sha256').update(body).digest('hex')
  const timestamp = Date.now().toString()
  const nonce = crypto.randomBytes(16).toString('base64url')
  const keyId = keyManager.getKeyID()
  const urlObj = new URL(pathWithQuery, 'http://localhost')
  const canonical = [
    'SPARKLE-AUTH-V2',
    timestamp,
    nonce,
    keyId,
    method.toUpperCase(),
    urlObj.pathname || '/',
    canonicalizeQuery(urlObj),
    bodyHash
  ].join('\n')
  const signature = keyManager.signData(canonical)

  return {
    'X-Auth-Version': '2',
    'X-Key-Id': keyId,
    'X-Nonce': nonce,
    'X-Content-SHA256': bodyHash,
    'X-Timestamp': timestamp,
    'X-Signature': signature
  }
}

export const getServiceAxios = (): AxiosInstance => {
  if (!serviceAxios) {
    throw new Error('服务 API 未初始化')
  }
  return serviceAxios
}

export const getKeyManager = (): KeyManager => {
  if (!keyManager) {
    throw new Error('密钥管理器未初始化')
  }
  return keyManager
}

export const ping = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.get('/ping')
}

export const test = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.get('/test')
}

export const getCoreStatus = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.get('/core')
}

export interface ServiceCoreLaunchProfile {
  core_path?: string
  args?: string[]
  safe_paths?: string[]
  env?: Record<string, string | undefined>
  mihomo_cpu_priority?: Priority
  log_path?: string
  save_logs?: boolean
  max_log_file_size_mb?: number
}

export type ServiceCoreEventType =
  | 'starting'
  | 'started'
  | 'stopping'
  | 'stopped'
  | 'exited'
  | 'restarting'
  | 'restart_failed'
  | 'takeover'
  | 'ready'
  | 'failed'

export interface ServiceCoreEvent {
  seq?: number
  type: ServiceCoreEventType
  time: string
  running: boolean
  pid?: number
  old_pid?: number
  message?: string
  error?: string
}

export type ServiceSysproxyEventType =
  | 'guard_started'
  | 'guard_stopped'
  | 'guard_changed'
  | 'guard_restored'
  | 'guard_restore_failed'
  | 'guard_check_failed'
  | 'guard_watch_failed'

export interface ServiceSysproxyEvent {
  seq?: number
  type: ServiceSysproxyEventType
  time: string
  guard: boolean
  mode?: string
  message?: string
  error?: string
}

export const createServiceWebSocket = (pathWithQuery: string): WebSocket => {
  return new WebSocket(`ws+unix:${serviceIpcPath()}:${pathWithQuery}`, {
    headers: getServiceAuthHeaders('GET', pathWithQuery)
  })
}

export const createCoreEventsWebSocket = (): WebSocket => {
  return createServiceWebSocket('/core/events')
}

export const createSysproxyEventsWebSocket = (): WebSocket => {
  return createServiceWebSocket('/sysproxy/events')
}

type ServiceCoreEventHandler = (event: ServiceCoreEvent) => void | Promise<void>
type ServiceCoreEventStreamState = 'connected' | 'disconnected'
type ServiceCoreEventStreamHandler = (state: ServiceCoreEventStreamState) => void | Promise<void>
type ServiceSysproxyEventHandler = (event: ServiceSysproxyEvent) => void | Promise<void>

let serviceCoreEventsWs: WebSocket | null = null
let serviceCoreEventsManualClose = false
let serviceCoreEventsReconnectTimer: NodeJS.Timeout | null = null
const serviceCoreEventHandlers = new Set<ServiceCoreEventHandler>()
const serviceCoreEventStreamHandlers = new Set<ServiceCoreEventStreamHandler>()

let serviceSysproxyEventsWs: WebSocket | null = null
let serviceSysproxyEventsManualClose = true
let serviceSysproxyEventsReconnectTimer: NodeJS.Timeout | null = null
const serviceSysproxyEventHandlers = new Set<ServiceSysproxyEventHandler>()

export function subscribeServiceCoreEvents(handler: ServiceCoreEventHandler): () => void {
  serviceCoreEventHandlers.add(handler)
  return () => {
    serviceCoreEventHandlers.delete(handler)
  }
}

export function subscribeServiceCoreEventStream(
  handler: ServiceCoreEventStreamHandler
): () => void {
  serviceCoreEventStreamHandlers.add(handler)
  return () => {
    serviceCoreEventStreamHandlers.delete(handler)
  }
}

export function subscribeServiceSysproxyEvents(handler: ServiceSysproxyEventHandler): () => void {
  serviceSysproxyEventHandlers.add(handler)
  return () => {
    serviceSysproxyEventHandlers.delete(handler)
  }
}

export async function startServiceCoreEventStream(): Promise<void> {
  serviceCoreEventsManualClose = false
  if (
    serviceCoreEventsWs &&
    (serviceCoreEventsWs.readyState === WebSocket.OPEN ||
      serviceCoreEventsWs.readyState === WebSocket.CONNECTING)
  ) {
    return
  }

  if (serviceCoreEventsReconnectTimer) {
    clearTimeout(serviceCoreEventsReconnectTimer)
    serviceCoreEventsReconnectTimer = null
  }

  let ws: WebSocket
  try {
    ws = createCoreEventsWebSocket()
  } catch (error) {
    await appendAppLog(`[Service]: create core events ws failed, ${error}\n`)
    scheduleServiceUnavailableFallback(error)
    scheduleServiceCoreEventReconnect()
    return
  }

  serviceCoreEventsWs = ws
  ws.on('open', () => {
    dispatchServiceCoreEventStreamState('connected').catch((error) => {
      appendAppLog(`[Service]: handle core event stream state failed, ${error}\n`).catch(() => {})
    })
  })
  ws.on('message', (data) => {
    dispatchServiceCoreEvent(data).catch((error) => {
      appendAppLog(`[Service]: handle core event failed, ${error}\n`).catch(() => {})
    })
  })
  ws.on('close', () => {
    if (serviceCoreEventsWs === ws) {
      serviceCoreEventsWs = null
    }
    dispatchServiceCoreEventStreamState('disconnected').catch((error) => {
      appendAppLog(`[Service]: handle core event stream state failed, ${error}\n`).catch(() => {})
    })
    if (!serviceCoreEventsManualClose) {
      scheduleServiceUnavailableFallback(new Error('core events websocket disconnected'))
      scheduleServiceCoreEventReconnect()
    }
  })
  ws.on('error', (error) => {
    appendAppLog(`[Service]: core events ws error, ${error}\n`).catch(() => {})
    if (!serviceCoreEventsManualClose) {
      scheduleServiceUnavailableFallback(error)
    }
  })

  await waitForServiceCoreEventsSocket(ws)
}

export function stopServiceCoreEventStream(): void {
  serviceCoreEventsManualClose = true
  if (serviceCoreEventsReconnectTimer) {
    clearTimeout(serviceCoreEventsReconnectTimer)
    serviceCoreEventsReconnectTimer = null
  }
  if (serviceCoreEventsWs) {
    serviceCoreEventsWs.removeAllListeners()
    serviceCoreEventsWs.close()
    serviceCoreEventsWs = null
  }
}

export async function startServiceSysproxyEventStream(): Promise<void> {
  serviceSysproxyEventsManualClose = false
  if (
    serviceSysproxyEventsWs &&
    (serviceSysproxyEventsWs.readyState === WebSocket.OPEN ||
      serviceSysproxyEventsWs.readyState === WebSocket.CONNECTING)
  ) {
    return
  }

  if (serviceSysproxyEventsReconnectTimer) {
    clearTimeout(serviceSysproxyEventsReconnectTimer)
    serviceSysproxyEventsReconnectTimer = null
  }

  let ws: WebSocket
  try {
    ws = createSysproxyEventsWebSocket()
  } catch (error) {
    await appendAppLog(`[Service]: create sysproxy events ws failed, ${error}\n`)
    scheduleServiceUnavailableFallback(error)
    scheduleServiceSysproxyEventReconnect()
    return
  }

  serviceSysproxyEventsWs = ws
  ws.on('message', (data) => {
    dispatchServiceSysproxyEvent(data).catch((error) => {
      appendAppLog(`[Service]: handle sysproxy event failed, ${error}\n`).catch(() => {})
    })
  })
  ws.on('close', () => {
    if (serviceSysproxyEventsWs === ws) {
      serviceSysproxyEventsWs = null
    }
    if (!serviceSysproxyEventsManualClose) {
      scheduleServiceUnavailableFallback(new Error('sysproxy events websocket disconnected'))
      scheduleServiceSysproxyEventReconnect()
    }
  })
  ws.on('error', (error) => {
    appendAppLog(`[Service]: sysproxy events ws error, ${error}\n`).catch(() => {})
    if (!serviceSysproxyEventsManualClose) {
      scheduleServiceUnavailableFallback(error)
    }
  })

  await waitForServiceSysproxyEventsSocket(ws)
}

export function stopServiceSysproxyEventStream(): void {
  serviceSysproxyEventsManualClose = true
  if (serviceSysproxyEventsReconnectTimer) {
    clearTimeout(serviceSysproxyEventsReconnectTimer)
    serviceSysproxyEventsReconnectTimer = null
  }
  if (serviceSysproxyEventsWs) {
    serviceSysproxyEventsWs.removeAllListeners()
    serviceSysproxyEventsWs.close()
    serviceSysproxyEventsWs = null
  }
}

function scheduleServiceCoreEventReconnect(): void {
  if (serviceCoreEventsManualClose || serviceCoreEventsReconnectTimer) return
  serviceCoreEventsReconnectTimer = setTimeout(() => {
    serviceCoreEventsReconnectTimer = null
    startServiceCoreEventStream().catch((error) => {
      appendAppLog(`[Service]: reconnect core events ws failed, ${error}\n`).catch(() => {})
    })
  }, 1000)
}

function scheduleServiceSysproxyEventReconnect(): void {
  if (serviceSysproxyEventsManualClose || serviceSysproxyEventsReconnectTimer) return
  serviceSysproxyEventsReconnectTimer = setTimeout(() => {
    serviceSysproxyEventsReconnectTimer = null
    startServiceSysproxyEventStream().catch((error) => {
      appendAppLog(`[Service]: reconnect sysproxy events ws failed, ${error}\n`).catch(() => {})
    })
  }, 1000)
}

async function waitForServiceCoreEventsSocket(ws: WebSocket): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false
    const complete = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      ws.off('open', complete)
      ws.off('error', complete)
      resolve()
    }
    const timer = setTimeout(complete, 1500)
    ws.once('open', complete)
    ws.once('error', complete)
  })
}

async function waitForServiceSysproxyEventsSocket(ws: WebSocket): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false
    const complete = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      ws.off('open', complete)
      ws.off('error', complete)
      resolve()
    }
    const timer = setTimeout(complete, 1500)
    ws.once('open', complete)
    ws.once('error', complete)
  })
}

async function dispatchServiceCoreEvent(data: WebSocket.RawData): Promise<void> {
  const raw = Buffer.isBuffer(data) ? data.toString('utf8') : data.toString()
  const event = JSON.parse(raw) as ServiceCoreEvent
  for (const handler of serviceCoreEventHandlers) {
    await Promise.resolve(handler(event)).catch((error) => {
      appendAppLog(`[Service]: core event handler failed, ${error}\n`).catch(() => {})
    })
  }
}

async function dispatchServiceSysproxyEvent(data: WebSocket.RawData): Promise<void> {
  const raw = Buffer.isBuffer(data) ? data.toString('utf8') : data.toString()
  const event = JSON.parse(raw) as ServiceSysproxyEvent
  for (const handler of serviceSysproxyEventHandlers) {
    await Promise.resolve(handler(event)).catch((error) => {
      appendAppLog(`[Service]: sysproxy event handler failed, ${error}\n`).catch(() => {})
    })
  }
}

async function dispatchServiceCoreEventStreamState(
  state: ServiceCoreEventStreamState
): Promise<void> {
  for (const handler of serviceCoreEventStreamHandlers) {
    await Promise.resolve(handler(state)).catch((error) => {
      appendAppLog(`[Service]: core event stream state handler failed, ${error}\n`).catch(() => {})
    })
  }
}

export const startCore = async (
  profile?: ServiceCoreLaunchProfile
): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.post('/core/start', profile)
}

export const stopCore = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.post('/core/stop')
}

export const restartCore = async (
  profile?: ServiceCoreLaunchProfile
): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.post('/core/restart', profile)
}

export const patchCoreProfile = async (
  profile: Partial<ServiceCoreLaunchProfile>
): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.patch('/core/profile', profile)
}

export const getProxyStatus = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.get('/sysproxy/status')
}

export const stopServiceApi = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.post('/service/stop')
}

export const restartServiceApi = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.post('/service/restart')
}

export const setPac = async (
  url: string,
  device?: string,
  onlyActiveDevice?: boolean,
  useRegistry?: boolean,
  guard?: boolean
): Promise<void> => {
  const instance = getServiceAxios()
  return await instance.post('/sysproxy/pac', {
    url,
    device,
    only_active_device: onlyActiveDevice,
    use_registry: useRegistry,
    guard
  })
}

export const setProxy = async (
  server: string,
  bypass?: string,
  device?: string,
  onlyActiveDevice?: boolean,
  useRegistry?: boolean,
  guard?: boolean
): Promise<void> => {
  const instance = getServiceAxios()
  return await instance.post('/sysproxy/proxy', {
    server,
    bypass,
    device,
    only_active_device: onlyActiveDevice,
    use_registry: useRegistry,
    guard
  })
}

export const disableProxy = async (
  device?: string,
  onlyActiveDevice?: boolean,
  useRegistry?: boolean
): Promise<void> => {
  const instance = getServiceAxios()
  return await instance.post('/sysproxy/disable', {
    device,
    only_active_device: onlyActiveDevice,
    use_registry: useRegistry
  })
}

export const setSysDns = async (device?: string, servers?: string[]): Promise<void> => {
  const instance = getServiceAxios()
  return await instance.post('/sys/dns/set', { servers, device })
}
