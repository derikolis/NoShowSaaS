import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { registerTenant, login } from './auth.service'
import { ok, fail } from '../../shared/types/api'
import { setAuthCookie, clearAuthCookie } from '../../shared/utils/cookie'
import { JwtPayload } from '../../shared/types/jwt'

const router = Router()

const registerSchema = z.object({
  tenantName: z.string().min(2),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  ownerName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  tenantSlug: z.string(),
})

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body)
    const tenant = await registerTenant(body.tenantName, body.tenantSlug, body.ownerName, body.email, body.password)
    res.status(201).json(ok({ tenantId: tenant.id, slug: tenant.slug }, 'Empresa cadastrada com sucesso'))
  } catch (err) {
    if (err instanceof Error && err.message === 'Slug já em uso') {
      res.status(409).json(fail(err.message))
      return
    }
    next(err)
  }
})

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body)
    const result = await login(body.email, body.password, body.tenantSlug)
    setAuthCookie(res, 'noshow_staff', result.token)
    const { user } = result
    res.json(ok({ name: user.name, role: user.role, slug: body.tenantSlug }, 'Login realizado com sucesso'))
  } catch (err) {
    if (err instanceof Error && (err.message === 'Credenciais inválidas' || err.message === 'Empresa não encontrada')) {
      res.status(401).json(fail(err.message))
      return
    }
    next(err)
  }
})

router.post('/logout', (req: Request, res: Response) => {
  clearAuthCookie(res, 'noshow_staff')
  res.json(ok(null, 'Sessão encerrada'))
})

router.get('/me', (req: Request, res: Response) => {
  const token = (req as any).cookies?.noshow_staff
  if (!token) { res.status(401).json(fail('Não autenticado')); return }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    res.json(ok({ name: payload.name, role: payload.role, slug: payload.slug }))
  } catch {
    clearAuthCookie(res, 'noshow_staff')
    res.status(401).json(fail('Sessão expirada'))
  }
})

export default router
