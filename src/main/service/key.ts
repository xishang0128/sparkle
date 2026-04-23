import crypto from 'crypto'

export interface KeyPair {
  keyId: string
  publicKey: string
  privateKey: string
}

export class KeyManager {
  private keyId: string | null = null
  private publicKey: string | null = null
  private privateKey: string | null = null

  generateKeyPair(): KeyPair {
    const { publicKey: pubKeyObject, privateKey: privKeyPem } = crypto.generateKeyPairSync(
      'ed25519',
      {
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      }
    )

    const pubKeyPem = pubKeyObject as string
    const publicKey = pubKeyPem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/[\n\r\s]/g, '')

    const keyId = computeKeyId(publicKey)
    this.keyId = keyId
    this.publicKey = publicKey
    this.privateKey = privKeyPem

    return { keyId, publicKey, privateKey: privKeyPem }
  }

  setKeyPair(publicKey: string, privateKey: string, keyId?: string): void {
    if (!publicKey || !privateKey || publicKey.trim() === '' || privateKey.trim() === '') {
      throw new Error('密钥不能为空')
    }
    const computedKeyId = computeKeyId(publicKey)
    const normalizedKeyId = keyId?.trim() || computedKeyId
    if (normalizedKeyId !== computedKeyId) {
      throw new Error('密钥 ID 与公钥不匹配')
    }
    this.keyId = normalizedKeyId
    this.publicKey = publicKey
    this.privateKey = privateKey
  }

  getKeyID(): string {
    if (!this.keyId) {
      throw new Error('密钥 ID 未初始化')
    }
    return this.keyId
  }

  getPublicKey(): string {
    if (!this.publicKey) {
      throw new Error('公钥未初始化')
    }
    return this.publicKey
  }

  getPrivateKey(): string {
    if (!this.privateKey) {
      throw new Error('私钥未初始化')
    }
    return this.privateKey
  }

  signData(data: string): string {
    if (!this.privateKey) {
      throw new Error('私钥未初始化')
    }

    const keyObject = crypto.createPrivateKey({
      key: this.privateKey,
      format: 'pem'
    })

    const signature = crypto.sign(null, Buffer.from(data), keyObject)
    return signature.toString('base64')
  }

  isInitialized(): boolean {
    return (
      this.keyId !== null &&
      this.publicKey !== null &&
      this.privateKey !== null &&
      this.publicKey.trim() !== '' &&
      this.privateKey.trim() !== ''
    )
  }

  clear(): void {
    this.keyId = null
    this.publicKey = null
    this.privateKey = null
  }
}

export function computeKeyId(publicKey: string): string {
  const normalizedKey = publicKey.trim()
  if (!normalizedKey) {
    throw new Error('公钥不能为空')
  }

  const keyBytes = Buffer.from(normalizedKey, 'base64')
  if (keyBytes.length === 0) {
    throw new Error('公钥格式无效')
  }

  return crypto.createHash('sha256').update(keyBytes).digest('hex')
}

export function generateKeyPair(): KeyPair {
  const manager = new KeyManager()
  return manager.generateKeyPair()
}

export function signData(privateKey: string, data: string): string {
  const keyObject = crypto.createPrivateKey({
    key: privateKey,
    format: 'pem'
  })

  const signature = crypto.sign(null, Buffer.from(data), keyObject)
  return signature.toString('base64')
}
