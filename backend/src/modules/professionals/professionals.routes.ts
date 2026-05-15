import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../../shared/middlewares/auth.middleware'
import prisma from '../../shared/utils/prisma'
import { ok } from '../../shared/types/api'

const router = Router()
router.use(authMiddleware)

// Lista profissionais (usuários com role owner ou employee)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const professionals = await prisma.user.findMany({
      where: { tenantId: req.tenantId, role: { in: ['owner', 'employee'] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    })
    res.json(ok(professionals))
  } catch (err) { next(err) }
})

// Cria novo profissional (employee) — só owner pode
router.post('/', requireRole('owner'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
    }).parse(req.body)

    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: req.tenantId, email: body.email } },
    })
    if (existing) { res.status(409).json({ success: false, message: 'Email já em uso', data: null }); return }

    const { hash } = await import('bcryptjs')
    const passwordHash = await hash(body.password, 10)

    const user = await prisma.user.create({
      data: { tenantId: req.tenantId, name: body.name, email: body.email, passwordHash, role: 'employee' },
      select: { id: true, name: true, email: true, role: true },
    })
    res.status(201).json(ok(user, 'Profissional criado'))
  } catch (err) { next(err) }
})

export default router
