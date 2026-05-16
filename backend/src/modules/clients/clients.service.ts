import prisma from '../../shared/utils/prisma'
import { audit } from '../../shared/utils/audit'

export async function listClients(tenantId: string) {
  const [clients, lastVisits] = await Promise.all([
    prisma.client.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.appointment.groupBy({
      by: ['clientId'],
      where: { tenantId, status: 'confirmed' },
      _max: { scheduledAt: true },
    }),
  ])
  const lastVisitMap = new Map(lastVisits.map(lv => [lv.clientId, lv._max.scheduledAt]))
  return clients.map(c => ({ ...c, lastVisit: lastVisitMap.get(c.id) ?? null }))
}

export async function getClient(tenantId: string, clientId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, tenantId } })
  if (!client) throw new Error('Cliente não encontrado')
  return client
}

export async function createClient(tenantId: string, data: { name: string; phone: string; email?: string; consented: boolean }, userId?: string) {
  const client = await prisma.client.create({
    data: { name: data.name, phone: data.phone, email: data.email, tenantId, consentedAt: data.consented ? new Date() : null },
  })
  audit({ tenantId, userId, action: 'create', entity: 'client', entityId: client.id })
  return client
}

export async function updateClient(tenantId: string, clientId: string, data: { name?: string; phone?: string; email?: string; isVip?: boolean }) {
  const existing = await prisma.client.findFirst({ where: { id: clientId, tenantId } })
  if (!existing) throw new Error('Cliente não encontrado')
  return prisma.client.update({ where: { id: clientId }, data })
}

export async function getClientHistory(tenantId: string, clientId: string) {
  const [client, appointments] = await Promise.all([
    prisma.client.findFirst({ where: { id: clientId, tenantId } }),
    prisma.appointment.findMany({
      where: { tenantId, clientId },
      orderBy: { scheduledAt: 'desc' },
      select: { id: true, service: true, scheduledAt: true, status: true },
    }),
  ])
  if (!client) throw new Error('Cliente não encontrado')

  const total     = appointments.length
  const noShows   = appointments.filter(a => a.status === 'no_show').length
  const confirmed = appointments.filter(a => a.status === 'confirmed').length
  const concluded = noShows + confirmed
  const noShowRate = concluded > 0 ? Math.round((noShows / concluded) * 100) : null
  const lastVisit  = appointments.find(a => a.status === 'confirmed')?.scheduledAt ?? null

  return {
    recent: appointments.slice(0, 5),
    stats: { total, noShows, confirmed, noShowRate, lastVisit },
  }
}

export async function deleteClient(tenantId: string, clientId: string, userId?: string) {
  const existing = await prisma.client.findFirst({ where: { id: clientId, tenantId } })
  if (!existing) throw new Error('Cliente não encontrado')
  audit({ tenantId, userId, action: 'delete', entity: 'client', entityId: clientId })
  return prisma.client.delete({ where: { id: clientId } })
}
