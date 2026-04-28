import { servicePath } from '../utils/dirs'
import { execWithElevation } from '../utils/elevation'
import { KeyManager, type KeyPair, computeKeyId } from './key'
import { initServiceAPI, getServiceAxios, ping, test, ServiceAPIError } from './api'
import { getAppConfig, patchAppConfig } from '../config/app'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  canPersistServiceAuthSecret,
  loadServiceAuthSecret,
  saveServiceAuthSecret,
  type ServiceAuthSecret
} from './auth-store'

let keyManager: KeyManager | null = null
const execFilePromise = promisify(execFile)

function parseLegacyServiceAuth(value: string): ServiceAuthSecret | null {
  try {
    const [publicKey, privateKey] = value.split(':')
    if (!publicKey || !privateKey) {
      return null
    }

    return {
      keyId: computeKeyId(publicKey),
      publicKey,
      privateKey
    }
  } catch {
    return null
  }
}

async function clearLegacyServiceAuth(): Promise<void> {
  await patchAppConfig({
    serviceAuthKey: undefined
  })
}

async function loadServiceAuthFromLegacyConfig(): Promise<ServiceAuthSecret | null> {
  const config = await getAppConfig()
  if (!config.serviceAuthKey) {
    return null
  }

  const legacySecret = parseLegacyServiceAuth(config.serviceAuthKey)
  if (!legacySecret) {
    return null
  }

  if (canPersistServiceAuthSecret()) {
    try {
      await saveServiceAuthSecret(legacySecret)
      await clearLegacyServiceAuth()
    } catch {
      // ignore and continue using the legacy value in memory
    }
  }

  return legacySecret
}

async function loadAvailableServiceAuth(): Promise<ServiceAuthSecret | null> {
  try {
    const storedSecret = await loadServiceAuthSecret()
    if (storedSecret) {
      const config = await getAppConfig()
      if (config.serviceAuthKey) {
        await clearLegacyServiceAuth()
      }
      return storedSecret
    }
  } catch {
    // ignore and fall back to the legacy config field
  }

  return await loadServiceAuthFromLegacyConfig()
}

function applyServiceAuthSecret(target: KeyManager, secret: ServiceAuthSecret | null): void {
  target.clear()
  if (secret) {
    target.setKeyPair(secret.publicKey, secret.privateKey, secret.keyId)
  }
}

function currentServiceAuthSecret(target: KeyManager): ServiceAuthSecret {
  return {
    keyId: target.getKeyID(),
    publicKey: target.getPublicKey(),
    privateKey: target.getPrivateKey()
  }
}

async function ensurePersistedServiceAuth(target: KeyManager): Promise<ServiceAuthSecret> {
  if (target.isInitialized()) {
    return currentServiceAuthSecret(target)
  }

  const existingSecret = await loadAvailableServiceAuth()
  if (existingSecret) {
    applyServiceAuthSecret(target, existingSecret)
    return existingSecret
  }

  if (!canPersistServiceAuthSecret()) {
    throw new Error('当前系统安全存储不可用，无法初始化服务鉴权')
  }

  const generatedKeyPair: KeyPair = target.generateKeyPair()
  await saveServiceAuthSecret(generatedKeyPair)
  await clearLegacyServiceAuth()
  return generatedKeyPair
}

export async function initKeyManager(): Promise<KeyManager> {
  if (keyManager) {
    return keyManager
  }

  keyManager = new KeyManager()
  const existingSecret = await loadAvailableServiceAuth()
  applyServiceAuthSecret(keyManager, existingSecret)
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

interface ServiceLogEntry {
  msg?: string
  message?: string
  error?: string
  status?: {
    state?: string
    error?: string
  }
}

function parseServiceLog(output: string): ServiceLogEntry | null {
  let last: ServiceLogEntry | null = null
  let lines: string[] = []

  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === '{') {
      lines = [line]
      continue
    }
    if (lines.length === 0) continue

    lines.push(line)
    if (line.trim() !== '}') continue

    try {
      last = JSON.parse(lines.join('\n')) as ServiceLogEntry
    } catch {
      // ignore non-service JSON fragments from command wrappers
    }
    lines = []
  }

  return last
}

