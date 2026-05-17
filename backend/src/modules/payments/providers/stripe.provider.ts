// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeLib = require('stripe')
import { ChargeOpts, NormalizedStatus, PixChargeResult } from '../payments.types'

export async function charge(opts: ChargeOpts & { secretKey: string }): Promise<PixChargeResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripe = new StripeLib(opts.secretKey) as any

  const intent = await stripe.paymentIntents.create({
    amount:               Math.round(opts.amount * 100),
    currency:             'brl',
    payment_method_types: ['pix'],
    description:          opts.description,
    receipt_email:        opts.payerEmail,
    metadata:             { appointmentId: opts.appointmentId, type: opts.type },
  })

  // PIX QR code fica disponível em next_action após confirmação no frontend
  const pix = intent.next_action?.pix_display_qr_code as { data?: string; image_url_png?: string } | undefined

  return {
    pixQrCode:       pix?.data          ?? (intent.client_secret as string) ?? '',
    pixQrCodeBase64: pix?.image_url_png ?? null,
    externalId:      intent.id          as string,
  }
}

export type WebhookResult = { externalId: string; status: Extract<NormalizedStatus, 'approved' | 'rejected'> }

export function processWebhook(
  rawBody:       Buffer,
  signature:     string,
  secretKey:     string,
  webhookSecret: string,
): WebhookResult | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripe = new StripeLib(secretKey) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch {
    throw new Error('Stripe webhook signature inválida')
  }

  if (event.type === 'payment_intent.succeeded') {
    return { externalId: event.data.object.id as string, status: 'approved' }
  }
  if (event.type === 'payment_intent.payment_failed') {
    return { externalId: event.data.object.id as string, status: 'rejected' }
  }
  return null
}
