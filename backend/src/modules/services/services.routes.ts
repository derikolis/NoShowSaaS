import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../../shared/middlewares/auth.middleware'
import prisma from '../../shared/utils/prisma'
import { ok, fail } from '../../shared/types/api'

const router = Router()
router.use(authMiddleware)

// Lista serviços do tenant
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const services = await prisma.service.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' },
    })
    res.json(ok(services))
  } catch (err) { next(err) }
})

// Cria serviço — só owner pode
router.post('/', requireRole('owner'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      name:        z.string().min(2),
      description: z.string().optional(),
      duration:    z.number().int().min(5).max(480),
      price:       z.number().nonnegative().optional(),
    }).parse(req.body)

    const service = await prisma.service.create({
      data: { tenantId: req.tenantId, ...body },
    })
    res.status(201).json(ok(service, 'Serviço criado'))
  } catch (err) { next(err) }
})

// Atualiza serviço — só owner pode
router.put('/:id', requireRole('owner'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      name:        z.string().min(2).optional(),
      description: z.string().nullable().optional(),
      duration:    z.number().int().min(5).max(480).optional(),
      price:       z.number().nonnegative().nullable().optional(),
      active:      z.boolean().optional(),
    }).parse(req.body)

    const existing = await prisma.service.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    })
    if (!existing) { res.status(404).json(fail('Serviço não encontrado')); return }

    const service = await prisma.service.update({
      where: { id: req.params.id },
      data: body,
    })
    res.json(ok(service, 'Serviço atualizado'))
  } catch (err) { next(err) }
})

export default router
