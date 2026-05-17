import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JwtPayload } from '../types/jwt'
import { fail } from '../types/api'

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const cookieToken = (req as any).cookies?.noshow_staff
  const header = req.headers.authorization
  const token = cookieToken ?? (header?.startsWith('Bearer ') ? header.slice(7) : null)

  if (!token) {
    res.status(401).json(fail('Token não informado'))
    return
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    req.user = payload
    req.tenantId = payload.tenantId
    next()
  } catch {
    res.status(401).json(fail('Token inválido ou expirado'))
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      res.status(403).json(fail('Sem permissão'))
      return
    }
    next()
  }
}
