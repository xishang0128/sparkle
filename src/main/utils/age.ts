import * as age from 'age-encryption'

export interface AgeKeyPair {
  identity: string
  recipient: string
}

const AGE_ARMORED_HEADER = '-----BEGIN AGE ENCRYPTED FILE-----'

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function splitAgeValues(value: string | string[] | undefined): string[] {
  if (!value) return []
  const rawValues = Array.isArray(value) ? value : value.split(/[\s,]+/)
  return rawValues.map((item) => item.trim()).filter((item) => item && !item.startsWith('#'))
}

export function isAgeEncryptedText(content: string): boolean {
  return content.trimStart().startsWith(AGE_ARMORED_HEADER)
}

export async function generateAgeKeyPair(): Promise<AgeKeyPair> {
  const identity = await age.generateIdentity()
  const recipient = await age.identityToRecipient(identity)
  return { identity, recipient }
}

export async function ageIdentityToRecipient(identity: string): Promise<string> {
  const identities = splitAgeValues(identity)
  if (identities.length === 0) {
    throw new Error('age 私钥不能为空')
  }

  try {
    return await age.identityToRecipient(identities[0])
  } catch (error) {
    throw new Error(`age 私钥无效：${formatError(error)}`)
  }
}

export async function encryptAgeText(
  content: string,
  recipients: string | string[] | undefined
): Promise<string> {
  const recipientList = splitAgeValues(recipients)
  if (recipientList.length === 0) {
    throw new Error('age 公钥不能为空')
  }

  try {
    const encrypter = new age.Encrypter()
    recipientList.forEach((recipient) => encrypter.addRecipient(recipient))
    const encrypted = await encrypter.encrypt(content)
    return age.armor.encode(encrypted)
  } catch (error) {
    throw new Error(`age 加密失败：${formatError(error)}`)
  }
}

export async function decryptAgeText(
  content: string,
  identities: string | string[] | undefined
): Promise<string> {
  const identityList = splitAgeValues(identities)
  if (identityList.length === 0) {
    throw new Error('age 私钥不能为空')
  }

  try {
    const decrypter = new age.Decrypter()
    identityList.forEach((identity) => decrypter.addIdentity(identity))
    return await decrypter.decrypt(age.armor.decode(content), 'text')
  } catch (error) {
    throw new Error(`age 解密失败：${formatError(error)}`)
  }
}
