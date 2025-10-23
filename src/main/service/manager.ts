import { execFile } from 'child_process'
import { promisify } from 'util'
import { servicePath } from '../utils/dirs'
import { KeyManager } from './key'
import { initServiceAPI, getServiceAxios, ping, test } from './api'
import { getAppConfig, patchAppConfig } from '../config/app'

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
  keyManager = newKeyManager

  initServiceAPI(newKeyManager)

  await patchAppConfig({
    serviceAuthKey: `${keyPair.publicKey}:${keyPair.privateKey}`
  })

  const publicKey = keyPair.publicKey

  const execPath = servicePath()
  const execFilePromise = promisify(execFile)

  console.log('Initializing service with public key:', publicKey)

  try {
    if (process.platform === 'win32') {
      await execFilePromise(execPath, ['service', 'init', '--public-key', publicKey])
    } else if (process.platform === 'linux') {
      await execFilePromise('pkexec', [execPath, 'service', 'init', '--public-key', publicKey])
    } else if (process.platform === 'darwin') {
      const cmd = `${execPath} service init --public-key ${publicKey} > /tmp/sparkle-init.log 2>&1`
      const out = await execFilePromise('osascript', [
        '-e',
        `do shell script "${cmd}" with administrator privileges`
      ])
      console.log(out)
    }
  } catch (error) {
    throw new Error(`服务初始化失败：${error instanceof Error ? error.message : String(error)}`)
  }

  // 初始化完成后，等待一下让服务加载公钥
  await new Promise((resolve) => setTimeout(resolve, 500))
}

export async function installService(): Promise<void> {
  const execPath = servicePath()
  const execFilePromise = promisify(execFile)

  try {
    if (process.platform === 'win32') {
      await execFilePromise(execPath, ['service', 'install'])
    } else if (process.platform === 'linux') {
      await execFilePromise('pkexec', [execPath, 'service', 'install'])
    } else if (process.platform === 'darwin') {
      const cmd = `${execPath} service install`
      await execFilePromise('osascript', [
        '-e',
        `do shell script "${cmd}" with administrator privileges`
      ])
    }
  } catch (error) {
    throw new Error(`服务安装失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function uninstallService(): Promise<void> {
  const execPath = servicePath()
  const execFilePromise = promisify(execFile)

  try {
    if (process.platform === 'win32') {
      await execFilePromise(execPath, ['service', 'uninstall'])
    } else if (process.platform === 'linux') {
      await execFilePromise('pkexec', [execPath, 'service', 'uninstall'])
    } else if (process.platform === 'darwin') {
      const cmd = `${execPath} service uninstall`
      await execFilePromise('osascript', [
        '-e',
        `do shell script "${cmd}" with administrator privileges`
      ])
    }
  } catch (error) {
    throw new Error(`服务卸载失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function startService(): Promise<void> {
  const execPath = servicePath()
  const execFilePromise = promisify(execFile)

  try {
    if (process.platform === 'win32') {
      await execFilePromise(execPath, ['service', 'start'])
    } else if (process.platform === 'linux') {
      await execFilePromise('pkexec', [execPath, 'service', 'start'])
    } else if (process.platform === 'darwin') {
      const cmd = `${execPath} service start`
      await execFilePromise('osascript', [
        '-e',
        `do shell script "${cmd}" with administrator privileges`
      ])
    }
  } catch (error) {
    throw new Error(`服务启动失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function stopService(): Promise<void> {
  const execPath = servicePath()
  const execFilePromise = promisify(execFile)

  try {
    if (process.platform === 'win32') {
      await execFilePromise(execPath, ['service', 'stop'])
    } else if (process.platform === 'linux') {
      await execFilePromise('pkexec', [execPath, 'service', 'stop'])
    } else if (process.platform === 'darwin') {
      const cmd = `${execPath} service stop`
      await execFilePromise('osascript', [
        '-e',
        `do shell script "${cmd}" with administrator privileges`
      ])
    }
  } catch (error) {
    throw new Error(`服务停止失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function restartService(): Promise<void> {
  const execPath = servicePath()
  const execFilePromise = promisify(execFile)

  try {
    if (process.platform === 'win32') {
      await execFilePromise(execPath, ['service', 'restart'])
    } else if (process.platform === 'linux') {
      await execFilePromise('pkexec', [execPath, 'service', 'restart'])
    } else if (process.platform === 'darwin') {
      const cmd = `${execPath} service restart`
      await execFilePromise('osascript', [
        '-e',
        `do shell script "${cmd}" with administrator privileges`
      ])
    }
  } catch (error) {
    throw new Error(`服务重启失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function serviceStatus(): Promise<
  'running' | 'stopped' | 'not-installed' | 'paused' | 'unknown'
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
        return 'running'
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
    await test()
    return true
  } catch {
    return false
  }
}
