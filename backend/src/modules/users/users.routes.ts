import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { authMiddleware, requireRole } from '../../shared/middlewares/auth.middleware'
import prisma from '../../shared/utils/prisma'
import { ok, fail } from '../../shared/types/api'

const router = Router()
router.use(authMiddleware)
router.use(requireRole('owner'))

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.tenantId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json(ok(users))
  } catch (err) { next(err) }
})

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['receptionist', 'employee']),
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body)

    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: req.tenantId, email: body.email } },
    })
    if (existing) { res.status(409).json(fail('Email já em uso')); return }

    const passwordHash = await hash(body.password, 10)
    const user = await prisma.user.create({
      data: { tenantId: req.tenantId, name: body.name, email: body.email, passwordHash, role: body.role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    res.status(201).json(ok(user, 'Usuário criado'))
  } catch (err) { next(err) }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id)
    // Impede que o owner delete a si mesmo
    if (id === req.user.sub) { res.status(400).json(fail('Não é possível remover o próprio usuário')); return }

    const user = await prisma.user.findFirst({ where: { id, tenantId: req.tenantId } })
    if (!user) { res.status(404).json(fail('Usuário não encontrado')); return }
    if (user.role === 'owner') { res.status(400).json(fail('Não é possível remover o owner')); return }

    await prisma.user.delete({ where: { id } })
    res.json(ok(null, 'Usuário removido'))
  } catch (err) { next(err) }
})

export default router
