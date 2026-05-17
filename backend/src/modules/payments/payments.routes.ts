import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware } from '../../shared/middlewares/auth.middleware'
import { ok, fail } from '../../shared/types/api'
import prisma from '../../shared/utils/prisma'
import {
  processWebhookMercadoPago,
  processWebhookStripe,
  processWebhookAbacatePay,
} from './payments.service'

const router = Router()

// ─── Webhooks públicos (sem auth) ─────────────────────────────────────────────

router.post('/webhook/mercadopago', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mpPaymentId = String(req.body?.data?.id ?? '')
    if (!mpPaymentId || mpPaymentId === 'undefined') { res.sendStatus(200); return }
    await processWebhookMercadoPago(mpPaymentId)
    res.sendStatus(200)
  } catch (err) { next(err) }
})

router.post('/webhook/stripe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['stripe-signature'] as string
    if (!signature) { res.sendStatus(400); return }

    // Busca o webhookSecret do tenant via header x-tenant-id (opcional) ou env
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''
    await processWebhookStripe(req.body as Buffer, signature, webhookSecret)
    res.sendStatus(200)
  } catch (err) { next(err) }
})

router.post('/webhook/abacatepay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await processWebhookAbacatePay(req.body)
    res.sendStatus(200)
  } catch (err) { next(err) }
})

// ─── Rotas autenticadas ───────────────────────────────────────────────────────

router.use(authMiddleware)

// Status de pagamento de um agendamento
router.get('/appointment/:appointmentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointmentId = String(req.params.appointmentId)
    const tenantId      = String(req.tenantId)

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
    })
    if (!appointment) { res.status(404).json(fail('Agendamento não encontrado')); return }

    const payments = await (prisma as any).payment.findMany({
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
