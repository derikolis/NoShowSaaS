import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { authMiddleware, requireRole } from '../../shared/middlewares/auth.middleware'
import prisma from '../../shared/utils/prisma'
import { ok, fail } from '../../shared/types/api'

const router = Router()
router.use(authMiddleware)

// Qualquer usuário autenticado pode buscar o próprio perfil
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.sub },
      select: { id: true, name: true, email: true, role: true },
    })
    res.json(ok(user))
  } catch (err) { next(err) }
})

router.use(requireRole('owner'))

// Métricas de agendamento por profissional (4 groupBy em paralelo, sem N+1)
router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)

    const [totalByPro, todayByPro, noShowByPro, confirmedByPro] = await Promise.all([
      prisma.appointment.groupBy({ by: ['professionalId'], where: { tenantId: req.tenantId }, _count: { _all: true } }),
      prisma.appointment.groupBy({ by: ['professionalId'], where: { tenantId: req.tenantId, scheduledAt: { gte: todayStart, lte: todayEnd } }, _count: { _all: true } }),
      prisma.appointment.groupBy({ by: ['professionalId'], where: { tenantId: req.tenantId, status: 'no_show' }, _count: { _all: true } }),
      prisma.appointment.groupBy({ by: ['professionalId'], where: { tenantId: req.tenantId, status: 'confirmed' }, _count: { _all: true } }),
    ])

    type GroupRow = { professionalId: string; _count: { _all: number } }
    const toMap = (rows: GroupRow[]) => new Map(rows.map(r => [r.professionalId, r._count._all]))
    const totalMap     = toMap(totalByPro)
    const todayMap     = toMap(todayByPro)
    const noShowMap    = toMap(noShowByPro)
    const confirmedMap = toMap(confirmedByPro)

    const users = await prisma.user.findMany({ where: { tenantId: req.tenantId }, select: { id: true } })
    const metrics = users.map(u => {
      const total     = totalMap.get(u.id) ?? 0
      const today     = todayMap.get(u.id) ?? 0
      const noShows   = noShowMap.get(u.id) ?? 0
      const confirmed = confirmedMap.get(u.id) ?? 0
      const concluded = noShows + confirmed
      return { userId: u.id, total, today, noShows, attendanceRate: concluded > 0 ? Math.round((confirmed / concluded) * 100) : null }
    })

    res.json(ok(metrics))
  } catch (err) { next(err) }
})

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.tenantId },
      select: { id: true, name: true, email: true, role: true, weekSchedule: true, photoUrl: true, createdAt: true },
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

const updateSchema = z.object({
  name:         z.string().min(2).optional(),
  email:        z.string().email().optional(),
  password:     z.string().min(6).optional(),
  role:         z.enum(['receptionist', 'employee']).optional(),
  weekSchedule: z.record(z.string(), z.array(z.object({ start: z.string(), end: z.string() }))).optional().nullable(),
  photoUrl:     z.string().optional().nullable(),
})

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id)
    const body = updateSchema.parse(req.body)

    const user = await prisma.user.findFirst({ where: { id, tenantId: req.tenantId } })
    if (!user) { res.status(404).json(fail('Usuário não encontrado')); return }
    if (user.role === 'owner') { res.status(400).json(fail('Não é possível editar o owner')); return }

    if (body.email && body.email !== user.email) {
      const conflict = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId: req.tenantId, email: body.email } },
      })
      if (conflict) { res.status(409).json(fail('Email já em uso')); return }
    }

    const data: Record<string, unknown> = {}
    if (body.name)                       data.name         = body.name
    if (body.email)                      data.email        = body.email
    if (body.role)                       data.role         = body.role
    if (body.password)                   data.passwordHash = await hash(body.password, 10)
    if (body.weekSchedule !== undefined) data.weekSchedule = body.weekSchedule
    if (body.photoUrl     !== undefined) data.photoUrl     = body.photoUrl

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, weekSchedule: true, photoUrl: true, createdAt: true },
    })
    res.json(ok(updated, 'Usuário atualizado'))
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
