import { existsSync } from 'fs'
import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { serviceAuthStorePath } from '../utils/dirs'
import { computeKeyId, type KeyPair } from './key'

interface PlainServiceAuthEnvelope extends ServiceAuthSecret {
  version: 2
  storage: 'plain'
}

type ServiceAuthEnvelope = PlainServiceAuthEnvelope

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

  const envelope = JSON.parse(raw) as Partial<ServiceAuthEnvelope>
  if (envelope.version === 2 && envelope.storage === 'plain') {
    return normalizeServiceAuthSecret(envelope)
  }

  throw new Error('服务鉴权存储格式无效')
}

export async function saveServiceAuthSecret(secret: ServiceAuthSecret): Promise<void> {
  const normalizedSecret = normalizeServiceAuthSecret(secret)
  const storePath = serviceAuthStorePath()
  const tempPath = `${storePath}.tmp`
  const envelope: ServiceAuthEnvelope = {
    version: 2,
    storage: 'plain',
    ...normalizedSecret
  }
  const content = JSON.stringify(envelope, null, 2)

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
