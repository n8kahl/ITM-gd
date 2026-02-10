import crypto from 'crypto'

export function generateVerificationCode(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function isValidVerificationCode(code: string): boolean {
  return /^[a-f0-9]{32}$/.test(code)
}
