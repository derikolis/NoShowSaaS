-- Garante que um profissional não pode ter dois agendamentos ativos no mesmo horário.
-- O índice exclui cancelamentos, então o mesmo slot pode ser reagendado.
CREATE UNIQUE INDEX IF NOT EXISTS "appointment_professional_slot_unique"
  ON "Appointment" ("professionalId", "scheduledAt")
  WHERE "status" != 'cancelled';
