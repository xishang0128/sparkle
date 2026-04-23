import { existsSync } from 'fs'
import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { serviceAuthStorePath } from '../utils/dirs'
import {
  decryptStringStrict,
  encryptStringStrict,
  isSecureStorageAvailable
} from '../utils/encrypt'
import { computeKeyId, type KeyPair } from './key'

interface ServiceAuthEnvelope {
  version: 1
  ciphertext: string
}

export interface ServiceAuthSecret extends KeyPair {}

function normalizeServiceAuthSecret(secret: {
  keyId?: string
  publicKey?: string
  privateKey?: string
}): ServiceAuthSecret {
  const publicKey = secret.publicKey?.trim() || ''
  const privateKey = secret.privateKey?.trim() || ''

  if (!publicKey || !privateKey) {
    throw new Error('服务鉴权密钥无效')
  }

  const computedKeyId = computeKeyId(publicKey)
  const keyId = secret.keyId?.trim() || computedKeyId
  if (keyId !== computedKeyId) {
    throw new Error('服务鉴权密钥无效')
  }

  return {
    keyId,
    publicKey,
    privateKey
  }
}

function parseServiceAuthEnvelope(content: string): ServiceAuthEnvelope {
  const parsed = JSON.parse(content) as Partial<ServiceAuthEnvelope>
  if (parsed.version !== 1 || typeof parsed.ciphertext !== 'string' || !parsed.ciphertext) {
    throw new Error('服务鉴权存储格式无效')
  }
  return {
    version: 1,
    ciphertext: parsed.ciphertext
  }
}

export function canPersistServiceAuthSecret(): boolean {
  return isSecureStorageAvailable()
}

export async function loadServiceAuthSecret(): Promise<ServiceAuthSecret | null> {
  const storePath = serviceAuthStorePath()

  let raw: string
  try {
    raw = await readFile(storePath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }

  const envelope = parseServiceAuthEnvelope(raw)
  const payload = decryptStringStrict(envelope.ciphertext)
  return normalizeServiceAuthSecret(JSON.parse(payload) as Partial<ServiceAuthSecret>)
}

export async function saveServiceAuthSecret(secret: ServiceAuthSecret): Promise<void> {
  if (!canPersistServiceAuthSecret()) {
    throw new Error('当前系统安全存储不可用，无法保存服务鉴权密钥')
  }

  const normalizedSecret = normalizeServiceAuthSecret(secret)
  const storePath = serviceAuthStorePath()
  const tempPath = `${storePath}.tmp`
  const content = JSON.stringify(
    {
      version: 1,
      ciphertext: encryptStringStrict(JSON.stringify(normalizedSecret))
    } satisfies ServiceAuthEnvelope,
    null,
    2
  )

  await mkdir(dirname(storePath), { recursive: true })

  try {
    await writeFile(tempPath, content, { encoding: 'utf-8', mode: 0o600 })
    if (existsSync(storePath) && process.platform === 'win32') {
      await unlink(storePath)
    }
    await rename(tempPath, storePath)
  } catch (error) {
    try {
      await unlink(tempPath)
    } catch {
      // ignore
    }
    throw error
  }
}

export async function deleteServiceAuthSecret(): Promise<void> {
  try {
    await unlink(serviceAuthStorePath())
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}
