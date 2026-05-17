import prisma from '../../shared/utils/prisma'
import { sendWhatsApp } from '../notifications/notification.service'
import { ChargeOpts, PixChargeResult, TenantPaymentConfig } from './payments.types'
import * as mp          from './providers/mercadopago.provider'
import * as stripe      from './providers/stripe.provider'
import * as abacatepay  from './providers/abacatepay.provider'

export type { PixChargeResult }

// ─── Fachada de cobrança ──────────────────────────────────────────────────────

export async function createPixCharge(opts: ChargeOpts & {
  provider:       string
  accessToken?:   string
  stripeKey?:     string
  abacatePayKey?: string
}) {
  let result: PixChargeResult

  if (opts.provider === 'stripe' && opts.stripeKey) {
    result = await stripe.charge({ ...opts, secretKey: opts.stripeKey })
  } else if (opts.provider === 'abacatepay' && opts.abacatePayKey) {
    result = await abacatepay.charge({ ...opts, apiKey: opts.abacatePayKey })
  } else if (opts.accessToken) {
    result = await mp.charge({ ...opts, accessToken: opts.accessToken })
  } else {
    throw new Error('Nenhum provedor de pagamento configurado')
  }

  return (prisma as any).payment.create({
    data: {
      tenantId:        opts.tenantId,
      appointmentId:   opts.appointmentId,
      mpPaymentId:     result.externalId,
      type:            opts.type,
      amount:          opts.amount,
      status:          'pending',
      pixQrCode:       result.pixQrCode,
      pixQrCodeBase64: result.pixQrCodeBase64,
    },
  })
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export async function processWebhookMercadoPago(mpPaymentId: string, tenantId?: string) {
  const payment = await (prisma as any).payment.findFirst({
    where: { mpPaymentId, ...(tenantId ? { tenantId } : {}) },
  })
  if (!payment) return

  const tenant = await prisma.tenant.findUnique({ where: { id: payment.tenantId } }) as unknown as TenantPaymentConfig | null
  if (!tenant?.mpAccessToken) return

  const status = await mp.processWebhook(mpPaymentId, tenant.mpAccessToken)
  await _updatePaymentStatus(payment.id, status, payment.type, payment.appointmentId)
}

export async function processWebhookStripe(rawBody: Buffer, signature: string, secretKey: string, webhookSecret: string) {
  const result = stripe.processWebhook(rawBody, signature, secretKey, webhookSecret)
  if (!result) return

  const payment = await (prisma as any).payment.findFirst({ where: { mpPaymentId: result.externalId } })
  if (!payment) return

  await _updatePaymentStatus(payment.id, result.status, payment.type, payment.appointmentId)
}

export async function processWebhookAbacatePay(body: Parameters<typeof abacatepay.processWebhook>[0]) {
  const result = abacatepay.processWebhook(body)
  if (!result) return

  const payment = await (prisma as any).payment.findFirst({ where: { mpPaymentId: result.externalId } })
  if (!payment) return

  await _updatePaymentStatus(payment.id, result.status, payment.type, payment.appointmentId)
}

// ─── Taxa de no-show ──────────────────────────────────────────────────────────

export async function chargeNoShowFee(appointmentId: string, tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } }) as unknown as TenantPaymentConfig | null
  if (!tenant?.noShowFee || tenant.noShowFee <= 0) return null

  const provider = tenant.paymentProvider ?? 'mercadopago'
  const hasKey   =
    provider === 'stripe'     ? !!tenant.stripeSecretKey :
    provider === 'abacatepay' ? !!tenant.abacatePayApiKey :
    !!tenant.mpAccessToken

  if (!hasKey) return null

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { client: true },
  })
  if (!appointment) return null

  const existing = await (prisma as any).payment.findFirst({ where: { appointmentId, type: 'no_show_fee' } })
  if (existing) return existing

  const payment = await createPixCharge({
    tenantId,
    appointmentId,
    type:          'no_show_fee',
    amount:        tenant.noShowFee,
    description:   `Taxa de no-show — ${appointment.service}`,
    payerEmail:    appointment.client.email ?? 'cliente@kired.com.br',
    payerName:     appointment.client.name,
    provider,
    accessToken:   tenant.mpAccessToken    ?? undefined,
    stripeKey:     tenant.stripeSecretKey  ?? undefined,
    abacatePayKey: tenant.abacatePayApiKey ?? undefined,
  })

  if (appointment.client.phone && payment.pixQrCode) {
    const msg =
      `Olá ${appointment.client.name}, identificamos que você não compareceu ao seu agendamento de *${appointment.service}*.\n\n` +
      `Foi gerada uma taxa de no-show de *R$ ${tenant.noShowFee.toFixed(2)}*.\n\n` +
      `Pague via PIX (copia e cola):\n\n${payment.pixQrCode}`
    sendWhatsApp(appointment.client.phone, msg).catch(() => null)
  }

  return payment
}

// ─── Interno ──────────────────────────────────────────────────────────────────

async function _updatePaymentStatus(
  paymentId:     string,
  status:        string,
  type:          string,
  appointmentId: string,
) {
  const now = new Date()
  await (prisma as any).payment.update({
    where: { id: paymentId },
    data: { status, paidAt: status === 'approved' ? now : null },
  })

  if (status === 'approved' && type === 'deposit') {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data:  { status: 'confirmed', confirmedAt: now },
    })
  }
}
