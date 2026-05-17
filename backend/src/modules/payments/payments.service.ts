import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago'
import prisma from '../../shared/utils/prisma'
import { sendWhatsApp } from '../notifications/notification.service'

// ─── MP Client factory ────────────────────────────────────────────────────────

function mpClient(accessToken: string) {
  return new MercadoPagoConfig({ accessToken })
}

// ─── Criar cobrança PIX ───────────────────────────────────────────────────────

export async function createPixCharge(opts: {
  tenantId:      string
  appointmentId: string
  type:          'deposit' | 'no_show_fee'
  amount:        number
  description:   string
  payerEmail:    string
  payerName:     string
  accessToken:   string
}) {
  const webhookUrl = `${process.env.BACKEND_URL ?? 'https://noshowsaas.onrender.com'}/api/payments/webhook`

  const client = mpClient(opts.accessToken)
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

  const payment = await prisma.payment.create({
    data: {
      tenantId:       opts.tenantId,
      appointmentId:  opts.appointmentId,
      mpPaymentId:    String(result.id),
      type:           opts.type,
      amount:         opts.amount,
      status:         'pending',
      pixQrCode:      pixData?.qr_code       ?? null,
      pixQrCodeBase64: pixData?.qr_code_base64 ?? null,
    },
  })

  return payment
}

// ─── Processar webhook do MP ──────────────────────────────────────────────────

export async function processWebhook(mpPaymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { mpPaymentId },
    include: {
      appointment: { include: { client: true } },
    },
  })
  if (!payment) return

  const tenant = await prisma.tenant.findUnique({ where: { id: payment.tenantId } })
  if (!tenant?.mpAccessToken) return

  const client  = mpClient(tenant.mpAccessToken)
  const mpPay   = new MPPayment(client)
  const result  = await mpPay.get({ id: mpPaymentId })
  const mpStatus = result.status // approved | rejected | cancelled | pending

  const now = new Date()
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: mpStatus ?? 'pending',
      paidAt: mpStatus === 'approved' ? now : null,
    },
  })

  if (mpStatus === 'approved' && payment.type === 'deposit') {
    await prisma.appointment.update({
      where: { id: payment.appointmentId },
      data: { status: 'confirmed', confirmedAt: now },
    })
  }
}

// ─── Cobrar taxa de no-show ───────────────────────────────────────────────────

export async function chargeNoShowFee(appointmentId: string, tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant?.mpAccessToken || !tenant.noShowFee || tenant.noShowFee <= 0) return null

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { client: true },
  })
  if (!appointment) return null

  const existing = await prisma.payment.findFirst({
    where: { appointmentId, type: 'no_show_fee' },
  })
  if (existing) return existing

  const payment = await createPixCharge({
    tenantId,
    appointmentId,
    type:        'no_show_fee',
    amount:      tenant.noShowFee,
    description: `Taxa de no-show — ${appointment.service}`,
    payerEmail:  appointment.client.email ?? 'cliente@kired.com.br',
    payerName:   appointment.client.name,
    accessToken: tenant.mpAccessToken,
  })

  // Envia PIX via WhatsApp se configurado
  if (appointment.client.phone && payment.pixQrCode) {
    const msg = `Olá ${appointment.client.name}, identificamos que você não compareceu ao seu agendamento de *${appointment.service}*.\n\nFoi gerada uma taxa de no-show de *R$ ${tenant.noShowFee.toFixed(2)}*.\n\nPague via PIX (copia e cola):\n\n${payment.pixQrCode}`
    sendWhatsApp(appointment.client.phone, msg).catch(() => null)
  }

  return payment
}
