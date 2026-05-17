import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago'
import Stripe from 'stripe'
import prisma from '../../shared/utils/prisma'
import { sendWhatsApp } from '../notifications/notification.service'

// ─── Types ────────────────────────────────────────────────────────────────────

// Campos de pagamento adicionados ao Tenant (schema atualizado, Prisma client
// não pode ser regenerado localmente sem DATABASE_URL)
type TenantWithPayment = {
  id:                  string
  mpAccessToken:       string | null
  stripeSecretKey:     string | null
  stripeWebhookSecret: string | null
  abacatePayApiKey:    string | null
  paymentProvider:     string | null
  paymentFlow:         string | null
  depositPercent:      number | null
  noShowFee:           number | null
}

type PaymentRow = {
  id:            string
  mpPaymentId:   string | null
  type:          string
  appointmentId: string
  tenantId:      string
  amount:        number
  status:        string
  pixQrCode:     string | null
  createdAt:     Date
}

export type PixChargeResult = {
  pixQrCode:       string
  pixQrCodeBase64: string | null
  externalId:      string  // ID do pagamento no provedor
}

type ChargeOpts = {
  tenantId:      string
  appointmentId: string
  type:          'deposit' | 'no_show_fee'
  amount:        number
  description:   string
  payerEmail:    string
  payerName:     string
}

// ─── Provider: Mercado Pago ───────────────────────────────────────────────────

async function chargeMercadoPago(opts: ChargeOpts & { accessToken: string }): Promise<PixChargeResult> {
  const webhookUrl = `${process.env.BACKEND_URL ?? 'https://noshowsaas.onrender.com'}/api/payments/webhook/mercadopago`
  const client = new MercadoPagoConfig({ accessToken: opts.accessToken })
  const mpPayment = new MPPayment(client)

  const result = await mpPayment.create({
    body: {
      transaction_amount:  opts.amount,
      description:         opts.description,
      payment_method_id:   'pix',
      payer: {
        email:      opts.payerEmail,
        first_name: opts.payerName.split(' ')[0],
        last_name:  opts.payerName.split(' ').slice(1).join(' ') || opts.payerName.split(' ')[0],
      },
      notification_url: webhookUrl,
    },
  })

  const pixData = result.point_of_interaction?.transaction_data
  return {
    pixQrCode:       pixData?.qr_code        ?? '',
    pixQrCodeBase64: pixData?.qr_code_base64 ?? null,
    externalId:      String(result.id),
  }
}

// ─── Provider: Stripe ─────────────────────────────────────────────────────────

async function chargeStripe(opts: ChargeOpts & { secretKey: string }): Promise<PixChargeResult> {
  const stripe = new Stripe(opts.secretKey)

  const intent = await stripe.paymentIntents.create({
    amount:               Math.round(opts.amount * 100), // centavos
    currency:             'brl',
    payment_method_types: ['pix'],
    description:          opts.description,
    receipt_email:        opts.payerEmail,
    metadata:             { appointmentId: opts.appointmentId, type: opts.type },
  })

  // PIX data vem em next_action após confirmar. Para Stripe, o QR code
  // é gerado após confirmar o PaymentIntent. Aqui retornamos o client_secret
  // para o frontend confirmar e exibir o QR.
  // NOTA: em produção, confirme com stripe.paymentIntents.confirm() ou use
  // o Stripe.js no frontend para exibir o QR nativo.
  const pix = (intent as unknown as { next_action?: { pix_display_qr_code?: { data?: string; image_url_png?: string } } })
    .next_action?.pix_display_qr_code

  return {
    pixQrCode:       pix?.data        ?? intent.client_secret ?? '',
    pixQrCodeBase64: pix?.image_url_png ?? null,
    externalId:      intent.id,
  }
}

// ─── Provider: AbacatePay ─────────────────────────────────────────────────────
// Documentação: https://abacatepay.readme.io/reference
// ATENÇÃO: confirme os endpoints na sua conta — a API pode ter atualizações.

