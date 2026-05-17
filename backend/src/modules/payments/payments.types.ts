export type ChargeOpts = {
  tenantId:      string
  appointmentId: string
  type:          'deposit' | 'no_show_fee'
  amount:        number
  description:   string
  payerEmail:    string
  payerName:     string
}

export type PixChargeResult = {
  pixQrCode:       string
  pixQrCodeBase64: string | null
  externalId:      string
}

export type NormalizedStatus = 'approved' | 'rejected' | 'cancelled' | 'pending'

// Campos de pagamento do Tenant (adicionados após geração do Prisma client)
export type TenantPaymentConfig = {
  id:                  string
  paymentProvider:     string | null
  paymentFlow:         string | null
  depositPercent:      number | null
  noShowFee:           number | null
  mpAccessToken:       string | null
  stripeSecretKey:     string | null
  stripeWebhookSecret: string | null
  abacatePayApiKey:    string | null
}
