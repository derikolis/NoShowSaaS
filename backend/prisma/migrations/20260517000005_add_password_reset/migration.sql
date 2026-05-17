CREATE TABLE "PasswordReset" (
  "id"        TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "clientId"  TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "token"     TEXT NOT NULL UNIQUE,
  "method"    TEXT NOT NULL,           -- whatsapp | email
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "password_reset_client_idx" ON "PasswordReset"("clientId");
