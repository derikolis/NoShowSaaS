-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "confirmationTemplate" TEXT,
ADD COLUMN     "peakHours" JSONB,
ADD COLUMN     "reminderTemplate" TEXT;
