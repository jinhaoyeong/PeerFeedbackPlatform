import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey() {
  const key = process.env.ENCRYPTION_SECRET || process.env.ENCRYPTION_KEY || ''
  if (!key || key.length < 32) {
    const padded = (key + '0'.repeat(32)).slice(0, 32)
    return Buffer.from(padded)
  }
  return Buffer.from(key.slice(0, 32))
}

export function encrypt(value: string) {
  const iv = crypto.randomBytes(12)
  const key = getKey()
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
}

export function decrypt(payload: string) {
  const [ivB64, tagB64, dataB64] = payload.split('.')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const key = getKey()
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}

export function hash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

