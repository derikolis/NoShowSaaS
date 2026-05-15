import { Router, Request, Response } from 'express'
import prisma from '../shared/utils/prisma'
import { notifyNextInWaitlist } from '../modules/waitlist/waitlist.service'
import { recalculateClientScore } from '../modules/risk-engine/risk.service'
import { sendWhatsApp } from '../modules/notifications/notification.service'
import { ok } from '../shared/types/api'

const router = Router()

// Extrai número limpo de "5511999999999@s.whatsapp.net"
export function extractPhone(remoteJid: string): string {
  return remoteJid.split('@')[0]
}

// Retorna true se for mensagem de grupo
export function isGroup(remoteJid: string): boolean {
  return remoteJid.endsWith('@g.us')
}

// Extrai texto da mensagem independente do tipo
export function extractText(message: Record<string, unknown>): string {
  if (!message) return ''
  // Texto simples
  if (typeof message.conversation === 'string') return message.conversation
  // Texto estendido
  const ext = message.extendedTextMessage as Record<string, unknown> | undefined
  if (ext && typeof ext.text === 'string') return ext.text
  // Resposta de botão
  const btnReply = message.buttonsResponseMessage as Record<string, unknown> | undefined
  if (btnReply) {
    if (typeof btnReply.selectedButtonId === 'string') return btnReply.selectedButtonId
    if (typeof btnReply.selectedDisplayText === 'string') return btnReply.selectedDisplayText
  }
  // Template button reply (Business API)
  const tplReply = message.templateButtonReplyMessage as Record<string, unknown> | undefined
  if (tplReply && typeof tplReply.selectedId === 'string') return tplReply.selectedId
  // Lista de opções
  const listReply = message.listResponseMessage as Record<string, unknown> | undefined
  if (listReply && typeof listReply.singleSelectReply === 'object') {
    const sr = listReply.singleSelectReply as Record<string, unknown>
    if (typeof sr.selectedRowId === 'string') return sr.selectedRowId
  }
  return ''
}

export function isConfirm(text: string): boolean {
  return /^(sim|1|btn_confirm|confirmar|confirm)/i.test(text)
}

export function isCancel(text: string): boolean {
  return /^(n[aã]o|nao|2|btn_cancel|cancelar|cancel)/i.test(text)
}

export function isReschedule(text: string): boolean {
  return /^(3|btn_reschedule|reagendar|reschedule)/i.test(text)
}

// Busca cliente pelo número, aceitando com ou sem código do país
async function findClientByPhone(phone: string) {
  const phoneWithoutCountry = phone.startsWith('55') ? phone.slice(2) : phone
  return prisma.client.findFirst({
    where: { phone: { in: [phone, phoneWithoutCountry, `55${phone}`] } },
  })
}

// POST /webhooks/whatsapp — recebe eventos da Evolution API
router.post('/whatsapp', async (req: Request, res: Response) => {
  // Responde imediatamente para a Evolution API não retentar
  res.json(ok(null))

  const event = req.body?.event as string | undefined

  // Só processa mensagens recebidas
  if (event && event !== 'messages.upsert') return

  const data = req.body?.data as Record<string, unknown> | undefined
  if (!data) return

  const key = data.key as Record<string, unknown> | undefined
  if (!key) return

  // Ignora mensagens enviadas pelo próprio bot
  if (key.fromMe === true) return

  const remoteJid = key.remoteJid as string | undefined
  if (!remoteJid || isGroup(remoteJid)) return

  const phone = extractPhone(remoteJid)
  const message = data.message as Record<string, unknown> | undefined
  if (!message) return

  const text = extractText(message).toLowerCase().trim()
  if (!text) return

  const client = await findClientByPhone(phone)
  if (!client) return

  // 1. Verifica lista de espera aguardando resposta
  const waitlistEntry = await prisma.waitlist.findFirst({
    where: { clientId: client.id, notifiedAt: { not: null }, acceptedAt: null },
    orderBy: { notifiedAt: 'desc' },
  })

  if (waitlistEntry) {
    if (isConfirm(text)) {
      await prisma.waitlist.update({ where: { id: waitlistEntry.id }, data: { acceptedAt: new Date() } })
      await prisma.appointment.create({
        data: {
          tenantId: waitlistEntry.tenantId,
          clientId: client.id,
          professionalId: waitlistEntry.professionalId ?? waitlistEntry.clientId,
          service: 'Reservado via lista de espera',
          scheduledAt: waitlistEntry.slot,
          status: 'confirmed',
          confirmedAt: new Date(),
          riskScore: 0,
        },
      })
      await sendWhatsApp(client.phone, '✅ Vaga confirmada! Você está agendado. Até lá!')
    } else {
      await sendWhatsApp(client.phone, 'Tudo bem! Caso queira entrar na lista novamente, entre em contato.')
    }
    return
  }

  // 2. Verifica agendamento pendente de confirmação
  const appointment = await prisma.appointment.findFirst({
    where: { clientId: client.id, status: 'scheduled', scheduledAt: { gte: new Date() } },
    orderBy: { scheduledAt: 'asc' },
  })

  if (!appointment) return

  if (isConfirm(text)) {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    })
    recalculateClientScore(appointment.tenantId, client.id).catch(() => null)
    await sendWhatsApp(client.phone, '✅ Presença confirmada! Te esperamos.')

  } else if (isCancel(text)) {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    })
    notifyNextInWaitlist(appointment.tenantId, appointment.scheduledAt, appointment.professionalId).catch(() => null)
    recalculateClientScore(appointment.tenantId, client.id).catch(() => null)
    await sendWhatsApp(client.phone, '❌ Agendamento cancelado. Caso queira remarcar, entre em contato.')

  } else if (isReschedule(text)) {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    })
    notifyNextInWaitlist(appointment.tenantId, appointment.scheduledAt, appointment.professionalId).catch(() => null)
    recalculateClientScore(appointment.tenantId, client.id).catch(() => null)
    await sendWhatsApp(client.phone, '🔄 Agendamento cancelado para reagendamento. Entre em contato ou acesse nossa plataforma para escolher um novo horário.')
  }
})

export default router
