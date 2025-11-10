import { safeStorage } from 'electron'

const ENCRYPTED_PREFIX = 'enc:'

export function encryptString(plainText: string): string {
  if (!plainText) return ''

  if (plainText.startsWith(ENCRYPTED_PREFIX)) {
    return plainText
  }

  if (!safeStorage.isEncryptionAvailable()) {
    return plainText
  }

  try {
    const buffer = safeStorage.encryptString(plainText)
    return ENCRYPTED_PREFIX + buffer.toString('base64')
  } catch (e) {
    return plainText
  }
}

export function decryptString(encryptedText: string): string {
  if (!encryptedText) return ''

  if (!encryptedText.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error('无效的加密格式')
  }

  if (!safeStorage.isEncryptionAvailable()) {
    return encryptedText.substring(ENCRYPTED_PREFIX.length)
  }

  try {
    const base64Data = encryptedText.substring(ENCRYPTED_PREFIX.length)
    const buffer = Buffer.from(base64Data, 'base64')
    return safeStorage.decryptString(buffer)
  } catch (e) {
    return ''
  }
}

export function isEncrypted(text: string): boolean {
  if (!text) return false
  return text.startsWith(ENCRYPTED_PREFIX)
}
