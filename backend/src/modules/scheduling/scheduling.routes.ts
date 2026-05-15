import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../../shared/middlewares/auth.middleware'
import { listAppointments, getAppointment, createAppointment, cancelAppointment, confirmAppointment, markNoShow, rescheduleAppointment } from './scheduling.service'
import { ok, fail } from '../../shared/types/api'

const router = Router()
router.use(authMiddleware)

const createSchema = z.object({
  clientId: z.string().uuid(),
  professionalId: z.string().uuid(),
  service: z.string().min(1),
  scheduledAt: z.string().datetime(),
})

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined
    // Funcionário vê apenas sua própria agenda
    const professionalId = req.user.role === 'employee'
      ? req.user.sub
      : req.query.professionalId as string | undefined
    const appointments = await listAppointments(req.tenantId, { status, professionalId })
    res.json(ok(appointments))
  } catch (err) { next(err) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await getAppointment(req.tenantId, String(req.params.id))
    res.json(ok(appointment))
  } catch (err) {
    if (err instanceof Error && err.message === 'Agendamento não encontrado') {
      res.status(404).json(fail(err.message)); return
    }
    next(err)
  }
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body)
    const appointment = await createAppointment(req.tenantId, { ...body, scheduledAt: new Date(body.scheduledAt) }, req.user.sub)
    res.status(201).json(ok(appointment, 'Agendamento criado'))
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('BLOCKED_HIGH_RISK_PEAK')) {
      res.status(422).json(fail('Cliente com alto risco não pode ser agendado em horário de pico'))
      return
    }
    next(err)
  }
})

router.patch('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await cancelAppointment(req.tenantId, String(req.params.id))
    res.json(ok(appointment, 'Agendamento cancelado'))
  } catch (err) {
    if (err instanceof Error && err.message === 'Agendamento não encontrado') {
      res.status(404).json(fail(err.message)); return
    }
    next(err)
  }
})

router.patch('/:id/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await confirmAppointment(req.tenantId, String(req.params.id))
    res.json(ok(appointment, 'Agendamento confirmado'))
  } catch (err) {
    if (err instanceof Error && err.message === 'Agendamento não encontrado') {
      res.status(404).json(fail(err.message)); return
    }
    next(err)
  }
})

router.patch('/:id/reschedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scheduledAt } = z.object({ scheduledAt: z.string().datetime() }).parse(req.body)
    const appointment = await rescheduleAppointment(req.tenantId, String(req.params.id), new Date(scheduledAt))
    res.json(ok(appointment, 'Agendamento reagendado'))
  } catch (err) {
    if (err instanceof Error && err.message.includes('não encontrado')) {
      res.status(404).json(fail(err.message)); return
    }
    if (err instanceof Error && err.message.includes('Não é possível')) {
      res.status(400).json(fail(err.message)); return
    }
    next(err)
  }
})

router.patch('/:id/no-show', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await markNoShow(req.tenantId, String(req.params.id))
    res.json(ok(appointment, 'Marcado como no-show'))
  } catch (err) {
    if (err instanceof Error && err.message === 'Agendamento não encontrado') {
      res.status(404).json(fail(err.message)); return
    }
    next(err)
  }
})

export default router
