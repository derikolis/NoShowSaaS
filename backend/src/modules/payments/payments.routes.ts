import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware } from '../../shared/middlewares/auth.middleware'
import { ok, fail } from '../../shared/types/api'
import prisma from '../../shared/utils/prisma'
import { processWebhook } from './payments.service'

const router = Router()

// ─── Webhook público (sem auth) ───────────────────────────────────────────────

router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // MP envia { action, data: { id } }
    const mpPaymentId = String(req.body?.data?.id ?? '')
    if (!mpPaymentId || mpPaymentId === 'undefined') { res.sendStatus(200); return }

    await processWebhook(mpPaymentId)
    res.sendStatus(200)
  } catch (err) { next(err) }
})

// ─── Rotas autenticadas ───────────────────────────────────────────────────────

router.use(authMiddleware)

// Status de pagamento de um agendamento
router.get('/appointment/:appointmentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appointmentId } = req.params

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId: req.tenantId },
    })
    if (!appointment) { res.status(404).json(fail('Agendamento não encontrado')); return }

    const payments = await prisma.payment.findMany({
      where: { appointmentId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, type: true, amount: true, status: true,
        pixQrCode: true, pixQrCodeBase64: true, createdAt: true, paidAt: true,
      },
    })

    res.json(ok(payments))
  } catch (err) { next(err) }
})

export default router
