import { safeStorage } from 'electron'
import type { SecretCipher } from './credentials'

export function createSafeStorageCipher(): SecretCipher {
  return {
    encrypt: (text) => safeStorage.encryptString(text).toString('base64'),
    decrypt: (cipherText) => safeStorage.decryptString(Buffer.from(cipherText, 'base64'))
  }
}
