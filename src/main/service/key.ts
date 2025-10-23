import crypto from 'crypto'

export interface KeyPair {
  publicKey: string
  privateKey: string
}

export class KeyManager {
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

    this.publicKey = publicKey
    this.privateKey = privKeyPem

    return { publicKey, privateKey: privKeyPem }
  }

  setKeyPair(publicKey: string, privateKey: string): void {
    this.publicKey = publicKey
    this.privateKey = privateKey
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
    return this.publicKey !== null && this.privateKey !== null
  }

  clear(): void {
    this.publicKey = null
    this.privateKey = null
  }
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