function serviceCommandOutput(value: unknown): string {
  if (typeof value === 'object' && value) {
    const output = value as { stdout?: unknown; stderr?: unknown }
    if (output.stdout != null || output.stderr != null) {
      return [String(output.stdout ?? ''), String(output.stderr ?? '')].join('\n')
    }
  }
  return value instanceof Error ? value.message : String(value)
}

function serviceCommandErrorMessage(error: unknown): string {
  const entry = parseServiceLog(serviceCommandOutput(error))
  const message = entry?.msg ?? entry?.message
  const detail = entry?.status?.error ?? entry?.error
  if (message && detail && message !== detail) {
    return `${message}：${detail}`
  }
  return detail || message || (error instanceof Error ? error.message : String(error))
}

async function getAuthorizedPrincipalArgs(): Promise<string[]> {
  if (process.platform === 'win32') {
    const { stdout } = await execFilePromise(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        '[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'
      ],
      { timeout: 5000 }
    )

    const sid = stdout.trim()
    if (!sid.startsWith('S-')) {
      throw new Error('读取当前用户 SID 失败')
    }

    return ['--authorized-sid', sid]
  }

  const uid = process.getuid?.()
  if (uid == null) {
    throw new Error('读取当前用户 UID 失败')
  }

  return ['--authorized-uid', String(uid)]
}

export function exportPublicKey(): string {
  return getPublicKey()
}

export function getAxios() {
  return getServiceAxios()
}

async function waitForServiceReady(timeoutMs = 15000): Promise<void> {
  const startedAt = Date.now()
  let lastError: unknown = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await ping()
      await test()
      return
    } catch (error) {
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(
    `等待服务就绪超时：${lastError instanceof Error ? lastError.message : String(lastError)}`
  )
}

export async function initService(): Promise<void> {
  const currentKeyManager = await initKeyManager()
  const secret = await ensurePersistedServiceAuth(currentKeyManager)
  const execPath = servicePath()

  try {
    const principalArgs = await getAuthorizedPrincipalArgs()
    await execWithElevation(execPath, [
      'service',
      'init',
      '--public-key',
      secret.publicKey,
      ...principalArgs
    ])
  } catch (error) {
    if (isUserCancelledError(error)) {
      throw new UserCancelledError()
    }
    throw new Error(`服务初始化失败：${serviceCommandErrorMessage(error)}`)
  }

  await waitForServiceReady()
}

export async function installService(): Promise<void> {
  const execPath = servicePath()

  try {
    await execWithElevation(execPath, ['service', 'install'])
  } catch (error) {
    if (isUserCancelledError(error)) {
      throw new UserCancelledError()
    }
    throw new Error(`服务安装失败：${serviceCommandErrorMessage(error)}`)
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
    throw new Error(`服务卸载失败：${serviceCommandErrorMessage(error)}`)
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
    throw new Error(`服务启动失败：${serviceCommandErrorMessage(error)}`)
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
    throw new Error(`服务停止失败：${serviceCommandErrorMessage(error)}`)
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
    throw new Error(`服务重启失败：${serviceCommandErrorMessage(error)}`)
  }
}

export async function serviceStatus(): Promise<
  'running' | 'stopped' | 'not-installed' | 'paused' | 'unknown' | 'need-init'
> {
  const execPath = servicePath()

  try {
    const { stdout, stderr } = await execFilePromise(execPath, ['service', 'status'])
    if (parseServiceLog(`${stdout}\n${stderr}`)?.status?.state === 'not-installed') {
      return 'not-installed'
    }
    try {
      await ping()
      try {
        await test()
        return 'running'
      } catch (error) {
        if (
          error instanceof ServiceAPIError &&
          error.status !== undefined &&
          [401, 403, 409, 503].includes(error.status)
        ) {
          return 'need-init'
        }
        return 'unknown'
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      if (
        errorMsg.includes('EACCES') ||
        errorMsg.includes('permission denied') ||
        errorMsg.includes('access is denied')
      ) {
        return 'need-init'
      }
      return 'stopped'
    }
  } catch (error) {
    if (parseServiceLog(serviceCommandOutput(error))?.status?.state === 'not-installed') {
      return 'not-installed'
    }
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
