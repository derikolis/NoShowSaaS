import prisma from '../../shared/utils/prisma'
import { calculateScore, recalculateClientScore, classifyRisk } from '../risk-engine/risk.service'
import { scheduleReminders, scheduleRiskBasedReminders } from '../notifications/notification.service'
import { notifyNextInWaitlist } from '../waitlist/waitlist.service'
import { audit } from '../../shared/utils/audit'

export async function listAppointments(tenantId: string, filters?: { status?: string; professionalId?: string }) {
  return prisma.appointment.findMany({
    where: { tenantId, ...filters },
    include: { client: true },
    orderBy: { scheduledAt: 'asc' },
  })
}

export async function getAppointment(tenantId: string, id: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id, tenantId },
    include: { client: true, notifications: true },
  })
  if (!appointment) throw new Error('Agendamento não encontrado')
  return appointment
}

export async function createAppointment(tenantId: string, data: {
  clientId: string
  professionalId: string
  service: string
  scheduledAt: Date
}, userId?: string) {
  const { score, level } = await calculateScore(tenantId, data.clientId, data.scheduledAt)

  // Bloqueia alto risco em horário de pico
  const isPeak = (h: number) => (h >= 12 && h < 14) || (h >= 18 && h < 20)
  if (level === 'high' && isPeak(data.scheduledAt.getHours())) {
    throw new Error('BLOCKED_HIGH_RISK_PEAK: Cliente com alto risco não pode ser agendado em horário de pico')
  }

  const appointment = await prisma.appointment.create({
    data: { ...data, tenantId, riskScore: score },
    include: { client: true },
  })

  await scheduleRiskBasedReminders(appointment.id, tenantId, appointment.scheduledAt, level)
  audit({ tenantId, userId, action: 'create', entity: 'appointment', entityId: appointment.id })

  return appointment
}

export async function cancelAppointment(tenantId: string, id: string) {
  const existing = await prisma.appointment.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Agendamento não encontrado')

  const cancelled = await prisma.appointment.update({
    where: { id },
    data: { status: 'cancelled', cancelledAt: new Date() },
  })

  notifyNextInWaitlist(tenantId, existing.scheduledAt).catch(() => null)
  audit({ tenantId, action: 'cancel', entity: 'appointment', entityId: id })

  return cancelled
}

export async function confirmAppointment(tenantId: string, id: string) {
  const existing = await prisma.appointment.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Agendamento não encontrado')

  const confirmed = await prisma.appointment.update({
    where: { id },
    data: { status: 'confirmed', confirmedAt: new Date() },
  })
  audit({ tenantId, action: 'confirm', entity: 'appointment', entityId: id })
  return confirmed
}

export async function rescheduleAppointment(tenantId: string, id: string, newScheduledAt: Date) {
  const existing = await prisma.appointment.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Agendamento não encontrado')
  if (existing.status === 'cancelled' || existing.status === 'no_show') {
    throw new Error('Não é possível reagendar um agendamento cancelado ou no-show')
  }

  const { score } = await calculateScore(tenantId, existing.clientId, newScheduledAt)

  const updated = await prisma.appointment.update({
    where: { id },
    data: { scheduledAt: newScheduledAt, status: 'scheduled', confirmedAt: null, riskScore: score },
    include: { client: true },
  })

  // Agenda novos lembretes para o novo horário (os antigos dispararão mas o status será ignorado se cancelados)
  await scheduleReminders(id, tenantId, newScheduledAt)

  return updated
}

export async function markNoShow(tenantId: string, id: string) {
  const existing = await prisma.appointment.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Agendamento não encontrado')

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: 'no_show' },
  })

  // Recalcula score do cliente com base no histórico atualizado
  recalculateClientScore(tenantId, existing.clientId).catch(() => null)
  audit({ tenantId, action: 'no_show', entity: 'appointment', entityId: id })

  return updated
}
