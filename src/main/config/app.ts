import { readFile, writeFile, rename, copyFile, unlink } from 'fs/promises'
import { appConfigPath } from '../utils/dirs'
import { parseYaml, stringifyYaml } from '../utils/yaml'
import { deepMerge } from '../utils/merge'
import { defaultConfig } from '../utils/template'
import { readFileSync, existsSync } from 'fs'
import { encryptString, decryptString, isEncrypted } from '../utils/encrypt'

let appConfig: AppConfig
let writePromise: Promise<void> = Promise.resolve()

const ENCRYPTED_FIELDS = ['systemCorePath', 'serviceAuthKey'] as const

function isValidConfig(config: unknown): config is AppConfig {
  if (!config || typeof config !== 'object') return false
  const cfg = config as Partial<AppConfig>
  return 'sysProxy' in cfg && typeof cfg.sysProxy === 'object' && cfg.sysProxy !== null
}

async function safeWriteConfig(content: string): Promise<void> {
  const configPath = appConfigPath()
  const tmpPath = `${configPath}.tmp`
  const backupPath = `${configPath}.backup`

  try {
    await writeFile(tmpPath, content, 'utf-8')
    if (existsSync(configPath)) {
      await copyFile(configPath, backupPath)
      if (process.platform === 'win32') {
        await unlink(configPath)
      }
    }
    if (existsSync(tmpPath)) {
      await rename(tmpPath, configPath)
    }
  } catch (e) {
    if (existsSync(tmpPath)) {
      try {
        await unlink(tmpPath)
      } catch {
        // ignore
      }
    }
    throw e
  }
}

function decryptConfig(config: AppConfig): AppConfig {
  const result = { ...config }

  for (const field of ENCRYPTED_FIELDS) {
    const value = result[field]
    if (value && typeof value === 'string') {
      if (!isEncrypted(value)) {
        ;(result[field] as string) = ''
      } else {
        ;(result[field] as string) = decryptString(value)
      }
    }
  }

  return result
}

function encryptConfig(config: AppConfig): AppConfig {
  const result = { ...config }

  for (const field of ENCRYPTED_FIELDS) {
    const value = result[field]
    if (value && typeof value === 'string') {
      ;(result[field] as string) = encryptString(value)
    }
  }

  return result
}

export async function getAppConfig(force = false): Promise<AppConfig> {
  if (force || !appConfig) {
    try {
      const data = await readFile(appConfigPath(), 'utf-8')
      const parsed = parseYaml<AppConfig>(data)
      if (!parsed || !isValidConfig(parsed)) {
        const backup = await readFile(`${appConfigPath()}.backup`, 'utf-8')
        appConfig = decryptConfig(parseYaml<AppConfig>(backup))
      } else {
        appConfig = decryptConfig(parsed)
      }
    } catch (e) {
      appConfig = defaultConfig
    }
  }
  if (typeof appConfig !== 'object') appConfig = defaultConfig
  return appConfig
}

export async function patchAppConfig(patch: Partial<AppConfig>): Promise<void> {
  const previousPromise = writePromise
  writePromise = (async () => {
    await previousPromise
    appConfig = deepMerge(appConfig, patch)
    await safeWriteConfig(stringifyYaml(encryptConfig(appConfig)))
  })()
  await writePromise
}

export function getAppConfigSync(): AppConfig {
  try {
    const raw = readFileSync(appConfigPath(), 'utf-8')
    const data = parseYaml<AppConfig>(raw)
    if (typeof data === 'object' && data !== null) {
      return decryptConfig(data)
    }
    return defaultConfig
  } catch (e) {
    return defaultConfig
  }
}
