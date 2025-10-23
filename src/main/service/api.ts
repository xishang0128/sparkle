import axios, { AxiosInstance } from 'axios'
import { KeyManager } from './key'
import { serviceIpcPath } from '../utils/dirs'

let serviceAxios: AxiosInstance | null = null
let keyManager: KeyManager | null = null

export const initServiceAPI = (km: KeyManager): void => {
  keyManager = km

  serviceAxios = axios.create({
    baseURL: 'http://localhost',
    socketPath: serviceIpcPath(),
    timeout: 15000
  })

  serviceAxios.interceptors.request.use((config) => {
    if (keyManager?.isInitialized()) {
      const timestamp = Date.now().toString()
      const signature = keyManager.signData(timestamp)

      config.headers['X-Timestamp'] = timestamp
      config.headers['X-Signature'] = signature
    }

    return config
  })

  serviceAxios.interceptors.response.use(
    (response) => response.data,
    (error) => {
      if (error.response?.data) {
        return Promise.reject(error.response.data)
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

export const setPac = async (url: string, device?: string, onlyActiveDevice?: boolean): Promise<void> => {
  const instance = getServiceAxios()
  return await instance.post('/sysproxy/pac', { url, device, only_active_device: onlyActiveDevice })
}

export const setProxy = async (
  server: string,
  bypass?: string,
  device?: string,
  onlyActiveDevice?: boolean
): Promise<void> => {
  const instance = getServiceAxios()
  return await instance.post('/sysproxy/proxy', {
    server,
    bypass,
    device,
    only_active_device: onlyActiveDevice
  })
}

export const disableProxy = async (device?: string, onlyActiveDevice?: boolean): Promise<void> => {
  const instance = getServiceAxios()
  return await instance.post('/sysproxy/disable', { device, only_active_device: onlyActiveDevice })
}

