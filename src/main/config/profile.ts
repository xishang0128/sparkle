import { getControledMihomoConfig } from './controledMihomo'
import { mihomoProfileWorkDir, mihomoWorkDir, profileConfigPath, profilePath } from '../utils/dirs'
import { addProfileUpdater, delProfileUpdater } from '../core/profileUpdater'
import { readFile, writeFile, rm, mkdir } from 'fs/promises'
import { restartCore } from '../core/manager'
import { getAppConfig } from './app'
import { existsSync } from 'fs'
import axios, { AxiosResponse } from 'axios'
import https from 'https'
import tls from 'tls'
import crypto from 'crypto'
import { parseYaml, stringifyYaml } from '../utils/yaml'
import { defaultProfile } from '../utils/template'
import { subStorePort } from '../resolve/server'
import { dirname, join } from 'path'
import { deepMerge } from '../utils/merge'
import { getUserAgent } from '../utils/userAgent'

let profileConfig: ProfileConfig // profile.yaml

export function getCertFingerprint(cert: tls.PeerCertificate) {
  return crypto.createHash('sha256').update(cert.raw).digest('hex').toUpperCase()
}

export async function getProfileConfig(force = false): Promise<ProfileConfig> {
  if (force || !profileConfig) {
    const data = await readFile(profileConfigPath(), 'utf-8')
    profileConfig = parseYaml(data) || { items: [] }
  }
  if (typeof profileConfig !== 'object') profileConfig = { items: [] }
  return profileConfig
}

export async function setProfileConfig(config: ProfileConfig): Promise<void> {
  profileConfig = config
  await writeFile(profileConfigPath(), stringifyYaml(config), 'utf-8')
}

export async function getProfileItem(id: string | undefined): Promise<ProfileItem | undefined> {
  const { items } = await getProfileConfig()
  if (!id || id === 'default') return { id: 'default', type: 'local', name: '空白订阅' }
  return items.find((item) => item.id === id)
}

export async function changeCurrentProfile(id: string): Promise<void> {
  const config = await getProfileConfig()
  const current = config.current
  config.current = id
  await setProfileConfig(config)
  try {
    await restartCore()
  } catch (e) {
    config.current = current
    throw e
  } finally {
    await setProfileConfig(config)
  }
}

export async function updateProfileItem(item: ProfileItem): Promise<void> {
  const config = await getProfileConfig()
  const index = config.items.findIndex((i) => i.id === item.id)
  if (index === -1) {
    throw new Error('Profile not found')
  }
  config.items[index] = item
  await setProfileConfig(config)
}

export async function addProfileItem(item: Partial<ProfileItem>): Promise<void> {
  const newItem = await createProfile(item)
  const config = await getProfileConfig()
  if (await getProfileItem(newItem.id)) {
    await updateProfileItem(newItem)
  } else {
    config.items.push(newItem)
  }
  await setProfileConfig(config)

  if (!config.current) {
    await changeCurrentProfile(newItem.id)
  }
  await addProfileUpdater(newItem)
}

export async function removeProfileItem(id: string): Promise<void> {
  const config = await getProfileConfig()
  config.items = config.items?.filter((item) => item.id !== id)
  let shouldRestart = false
  if (config.current === id) {
    shouldRestart = true
    if (config.items.length > 0) {
      config.current = config.items[0].id
    } else {
      config.current = undefined
    }
  }
  await setProfileConfig(config)
  if (existsSync(profilePath(id))) {
    await rm(profilePath(id))
  }
  if (shouldRestart) {
    await restartCore()
  }
  if (existsSync(mihomoProfileWorkDir(id))) {
    await rm(mihomoProfileWorkDir(id), { recursive: true })
  }
  await delProfileUpdater(id)
}

export async function getCurrentProfileItem(): Promise<ProfileItem> {
  const { current } = await getProfileConfig()
  return (await getProfileItem(current)) || { id: 'default', type: 'local', name: '空白订阅' }
}

