import {
  getControledMihomoConfig,
  getProfileConfig,
  getProfile,
  getProfileStr,
  getProfileItem,
  getOverride,
  getOverrideItem,
  getOverrideConfig,
  getAppConfig
} from '../config'
import {
  mihomoProfileWorkDir,
  mihomoWorkConfigPath,
  mihomoWorkDir,
  overridePath
} from '../utils/dirs'
import yaml from 'yaml'
import { copyFile, mkdir, writeFile } from 'fs/promises'
import { deepMerge } from '../utils/merge'
import vm from 'vm'
import { existsSync, writeFileSync } from 'fs'
import path from 'path'

let runtimeConfigStr: string,
  rawProfileStr: string,
  currentProfileStr: string,
  overrideProfileStr: string,
  runtimeConfig: MihomoConfig

export async function generateProfile(): Promise<void> {
  const { current } = await getProfileConfig()
  const { diffWorkDir = false } = await getAppConfig()
  const currentProfileConfig = await getProfile(current)
  rawProfileStr = await getProfileStr(current)
  currentProfileStr = yaml.stringify(currentProfileConfig)
  const currentProfile = await overrideProfile(current, currentProfileConfig)
  overrideProfileStr = yaml.stringify(currentProfile)
  const controledMihomoConfig = await getControledMihomoConfig()
  const profile = deepMerge(
    JSON.parse(JSON.stringify(currentProfile)),
    JSON.parse(JSON.stringify(controledMihomoConfig))
  )
  // 确保可以拿到基础日志信息
  // 使用 debug 可以调试内核相关问题 `debug/pprof`
  if (['info', 'debug'].includes(profile['log-level']) === false) {
    profile['log-level'] = 'info'
  }
  // 处理端口局域连接网相关配置项
  if (profile['allow-lan'] === false) {
    profile['lan-allowed-ips'] = undefined
    profile['lan-disallowed-ips'] = undefined
  } else {
    if (profile['lan-allowed-ips']?.length === 0) {
      profile['lan-allowed-ips'] = undefined
    } else if (profile['lan-allowed-ips']) {
      if (!profile['lan-allowed-ips'].some((ip: string) => ip.startsWith('127.0.0.1/'))) {
        profile['lan-allowed-ips']?.push('127.0.0.1/8')
      }
    }
    if (profile['lan-disallowed-ips']?.length === 0) {
      profile['lan-disallowed-ips'] = undefined
    }
  }
  // macOS 只允许 utun 设备
  if (process.platform === 'darwin' && controledMihomoConfig.tun) {
    if (!controledMihomoConfig.tun.device?.startsWith('utun')) {
      controledMihomoConfig.tun.device = undefined
    }
  }

  runtimeConfig = profile
  runtimeConfigStr = yaml.stringify(profile)
  if (diffWorkDir) {
    await prepareProfileWorkDir(current)
  }
  await writeFile(
    diffWorkDir ? mihomoWorkConfigPath(current) : mihomoWorkConfigPath('work'),
    runtimeConfigStr
  )
}

async function prepareProfileWorkDir(current: string | undefined): Promise<void> {
  if (!existsSync(mihomoProfileWorkDir(current))) {
    await mkdir(mihomoProfileWorkDir(current), { recursive: true })
  }
  const copy = async (file: string): Promise<void> => {
    const targetPath = path.join(mihomoProfileWorkDir(current), file)
    const sourcePath = path.join(mihomoWorkDir(), file)
    if (!existsSync(targetPath) && existsSync(sourcePath)) {
      await copyFile(sourcePath, targetPath)
    }
  }
  await Promise.all([
    copy('country.mmdb'),
    copy('geoip.metadb'),
    copy('geoip.dat'),
    copy('geosite.dat'),
    copy('ASN.mmdb')
  ])
}

async function overrideProfile(
  current: string | undefined,
  profile: MihomoConfig
): Promise<MihomoConfig> {
  const { items = [] } = (await getOverrideConfig()) || {}
  const globalOverride = items.filter((item) => item.global).map((item) => item.id)
  const { override = [] } = (await getProfileItem(current)) || {}
  for (const ov of new Set(globalOverride.concat(override))) {
    const item = await getOverrideItem(ov)
    const content = await getOverride(ov, item?.ext || 'js')
    switch (item?.ext) {
      case 'js':
        profile = await runOverrideScript(profile, content, item)
        break
      case 'yaml': {
        let patch = yaml.parse(content, { merge: true }) || {}
        if (typeof patch !== 'object') patch = {}
        profile = deepMerge(profile, patch, true)
        break
      }
    }
  }
  return profile
}

async function runOverrideScript(
  profile: MihomoConfig,
  script: string,
  item: OverrideItem
): Promise<MihomoConfig> {
  const log = (type: string, data: string, flag = 'a'): void => {
    writeFileSync(overridePath(item.id, 'log'), `[${type}] ${data}\n`, {
      encoding: 'utf-8',
      flag
    })
  }
  try {
    const b64d = (str: string): string => Buffer.from(str, 'base64').toString('utf-8')
    const b64e = (data: Buffer | string): string =>
      (Buffer.isBuffer(data) ? data : Buffer.from(String(data))).toString('base64')
    const ctx = {
      console: Object.freeze({
        log: (...args: unknown[]) => log('log', args.map(format).join(' ')),
        info: (...args: unknown[]) => log('info', args.map(format).join(' ')),
        error: (...args: unknown[]) => log('error', args.map(format).join(' ')),
        debug: (...args: unknown[]) => log('debug', args.map(format).join(' '))
      }),
      fetch,
      yaml,
      b64d,
      b64e,
      Buffer
    }
    vm.createContext(ctx)
    log('info', '开始执行脚本', 'w')
    vm.runInContext(script, ctx)
    const promise = vm.runInContext(
      `(async () => {
        const result = main(${JSON.stringify(profile)})
        if (result instanceof Promise) return await result
        return result
      })()`,
      ctx
    )
    const newProfile = await promise
    if (typeof newProfile !== 'object') {
      throw new Error('脚本返回值必须是对象')
    }
    log('info', '脚本执行成功')
    return newProfile
  } catch (e) {
    log('exception', `脚本执行失败：${e}`)
    return profile
  }
}

function format(data: unknown): string {
  if (data instanceof Error) {
    return `${data.name}: ${data.message}\n${data.stack}`
  }
  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}

export async function getRuntimeConfigStr(): Promise<string> {
  return runtimeConfigStr
}

export async function getRawProfileStr(): Promise<string> {
  return rawProfileStr
}

export async function getCurrentProfileStr(): Promise<string> {
  return currentProfileStr
}

export async function getOverrideProfileStr(): Promise<string> {
  return overrideProfileStr
}

export async function getRuntimeConfig(): Promise<MihomoConfig> {
  return runtimeConfig
}
