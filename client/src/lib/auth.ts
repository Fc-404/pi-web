/**
 * Token 管理 + 密码工具
 */

const TOKEN_KEY = 'piweb_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

import CryptoJS from 'crypto-js'

const SALT = 'piweb'

/** SHA-256 加盐哈希密码，与后端一致 */
export function hashPassword(password: string): string {
  return CryptoJS.SHA256(password + SALT).toString()
}
