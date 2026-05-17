import { ChargeOpts, NormalizedStatus, PixChargeResult } from '../payments.types'

const BACKEND_URL = process.env.BACKEND_URL ?? 'https://noshowsaas.onrender.com'

export async function charge(opts: ChargeOpts & { apiKey: string }): Promise<PixChargeResult> {
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
        price:      Math.round(opts.amount * 100),
      }],
      customer: { name: opts.payerName, email: opts.payerEmail },
      metadata: { appointmentId: opts.appointmentId, type: opts.type, tenantId: opts.tenantId },
      webhookUrl: `${BACKEND_URL}/api/payments/webhook/abacatepay/${opts.tenantId}`,
    }),
  })

  if (!res.ok) throw new Error(`AbacatePay error: ${await res.text()}`)

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

type AbacateWebhookBody = {
  event?: string
  data?:  { billing?: { id?: string; status?: string } }
}

export type WebhookResult = { externalId: string; status: NormalizedStatus }

export function processWebhook(body: AbacateWebhookBody): WebhookResult | null {
  const billingId = body.data?.billing?.id
  const rawStatus = body.data?.billing?.status
  if (!billingId) return null

  const status: NormalizedStatus =
    rawStatus === 'PAID'    ? 'approved'  :
    rawStatus === 'EXPIRED' ? 'cancelled' : 'rejected'

  return { externalId: billingId, status }
}
