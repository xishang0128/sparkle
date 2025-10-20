import { readFile, writeFile } from 'fs/promises'
import { appConfigPath } from '../utils/dirs'
import { parseYaml, stringifyYaml } from '../utils/yaml'
import { deepMerge } from '../utils/merge'
import { defaultConfig } from '../utils/template'
import { readFileSync } from 'fs'
import { encryptString, decryptString, isEncrypted } from '../utils/encrypt'

let appConfig: AppConfig // config.yaml

export async function getAppConfig(force = false): Promise<AppConfig> {
  if (force || !appConfig) {
    const data = await readFile(appConfigPath(), 'utf-8')
    appConfig = parseYaml<AppConfig>(data) || defaultConfig

    if (appConfig.systemCorePath) {
      if (!isEncrypted(appConfig.systemCorePath)) {
        appConfig.systemCorePath = ''
      }
      appConfig.systemCorePath = decryptString(appConfig.systemCorePath)
    }
  }
  if (typeof appConfig !== 'object') appConfig = defaultConfig
  return appConfig
}

export async function patchAppConfig(patch: Partial<AppConfig>): Promise<void> {
  appConfig = deepMerge(appConfig, patch)

  const configToSave = { ...appConfig }
  if (configToSave.systemCorePath) {
    configToSave.systemCorePath = encryptString(configToSave.systemCorePath)
  }

  await writeFile(appConfigPath(), stringifyYaml(configToSave))
}

export function getAppConfigSync(): AppConfig {
  try {
    const raw = readFileSync(appConfigPath(), 'utf-8')
    const data = parseYaml<AppConfig>(raw)
    if (typeof data === 'object' && data !== null) {
      if (data.systemCorePath) {
        if (!isEncrypted(data.systemCorePath)) {
          data.systemCorePath = ''
        }
        data.systemCorePath = decryptString(data.systemCorePath)
      }
      return data
    }
    return defaultConfig
  } catch (e) {
    return defaultConfig
  }
}
