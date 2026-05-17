import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { ok, fail } from '../../shared/types/api'
import { adminMiddleware } from '../../shared/middlewares/admin.middleware'
import { setAuthCookie, clearAuthCookie } from '../../shared/utils/cookie'
import { JwtPayload } from '../../shared/types/jwt'
import * as adminService from './admin.service'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const createTenantSchema = z.object({
  companyName: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(6),
})

const statusSchema = z.object({
  status: z.enum(['active', 'inactive', 'blocked']),
})

// POST /api/admin/auth/login — público
router.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const result = await adminService.adminLogin(email, password)
    setAuthCookie(res, 'noshow_admin', result.token)
    res.json(ok({ name: 'Super Admin', role: 'superadmin' }, 'Login realizado com sucesso'))
  } catch (err) {
    if (err instanceof Error && err.message === 'Credenciais inválidas') {
      res.status(401).json(fail(err.message))
      return
    }
    next(err)
  }
})

// POST /api/admin/auth/logout
router.post('/auth/logout', (req: Request, res: Response) => {
  clearAuthCookie(res, 'noshow_admin')
  res.json(ok(null, 'Sessão encerrada'))
})

// GET /api/admin/auth/me
router.get('/auth/me', (req: Request, res: Response) => {
  const token = (req as any).cookies?.noshow_admin
  if (!token) { res.status(401).json(fail('Não autenticado')); return }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    if (payload.role !== 'superadmin') { res.status(403).json(fail('Acesso negado')); return }
    res.json(ok({ name: 'Super Admin', role: 'superadmin' }))
  } catch {
    clearAuthCookie(res, 'noshow_admin')
    res.status(401).json(fail('Sessão expirada'))
  }
})

// Todas as rotas abaixo exigem token superadmin
router.use(adminMiddleware)

// GET /api/admin/stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adminService.getAdminStats()
    res.json(ok(data, 'OK'))
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/tenants
router.get('/tenants', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tenants = await adminService.listTenants()
    res.json(ok({ tenants }, 'OK'))
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/tenants
router.post('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createTenantSchema.parse(req.body)
    await adminService.createTenant(body.companyName, body.slug, body.ownerName, body.ownerEmail, body.ownerPassword)
    res.status(201).json(ok(null, 'Empresa criada com sucesso'))
  } catch (err) {
    if (err instanceof Error && err.message === 'Slug já em uso') {
      res.status(409).json(fail(err.message))
      return
    }
    next(err)
  }
})

// GET /api/admin/tenants/health
router.get('/tenants/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adminService.getTenantHealth()
    res.json(ok(data))
  } catch (err) { next(err) }
})

// PATCH /api/admin/tenants/:id/status
router.patch('/tenants/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = statusSchema.parse(req.body)
    await adminService.updateTenantStatus(req.params.id as string, status)
    res.json(ok(null, 'Status atualizado'))
  } catch (err) {
    if (err instanceof Error && err.message === 'Empresa não encontrada') {
      res.status(404).json(fail(err.message))
      return
    }
    next(err)
  }
})

export default router
