import prisma from '../../shared/utils/prisma'
import { notificationQueue } from '../../jobs/queues'
import type { RiskLevel } from '../risk-engine/risk.service'

export type WhatsAppConfig = {
  apiUrl: string
  apiKey: string
  instance: string
}

async function addReminder(appointmentId: string, tenantId: string, type: string, delay: number) {
  await notificationQueue.add(type, { appointmentId, tenantId, type }, { delay })
  await prisma.notification.create({ data: { appointmentId, tenantId, type, channel: 'whatsapp', status: 'pending' } })
}

export async function scheduleReminders(appointmentId: string, tenantId: string, scheduledAt: Date) {
  return scheduleRiskBasedReminders(appointmentId, tenantId, scheduledAt, 'low')
}

export async function scheduleRiskBasedReminders(
  appointmentId: string,
  tenantId: string,
  scheduledAt: Date,
  level: RiskLevel,
) {
  const now = Date.now()
  const apptTime = scheduledAt.getTime()

  const delay24h = apptTime - now - 24 * 60 * 60 * 1000
  const delay2h  = apptTime - now -  2 * 60 * 60 * 1000

  if (delay24h > 0) await addReminder(appointmentId, tenantId, 'reminder_24h', delay24h)
  if (delay2h  > 0) await addReminder(appointmentId, tenantId, 'reminder_2h',  delay2h)

  if (level === 'medium' || level === 'high') {
    const delay4h = apptTime - now - 4 * 60 * 60 * 1000
    if (delay4h > 0) await addReminder(appointmentId, tenantId, 'confirmation_4h', delay4h)
  }

  if (level === 'high') {
    const delay6h = apptTime - now - 6 * 60 * 60 * 1000
    if (delay6h > 0) await addReminder(appointmentId, tenantId, 'confirmation_6h', delay6h)
  }
}

// Busca configurações do tenant; cai para env vars se não configurado
export async function getTenantWhatsAppConfig(tenantId: string): Promise<WhatsAppConfig | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { evolutionApiUrl: true, evolutionApiKey: true, evolutionInstance: true },
  })

  const apiUrl  = tenant?.evolutionApiUrl  ?? process.env.EVOLUTION_API_URL  ?? ''
  const apiKey  = tenant?.evolutionApiKey  ?? process.env.EVOLUTION_API_KEY  ?? ''
  const inst    = tenant?.evolutionInstance ?? process.env.EVOLUTION_INSTANCE ?? 'noshow'

  if (!apiUrl || !apiKey) return null
  return { apiUrl, apiKey, instance: inst }
}

export async function sendWhatsApp(phone: string, message: string, config?: WhatsAppConfig | null): Promise<void> {
  const cfg = config ?? {
    apiUrl:   process.env.EVOLUTION_API_URL  ?? '',
    apiKey:   process.env.EVOLUTION_API_KEY  ?? '',
    instance: process.env.EVOLUTION_INSTANCE ?? 'noshow',
  }

  if (!cfg.apiUrl || !cfg.apiKey) {
    console.log(`[WhatsApp simulado] Para ${phone}: ${message}`)
    return
  }

  const response = await fetch(`${cfg.apiUrl}/message/sendText/${cfg.instance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: cfg.apiKey },
    body: JSON.stringify({
      number: phone,
      options: { delay: 0 },
      textMessage: { text: message },
    }),
  })

  if (!response.ok) throw new Error(`Evolution API retornou ${response.status}`)
}

// Botões interativos só funcionam na API oficial do WhatsApp Business.
// Para WHATSAPP-BAILEYS (Evolution API), envia texto com as opções no rodapé.
export async function sendWhatsAppButtons(
  phone: string,
  _title: string,
  body: string,
  buttons: Array<{ id: string; label: string }>,
  config?: WhatsAppConfig | null,
): Promise<void> {
  const opts = buttons.map((b) => b.label).join('  ')
  await sendWhatsApp(phone, `${body}\n\n${opts}`, config)
}

export function buildReminderMessage(clientName: string, professionalName: string, scheduledAt: Date): string {
  const hora = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `Olá ${clientName}.\nVocê tem um agendamento amanhã às ${hora} com ${professionalName}.\nDeseja confirmar sua presença?`
}

export function buildConfirmationMessage(clientName: string, scheduledAt: Date, urgent: boolean): string {
  const hora = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const prefix = urgent ? '⚠️ CONFIRMAÇÃO NECESSÁRIA\n' : ''
  return `${prefix}Olá ${clientName}.\nSeu agendamento é hoje às ${hora}.\nPrecisamos da sua confirmação!`
}

export const APPOINTMENT_BUTTONS = [
  { id: 'btn_confirm', label: '✅ Confirmar' },
  { id: 'btn_cancel', label: '❌ Cancelar' },
  { id: 'btn_reschedule', label: '🔄 Reagendar' },
]

export const CONFIRM_ONLY_BUTTONS = [
  { id: 'btn_confirm', label: '✅ Confirmar' },
  { id: 'btn_cancel', label: '❌ Cancelar' },
]
