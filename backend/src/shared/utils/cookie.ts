import { Response } from 'express'

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   true,
  sameSite: 'none' as const,
  maxAge:   7 * 24 * 60 * 60 * 1000,
}

export function setAuthCookie(res: Response, name: string, token: string): void {
  res.cookie(name, token, COOKIE_OPTS)
}

export function clearAuthCookie(res: Response, name: string): void {
  res.clearCookie(name, { httpOnly: true, secure: true, sameSite: 'none' })
}
