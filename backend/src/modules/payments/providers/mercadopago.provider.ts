import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago'
import { ChargeOpts, NormalizedStatus, PixChargeResult } from '../payments.types'

const BACKEND_URL = process.env.BACKEND_URL ?? 'https://noshowsaas.onrender.com'

export async function charge(opts: ChargeOpts & { accessToken: string }): Promise<PixChargeResult> {
  const client    = new MercadoPagoConfig({ accessToken: opts.accessToken })
  const mpPayment = new MPPayment(client)

  const result = await mpPayment.create({
    body: {
      transaction_amount: opts.amount,
      description:        opts.description,
      payment_method_id:  'pix',
      payer: {
        email:      opts.payerEmail,
        first_name: opts.payerName.split(' ')[0],
        last_name:  opts.payerName.split(' ').slice(1).join(' ') || opts.payerName.split(' ')[0],
      },
      notification_url: `${BACKEND_URL}/api/payments/webhook/mercadopago/${opts.tenantId}`,
    },
  })

  const pixData = result.point_of_interaction?.transaction_data
  return {
    pixQrCode:       pixData?.qr_code        ?? '',
    pixQrCodeBase64: pixData?.qr_code_base64 ?? null,
    externalId:      String(result.id),
  }
}

export async function processWebhook(mpPaymentId: string, accessToken: string): Promise<NormalizedStatus> {
  const client = new MercadoPagoConfig({ accessToken })
  const mpPay  = new MPPayment(client)
  const result = await mpPay.get({ id: mpPaymentId })

  if (result.status === 'approved')                              return 'approved'
  if (result.status === 'rejected' || result.status === 'cancelled') return 'rejected'
  return 'pending'
}