async function chargeAbacatePay(opts: ChargeOpts & { apiKey: string }): Promise<PixChargeResult> {
  const webhookUrl = `${process.env.BACKEND_URL ?? 'https://noshowsaas.onrender.com'}/api/payments/webhook/abacatepay`

  const res = await fetch('https://api.abacatepay.com/v1/billing/create', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      frequency: 'ONE_TIME',
      methods:   ['PIX'],
      products:  [{
        externalId: opts.appointmentId,
        name:       opts.description,
        quantity:   1,
        price:      Math.round(opts.amount * 100), // centavos
      }],
      customer: {
        name:  opts.payerName,
        email: opts.payerEmail,
      },
      metadata: {
        appointmentId: opts.appointmentId,
        type:          opts.type,
        tenantId:      opts.tenantId,
      },
      webhookUrl,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AbacatePay error: ${err}`)
  }

  const json = await res.json() as {
    data?: { id?: string; url?: string; pixQrCode?: string; pixQrCodeBase64?: string }
  }
  const data = json.data ?? {}

  return {
    pixQrCode:       data.pixQrCode       ?? data.url ?? '',
    pixQrCodeBase64: data.pixQrCodeBase64 ?? null,
    externalId:      data.id              ?? '',
  }
}

// ─── Fachada principal ────────────────────────────────────────────────────────

export async function createPixCharge(opts: ChargeOpts & {
  accessToken?:    string   // Mercado Pago
  stripeKey?:      string   // Stripe
  abacatePayKey?:  string   // AbacatePay
  provider:        string
}) {
  let result: PixChargeResult

  if (opts.provider === 'stripe' && opts.stripeKey) {
    result = await chargeStripe({ ...opts, secretKey: opts.stripeKey })
  } else if (opts.provider === 'abacatepay' && opts.abacatePayKey) {
    result = await chargeAbacatePay({ ...opts, apiKey: opts.abacatePayKey })
  } else if (opts.accessToken) {
    result = await chargeMercadoPago({ ...opts, accessToken: opts.accessToken })
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

export async function processWebhookMercadoPago(mpPaymentId: string) {
  const payment = await (prisma as any).payment.findFirst({
    where: { mpPaymentId },
    include: { appointment: { include: { client: true } } },
  })
  if (!payment) return

  const tenant = await prisma.tenant.findUnique({ where: { id: payment.tenantId } }) as unknown as TenantWithPayment | null
  if (!tenant?.mpAccessToken) return

  const client  = new MercadoPagoConfig({ accessToken: tenant.mpAccessToken! })
  const mpPay   = new MPPayment(client)
  const result  = await mpPay.get({ id: mpPaymentId })
  await _updatePaymentStatus(payment.id, result.status ?? 'pending', payment.type, payment.appointmentId)
}

export async function processWebhookStripe(rawBody: Buffer, signature: string, webhookSecret: string) {
  const stripe = new Stripe(webhookSecret)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch {
    throw new Error('Stripe webhook signature inválida')
  }

  if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
    const intent  = event.data.object as { id: string }
    const payment = await (prisma as any).payment.findFirst({ where: { mpPaymentId: intent.id } })
    if (!payment) return

    const status = event.type === 'payment_intent.succeeded' ? 'approved' : 'rejected'
    await _updatePaymentStatus(payment.id, status, payment.type, payment.appointmentId)
  }
}

export async function processWebhookAbacatePay(body: { event?: string; data?: { billing?: { id?: string; status?: string } } }) {
  const billingId = body.data?.billing?.id
  const status    = body.data?.billing?.status // PAID | EXPIRED | CANCELLED
  if (!billingId) return

  const payment = await (prisma as any).payment.findFirst({ where: { mpPaymentId: billingId } })
  if (!payment) return

  const mapped = status === 'PAID' ? 'approved' : status === 'EXPIRED' ? 'cancelled' : 'rejected'
  await _updatePaymentStatus(payment.id, mapped, payment.type, payment.appointmentId)
}

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
      data: { status: 'confirmed', confirmedAt: now },
    })
  }
}

// ─── Taxa de no-show ──────────────────────────────────────────────────────────

export async function chargeNoShowFee(appointmentId: string, tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } }) as unknown as TenantWithPayment | null
  if (!tenant || !tenant.noShowFee || tenant.noShowFee <= 0) return null

  const provider = tenant.paymentProvider ?? 'mercadopago'
  const hasKey   = provider === 'stripe'      ? !!tenant.stripeSecretKey
                 : provider === 'abacatepay'  ? !!tenant.abacatePayApiKey
                 : !!tenant.mpAccessToken

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
    type:           'no_show_fee',
    amount:         tenant.noShowFee,
    description:    `Taxa de no-show — ${appointment.service}`,
    payerEmail:     appointment.client.email ?? 'cliente@kired.com.br',
    payerName:      appointment.client.name,
    provider,
    accessToken:    tenant.mpAccessToken    ?? undefined,
    stripeKey:      tenant.stripeSecretKey  ?? undefined,
    abacatePayKey:  tenant.abacatePayApiKey ?? undefined,
  })

  if (appointment.client.phone && payment.pixQrCode) {
    const msg = `Olá ${appointment.client.name}, identificamos que você não compareceu ao seu agendamento de *${appointment.service}*.\n\nFoi gerada uma taxa de no-show de *R$ ${tenant.noShowFee.toFixed(2)}*.\n\nPague via PIX (copia e cola):\n\n${payment.pixQrCode}`
    sendWhatsApp(appointment.client.phone, msg).catch(() => null)
  }

  return payment
}
