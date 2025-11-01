import { servicePath } from '../utils/dirs'
import { execWithElevation } from '../utils/elevation'
import { KeyManager } from './key'
import { initServiceAPI, getServiceAxios, ping, test } from './api'
import { getAppConfig, patchAppConfig } from '../config/app'
import { execFile } from 'child_process'
import { promisify } from 'util'

let keyManager: KeyManager | null = null

export async function initKeyManager(): Promise<KeyManager> {
  if (keyManager) {
    return keyManager
  }

  keyManager = new KeyManager()

  const config = await getAppConfig()
  if (config.serviceAuthKey) {
    try {
      const [publicKey, privateKey] = config.serviceAuthKey.split(':')
      if (publicKey && privateKey) {
        keyManager.setKeyPair(publicKey, privateKey)
        initServiceAPI(keyManager)
        return keyManager
      }
    } catch {
      // ignore
    }
  }

  const keyPair = keyManager.generateKeyPair()
  await patchAppConfig({
    serviceAuthKey: `${keyPair.publicKey}:${keyPair.privateKey}`
  })

  initServiceAPI(keyManager)
  return keyManager
}

export function getKeyManager(): KeyManager {
  if (!keyManager) {
    throw new Error('密钥管理器未初始化，请先调用 initKeyManager')
  }
  return keyManager
}

export function getPublicKey(): string {
  return getKeyManager().getPublicKey()
}

class UserCancelledError extends Error {
  constructor(message = '用户取消操作') {
    super(message)
    this.name = 'UserCancelledError'
  }
}

function isUserCancelledError(error: unknown): boolean {
  if (error instanceof UserCancelledError) {
    return true
  }
  const errorMsg = error instanceof Error ? error.message : String(error)
  return (
    errorMsg.includes('用户已取消') ||
    errorMsg.includes('User canceled') ||
    errorMsg.includes('(-128)') ||
    errorMsg.includes('user cancelled') ||
    errorMsg.includes('dismissed')
  )
}

export function exportPublicKey(): string {
  return getPublicKey()
}

export function getAxios() {
  return getServiceAxios()
}

export async function initService(): Promise<void> {
  keyManager = null

  const newKeyManager = new KeyManager()
  const keyPair = newKeyManager.generateKeyPair()

  initServiceAPI(newKeyManager)

  const publicKey = keyPair.publicKey

  const execPath = servicePath()

  try {
    await execWithElevation(execPath, ['service', 'init', '--public-key', publicKey])

    await patchAppConfig({
      serviceAuthKey: `${keyPair.publicKey}:${keyPair.privateKey}`
    })

    keyManager = newKeyManager
  } catch (error) {
    if (isUserCancelledError(error)) {
      throw new UserCancelledError()
    }
    throw new Error(`服务初始化失败：${error instanceof Error ? error.message : String(error)}`)
  }

  await new Promise((resolve) => setTimeout(resolve, 500))
}

export async function installService(): Promise<void> {
  const execPath = servicePath()

  try {
    await execWithElevation(execPath, ['service', 'install'])
  } catch (error) {
    if (isUserCancelledError(error)) {
      throw new UserCancelledError()
    }
    throw new Error(`服务安装失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function uninstallService(): Promise<void> {
  const execPath = servicePath()

  try {
    await execWithElevation(execPath, ['service', 'uninstall'])
  } catch (error) {
    if (isUserCancelledError(error)) {
      throw new UserCancelledError()
    }
    throw new Error(`服务卸载失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function startService(): Promise<void> {
  const execPath = servicePath()

  try {
    await execWithElevation(execPath, ['service', 'start'])
  } catch (error) {
    if (isUserCancelledError(error)) {
      throw new UserCancelledError()
    }
    throw new Error(`服务启动失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function stopService(): Promise<void> {
  const execPath = servicePath()

  try {
    await execWithElevation(execPath, ['service', 'stop'])
  } catch (error) {
    if (isUserCancelledError(error)) {
      throw new UserCancelledError()
    }
    throw new Error(`服务停止失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function restartService(): Promise<void> {
  const execPath = servicePath()

  try {
    await execWithElevation(execPath, ['service', 'restart'])
  } catch (error) {
    if (isUserCancelledError(error)) {
      throw new UserCancelledError()
    }
    throw new Error(`服务重启失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function serviceStatus(): Promise<
  'running' | 'stopped' | 'not-installed' | 'paused' | 'unknown' | 'need-init'
> {
  const execPath = servicePath()
  const execFilePromise = promisify(execFile)

  try {
    const { stderr } = await execFilePromise(execPath, ['service', 'status'])
    if (stderr.includes('the service is not installed')) {
      return 'not-installed'
    } else {
      try {
        await ping()
        try {
          const out = await test()
          if (out && typeof out === 'object' && 'status' in out && out.status === 'error') {
            return 'need-init'
          }
          return 'running'
        } catch (e) {
          return 'need-init'
        }
      } catch (e) {
        return 'stopped'
      }
    }
  } catch (error) {
    return 'unknown'
  }
}

export async function testServiceConnection(): Promise<boolean> {
  try {
    const out = await test()
    if (out && typeof out === 'object' && 'status' in out && out.status === 'error') {
      return false
    }
    return true
  } catch {
    return false
  }
}
