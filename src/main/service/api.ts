import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import crypto from 'crypto'
import { KeyManager } from './key'
import { serviceIpcPath } from '../utils/dirs'

let serviceAxios: AxiosInstance | null = null
let keyManager: KeyManager | null = null

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

function resolveRequestUrl(config: AxiosRequestConfig): URL {
  if (!serviceAxios) {
    throw new Error('服务 API 未初始化')
  }

  return new URL(serviceAxios.getUri(config))
}

function buildCanonicalRequest(
  config: AxiosRequestConfig,
  timestamp: string,
  nonce: string,
  keyId: string,
  bodyHash: string
): string {
  const resolvedUrl = resolveRequestUrl(config)
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

  serviceAxios.interceptors.request.use((config) => {
    if (keyManager?.isInitialized()) {
      const bodyBytes = getRequestBodyBytes(config)
      const bodyHash = crypto.createHash('sha256').update(bodyBytes).digest('hex')
      const timestamp = Date.now().toString()
      const nonce = crypto.randomBytes(16).toString('base64url')
      const keyId = keyManager.getKeyID()
      const canonical = buildCanonicalRequest(config, timestamp, nonce, keyId, bodyHash)
      const signature = keyManager.signData(canonical)

      config.headers['X-Auth-Version'] = '2'
      config.headers['X-Key-Id'] = keyId
      config.headers['X-Nonce'] = nonce
      config.headers['X-Content-SHA256'] = bodyHash

      config.headers['X-Timestamp'] = timestamp
      config.headers['X-Signature'] = signature
    }

    return config
  })

  serviceAxios.interceptors.response.use(
    (response) => response.data,
    (error) => {
      if (error.response?.data) {
        const message =
          error.response.data?.message || error.response.data?.error || error.message || '请求失败'
        return Promise.reject(
          new ServiceAPIError(String(message), {
            status: error.response.status,
            responseData: error.response.data
          })
        )
      }
      if (error instanceof Error) {
        return Promise.reject(new ServiceAPIError(error.message))
      }
      return Promise.reject(error)
    }
  )
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

export const startCore = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.post('/core/start')
}

export const stopCore = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.post('/core/stop')
}

export const restartCore = async (): Promise<Record<string, unknown>> => {
  const instance = getServiceAxios()
  return await instance.post('/core/restart')
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
  useRegistry?: boolean
): Promise<void> => {
  const instance = getServiceAxios()
  return await instance.post('/sysproxy/pac', {
    url,
    device,
    only_active_device: onlyActiveDevice,
    use_registry: useRegistry
  })
}

export const setProxy = async (
  server: string,
  bypass?: string,
  device?: string,
  onlyActiveDevice?: boolean,
  useRegistry?: boolean
): Promise<void> => {
  const instance = getServiceAxios()
  return await instance.post('/sysproxy/proxy', {
    server,
    bypass,
    device,
    only_active_device: onlyActiveDevice,
    use_registry: useRegistry
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
