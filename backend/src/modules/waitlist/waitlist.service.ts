import prisma from '../../shared/utils/prisma'
import { sendWhatsApp } from '../notifications/notification.service'

export async function addToWaitlist(tenantId: string, clientId: string, slot: Date) {
  const lastPosition = await prisma.waitlist.findFirst({
    where: { tenantId, slot },
    orderBy: { position: 'desc' },
  })

  return prisma.waitlist.create({
    data: { tenantId, clientId, slot, position: (lastPosition?.position ?? 0) + 1 },
  })
}

export async function notifyNextInWaitlist(tenantId: string, slot: Date) {
  const next = await prisma.waitlist.findFirst({
    where: { tenantId, slot, notifiedAt: null },
    orderBy: { position: 'asc' },
    include: { client: true },
  })

  if (!next) return null

  await prisma.waitlist.update({ where: { id: next.id }, data: { notifiedAt: new Date() } })

  const hora = slot.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const message = `Olá ${next.client.name}! Uma vaga abriu para o horário das ${hora}. Responda SIM para confirmar sua presença.`

  await sendWhatsApp(next.client.phone, message)

  return next
}

export async function acceptWaitlistSlot(tenantId: string, waitlistId: string) {
  const entry = await prisma.waitlist.findFirst({ where: { id: waitlistId, tenantId } })
  if (!entry) throw new Error('Entrada na lista de espera não encontrada')

  return prisma.waitlist.update({ where: { id: waitlistId }, data: { acceptedAt: new Date() } })
}

export async function listWaitlist(tenantId: string, slot: Date) {
  return prisma.waitlist.findMany({
    where: { tenantId, slot },
    include: { client: true },
    orderBy: { position: 'asc' },
  })
}
