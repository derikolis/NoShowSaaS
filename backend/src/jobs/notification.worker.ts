import { Worker } from 'bullmq'
import { connection } from './queues'
import prisma from '../shared/utils/prisma'
import {
  sendWhatsAppButtons,
  buildReminderMessage,
  buildConfirmationMessage,
  APPOINTMENT_BUTTONS,
  CONFIRM_ONLY_BUTTONS,
  getTenantWhatsAppConfig,
  getTenantTemplates,
} from '../modules/notifications/notification.service'
import { notifyNextInWaitlist } from '../modules/waitlist/waitlist.service'
import { recalculateClientScore } from '../modules/risk-engine/risk.service'

const worker = new Worker('notifications', async (job) => {
  const { appointmentId, tenantId, type } = job.data

  // Lembretes padrão (24h e 2h)
  if (type === 'reminder_24h' || type === 'reminder_2h') {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: { client: true },
    })
    if (!appointment || appointment.status === 'cancelled') return

    const [cfg, { reminderTemplate }] = await Promise.all([
      getTenantWhatsAppConfig(tenantId),
      getTenantTemplates(tenantId),
    ])
    const body = buildReminderMessage(appointment.client.name, appointment.professionalId, appointment.scheduledAt, reminderTemplate)
    await sendWhatsAppButtons(appointment.client.phone, 'Lembrete de Agendamento', body, APPOINTMENT_BUTTONS, cfg)

    await prisma.notification.updateMany({
      where: { appointmentId, type, status: 'pending' },
      data: { status: 'sent', sentAt: new Date() },
    })
  }

  // Confirmação extra para risco médio (4h antes)
  if (type === 'confirmation_4h') {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: { client: true },
    })
    if (!appointment || appointment.status !== 'scheduled') return

    const [cfg, { confirmationTemplate }] = await Promise.all([
      getTenantWhatsAppConfig(tenantId),
      getTenantTemplates(tenantId),
    ])
    const body = buildConfirmationMessage(appointment.client.name, appointment.scheduledAt, false, confirmationTemplate)
    await sendWhatsAppButtons(appointment.client.phone, 'Confirmação de Agendamento', body, CONFIRM_ONLY_BUTTONS, cfg)

    await prisma.notification.updateMany({
      where: { appointmentId, type, status: 'pending' },
      data: { status: 'sent', sentAt: new Date() },
    })
  }

  // Segunda confirmação para alto risco (6h antes — confirmação dupla)
  if (type === 'confirmation_6h') {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: { client: true },
    })
    if (!appointment || appointment.status !== 'scheduled') return

    const [cfg, { confirmationTemplate }] = await Promise.all([
      getTenantWhatsAppConfig(tenantId),
      getTenantTemplates(tenantId),
    ])
    const body = buildConfirmationMessage(appointment.client.name, appointment.scheduledAt, true, confirmationTemplate)
    await sendWhatsAppButtons(appointment.client.phone, '⚠️ Confirmação Urgente', body, CONFIRM_ONLY_BUTTONS, cfg)

    await prisma.notification.updateMany({
      where: { appointmentId, type, status: 'pending' },
      data: { status: 'sent', sentAt: new Date() },
    })
  }

  // Job recorrente: cancelar agendamentos não confirmados que já passaram
  if (type === 'cancel_unconfirmed') {
    const overdue = await prisma.appointment.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lt: new Date() },
      },
    })

    for (const appt of overdue) {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { status: 'no_show' },
      })
      recalculateClientScore(appt.tenantId, appt.clientId).catch(() => null)
    }

    if (overdue.length > 0) {
      console.log(`[jobs] ${overdue.length} agendamento(s) marcado(s) como no-show por não comparecimento`)
    }
  }

  // Job recorrente: recalcular score de todos os clientes
  if (type === 'recalc_all_scores') {
    const tenants = await prisma.tenant.findMany({ select: { id: true } })
    for (const tenant of tenants) {
      const clients = await prisma.client.findMany({ where: { tenantId: tenant.id }, select: { id: true } })
      for (const client of clients) {
        await recalculateClientScore(tenant.id, client.id)
      }
    }
    console.log('[jobs] Scores de clientes recalculados')
  }

  if (type === 'waitlist_notify') {
    const { slot } = job.data
    await notifyNextInWaitlist(tenantId, new Date(slot))
  }
}, { connection })

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} falhou:`, err.message)
})

export default worker
