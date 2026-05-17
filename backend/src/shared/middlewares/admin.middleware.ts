import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JwtPayload } from '../types/jwt'
import { fail } from '../types/api'

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const cookieToken = (req as any).cookies?.noshow_admin
  const header = req.headers.authorization
  const token = cookieToken ?? (header?.startsWith('Bearer ') ? header.slice(7) : null)

  if (!token) {
    res.status(401).json(fail('Token não informado'))
    return
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    if (payload.role !== 'superadmin') {
      res.status(403).json(fail('Acesso restrito ao administrador'))
      return
    }
    req.user = payload
    next()
  } catch {
    res.status(401).json(fail('Token inválido ou expirado'))
  }
}
