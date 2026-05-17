import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware } from '../../shared/middlewares/auth.middleware'
import { ok, fail } from '../../shared/types/api'
import prisma from '../../shared/utils/prisma'
import { TenantPaymentConfig } from './payments.types'
import {
  processWebhookMercadoPago,
  processWebhookStripe,
  processWebhookAbacatePay,
} from './payments.service'

const router = Router()

// ─── Webhooks públicos (sem auth) ─────────────────────────────────────────────

// URL: /api/payments/webhook/mercadopago/:tenantId
// Tenant configura essa URL no painel do Mercado Pago
router.post('/webhook/mercadopago/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mpPaymentId = String(req.body?.data?.id ?? '')
    if (!mpPaymentId || mpPaymentId === 'undefined') { res.sendStatus(200); return }
    await processWebhookMercadoPago(mpPaymentId, String(req.params.tenantId))
    res.sendStatus(200)
  } catch (err) { next(err) }
})

// URL: /api/payments/webhook/stripe/:tenantId
// Tenant configura essa URL no painel do Stripe (Webhooks)
// Requer raw body — configurado em app.ts com express.raw()
router.post('/webhook/stripe/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = Array.isArray(req.headers['stripe-signature'])
      ? req.headers['stripe-signature'][0]
      : req.headers['stripe-signature']
    if (!signature) { res.sendStatus(400); return }

    const tenant = await prisma.tenant.findUnique({
      where: { id: String(req.params.tenantId) },
    }) as unknown as TenantPaymentConfig | null

    if (!tenant?.stripeSecretKey || !tenant?.stripeWebhookSecret) {
      res.sendStatus(400)
      return
    }

    await processWebhookStripe(
      req.body as Buffer,
      signature,
      tenant.stripeSecretKey,
      tenant.stripeWebhookSecret,
    )
    res.sendStatus(200)
  } catch (err) { next(err) }
})

// URL: /api/payments/webhook/abacatepay/:tenantId
// Tenant configura essa URL no painel do AbacatePay
router.post('/webhook/abacatepay/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
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
