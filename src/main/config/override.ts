import { overrideConfigPath, overridePath } from '../utils/dirs'
import { getControledMihomoConfig } from './controledMihomo'
import { readFile, writeFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import axios, { AxiosResponse } from 'axios'
import https from 'https'
import http from 'http'
import tls from 'tls'
import { parseYaml, stringifyYaml } from '../utils/yaml'
import { getCertFingerprint } from './profile'

let overrideConfig: OverrideConfig // override.yaml

export async function getOverrideConfig(force = false): Promise<OverrideConfig> {
  if (force || !overrideConfig) {
    const data = await readFile(overrideConfigPath(), 'utf-8')
    overrideConfig = parseYaml<OverrideConfig>(data) || { items: [] }
  }
  if (typeof overrideConfig !== 'object') overrideConfig = { items: [] }
  return overrideConfig
}

export async function setOverrideConfig(config: OverrideConfig): Promise<void> {
  overrideConfig = config
  await writeFile(overrideConfigPath(), stringifyYaml(overrideConfig), 'utf-8')
}

export async function getOverrideItem(id: string | undefined): Promise<OverrideItem | undefined> {
  const { items } = await getOverrideConfig()
  return items.find((item) => item.id === id)
}

export async function updateOverrideItem(item: OverrideItem): Promise<void> {
  const config = await getOverrideConfig()
  const index = config.items.findIndex((i) => i.id === item.id)
  if (index === -1) {
    throw new Error('Override not found')
  }
  config.items[index] = item
  await setOverrideConfig(config)
}

export async function addOverrideItem(item: Partial<OverrideItem>): Promise<void> {
  const config = await getOverrideConfig()
  const newItem = await createOverride(item)
  if (await getOverrideItem(item.id)) {
    updateOverrideItem(newItem)
  } else {
    config.items.push(newItem)
  }
  await setOverrideConfig(config)
}

export async function removeOverrideItem(id: string): Promise<void> {
  const config = await getOverrideConfig()
  const item = await getOverrideItem(id)
  config.items = config.items?.filter((item) => item.id !== id)
  await setOverrideConfig(config)
  await rm(overridePath(id, item?.ext || 'js'))
}

export async function createOverride(item: Partial<OverrideItem>): Promise<OverrideItem> {
  const id = item.id || new Date().getTime().toString(16)
  const newItem = {
    id,
    name: item.name || (item.type === 'remote' ? 'Remote File' : 'Local File'),
    type: item.type,
    ext: item.ext || 'js',
    url: item.url,
    global: item.global || false,
    updated: new Date().getTime()
  } as OverrideItem
  switch (newItem.type) {
    case 'remote': {
      const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
      if (!item.url) throw new Error('Empty URL')
      let res: AxiosResponse
      try {
        const httpsAgent = new https.Agent({ rejectUnauthorized: !item.fingerprint })

        if (item.fingerprint) {
          const expected = item.fingerprint.replace(/:/g, '').toUpperCase()
          const verify = (s: tls.TLSSocket) => {
            if (getCertFingerprint(s.getPeerCertificate()) !== expected)
              s.destroy(new Error('证书指纹不匹配'))
          }

          if (mixedPort != 0) {
            const urlObj = new URL(item.url)
            const hostname = urlObj.hostname
            const port = urlObj.port || '443'
            httpsAgent.createConnection = (_, cb) => {
              const req = http.request({
                host: '127.0.0.1',
                port: mixedPort,
                method: 'CONNECT',
                path: `${hostname}:${port}`
              })

              req.on('connect', (res, sock, head) => {
                if (res.statusCode !== 200) {
                  cb?.(new Error(`代理连接失败，状态码：${res.statusCode}`), null!)
                  return
                }
                if (head.length > 0) sock.unshift(head)
                const tls$ = tls.connect(
                  { socket: sock, servername: hostname, rejectUnauthorized: false },
                  () => verify(tls$)
                )
                cb?.(null, tls$)
              })

              req.on('error', (e) => cb?.(e, null!))
              req.end()
              return null!
            }
          } else {
            const conn = httpsAgent.createConnection.bind(httpsAgent)
            httpsAgent.createConnection = (o, c) => {
              const sock = conn(o, c)
              sock?.once('secureConnect', function (this: tls.TLSSocket) {
                verify(this)
              })
              return sock
            }
          }
        }

        res = await axios.get(item.url, {
          httpsAgent,
          ...(mixedPort != 0 &&
            !item.fingerprint && {
              proxy: { protocol: 'http', host: '127.0.0.1', port: mixedPort }
            }),
          responseType: 'text'
        })
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED') {
            throw new Error(`网络连接被重置或超时：${item.url}`)
          } else if (error.code === 'CERT_HAS_EXPIRED') {
            throw new Error(`服务器证书已过期：${item.url}`)
          } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
            throw new Error(`无法验证服务器证书：${item.url}`)
          } else if (error.message.includes('Certificate verification failed')) {
            throw new Error(`证书验证失败：${item.url}`)
          } else {
            throw new Error(`请求失败：${error.message}`)
          }
        }
        throw error
      }

      const data = res.data
      await setOverride(id, newItem.ext, data)
      break
    }
    case 'local': {
      const data = item.file || ''
      setOverride(id, newItem.ext, data)
      break
    }
  }

  return newItem
}

export async function getOverride(id: string, ext: 'js' | 'yaml' | 'log'): Promise<string> {
  if (!existsSync(overridePath(id, ext))) {
    return ''
  }
  return await readFile(overridePath(id, ext), 'utf-8')
}

export async function setOverride(id: string, ext: 'js' | 'yaml', content: string): Promise<void> {
  await writeFile(overridePath(id, ext), content, 'utf-8')
}