export async function createProfile(item: Partial<ProfileItem>): Promise<ProfileItem> {
  const id = item.id || new Date().getTime().toString(16)
  const newItem = {
    id,
    name: item.name || (item.type === 'remote' ? 'Remote File' : 'Local File'),
    type: item.type,
    url: item.url,
    fingerprint: item.fingerprint,
    substore: item.substore || false,
    interval: item.interval || 0,
    override: item.override || [],
    useProxy: item.useProxy || false,
    updated: new Date().getTime()
  } as ProfileItem
  switch (newItem.type) {
    case 'remote': {
      const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
      if (!item.url) throw new Error('Empty URL')
      let res: AxiosResponse
      if (newItem.substore) {
        const urlObj = new URL(`http://127.0.0.1:${subStorePort}${item.url}`)
        urlObj.searchParams.set('target', 'ClashMeta')
        urlObj.searchParams.set('noCache', 'true')
        if (newItem.useProxy && mixedPort != 0) {
          urlObj.searchParams.set('proxy', `http://127.0.0.1:${mixedPort}`)
        } else {
          urlObj.searchParams.delete('proxy')
        }
        res = await axios.get(urlObj.toString(), {
          headers: {
            'User-Agent': await getUserAgent()
          },
          responseType: 'text'
        })
      } else {
        try {
          res = await axios.get(item.url, {
            httpsAgent: new https.Agent({
              checkServerIdentity: (hostname, cert) => {
                if (item.fingerprint) {
                  const fingerprint = getCertFingerprint(cert)
                  if (fingerprint !== item.fingerprint.replace(/:/g, '').toUpperCase()) {
                    return new Error(`Certificate verification failed for ${hostname}`)
                  }
                  return undefined
                }

                return tls.checkServerIdentity(hostname, cert)
              }
            }),
            ...(newItem.useProxy &&
              mixedPort != 0 && {
                proxy: {
                  protocol: 'http',
                  host: '127.0.0.1',
                  port: mixedPort
                }
              }),
            headers: {
              'User-Agent': await getUserAgent()
            },
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
      }

      const data = res.data
      const headers = res.headers
      if (headers['content-disposition'] && newItem.name === 'Remote File') {
        newItem.name = parseFilename(headers['content-disposition'])
      }
      if (headers['profile-web-page-url']) {
        newItem.home = headers['profile-web-page-url']
      }
      if (headers['profile-update-interval']) {
        newItem.interval = parseInt(headers['profile-update-interval']) * 60
        if (newItem.interval) {
          newItem.locked = true
        }
      }
      if (headers['subscription-userinfo']) {
        newItem.extra = parseSubinfo(headers['subscription-userinfo'])
      }
      await setProfileStr(id, data)
      break
    }
    case 'local': {
      const data = item.file || ''
      await setProfileStr(id, data)
      break
    }
  }
  return newItem
}

export async function getProfileStr(id: string | undefined): Promise<string> {
  if (existsSync(profilePath(id || 'default'))) {
    return await readFile(profilePath(id || 'default'), 'utf-8')
  } else {
    return stringifyYaml(defaultProfile)
  }
}

export async function getProfileParseStr(id: string | undefined): Promise<string> {
  let data: string
  if (existsSync(profilePath(id || 'default'))) {
    data = await readFile(profilePath(id || 'default'), 'utf-8')
  } else {
    data = stringifyYaml(defaultProfile)
  }
  const profile = deepMerge(parseYaml<object>(data), {})
  return stringifyYaml(profile)
}

export async function setProfileStr(id: string, content: string): Promise<void> {
  const { current } = await getProfileConfig()
  await writeFile(profilePath(id), content, 'utf-8')
  if (current === id) await restartCore()
}

export async function getProfile(id: string | undefined): Promise<MihomoConfig> {
  const profile = await getProfileStr(id)
  let result = parseYaml<MihomoConfig>(profile)
  if (typeof result !== 'object') result = {} as MihomoConfig
  return result
}

// attachment;filename=xxx.yaml; filename*=UTF-8''%xx%xx%xx
function parseFilename(str: string): string {
  if (str.match(/filename\*=.*''/)) {
    const filename = decodeURIComponent(str.split(/filename\*=.*''/)[1])
    return filename
  } else {
    const filename = str.split('filename=')[1]
    return filename
  }
}

// subscription-userinfo: upload=1234; download=2234; total=1024000; expire=2218532293
function parseSubinfo(str: string): SubscriptionUserInfo {
  const parts = str.split(';')
  const obj = {} as SubscriptionUserInfo
  parts.forEach((part) => {
    const [key, value] = part.trim().split('=')
    obj[key] = parseInt(value)
  })
  return obj
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[a-zA-Z]:\\/.test(path)
}

export async function getFileStr(path: string): Promise<string> {
  const { diffWorkDir = false } = await getAppConfig()
  const { current } = await getProfileConfig()
  if (isAbsolutePath(path)) {
    return await readFile(path, 'utf-8')
  } else {
    return await readFile(
      join(diffWorkDir ? mihomoProfileWorkDir(current) : mihomoWorkDir(), path),
      'utf-8'
    )
  }
}

export async function setFileStr(path: string, content: string): Promise<void> {
  const { diffWorkDir = false } = await getAppConfig()
  const { current } = await getProfileConfig()
  if (isAbsolutePath(path)) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content, 'utf-8')
  } else {
    const target = join(diffWorkDir ? mihomoProfileWorkDir(current) : mihomoWorkDir(), path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content, 'utf-8')
  }
}
