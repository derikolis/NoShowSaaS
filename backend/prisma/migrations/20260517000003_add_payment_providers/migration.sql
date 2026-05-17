ALTER TABLE "Tenant"
  ADD COLUMN "paymentProvider"     TEXT,
  ADD COLUMN "stripeSecretKey"     TEXT,
  ADD COLUMN "stripeWebhookSecret" TEXT,
  ADD COLUMN "abacatePayApiKey"    TEXT;
