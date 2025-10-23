import { readFile, writeFile } from 'fs/promises'
import { appConfigPath } from '../utils/dirs'
import { parseYaml, stringifyYaml } from '../utils/yaml'
import { deepMerge } from '../utils/merge'
import { defaultConfig } from '../utils/template'
import { readFileSync } from 'fs'
import { encryptString, decryptString, isEncrypted } from '../utils/encrypt'

let appConfig: AppConfig // config.yaml

const ENCRYPTED_FIELDS = ['systemCorePath', 'serviceAuthKey'] as const

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
    const data = await readFile(appConfigPath(), 'utf-8')
    appConfig = parseYaml<AppConfig>(data) || defaultConfig
    appConfig = decryptConfig(appConfig)
  }
  if (typeof appConfig !== 'object') appConfig = defaultConfig
  return appConfig
}

export async function patchAppConfig(patch: Partial<AppConfig>): Promise<void> {
  appConfig = deepMerge(appConfig, patch)

  const configToSave = encryptConfig(appConfig)

  await writeFile(appConfigPath(), stringifyYaml(configToSave))
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
