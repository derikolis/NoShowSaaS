-- AlterTable Tenant: payment config
ALTER TABLE "Tenant"
  ADD COLUMN "mpAccessToken"  TEXT,
  ADD COLUMN "paymentFlow"    TEXT,
  ADD COLUMN "depositPercent" INTEGER,
  ADD COLUMN "noShowFee"      DOUBLE PRECISION;

-- CreateTable Payment
CREATE TABLE "Payment" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "appointmentId"   TEXT NOT NULL,
  "mpPaymentId"     TEXT,
  "type"            TEXT NOT NULL,
  "amount"          DOUBLE PRECISION NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "pixQrCode"       TEXT,
  "pixQrCodeBase64" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt"          TIMESTAMP(3),

  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_tenantId_fkey"      FOREIGN KEY ("tenantId")      REFERENCES "Tenant"("id")      ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Payment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
