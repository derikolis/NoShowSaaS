import prisma from '../../shared/utils/prisma'
import { audit } from '../../shared/utils/audit'

export async function listClients(tenantId: string) {
  return prisma.client.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
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

export async function deleteClient(tenantId: string, clientId: string, userId?: string) {
  const existing = await prisma.client.findFirst({ where: { id: clientId, tenantId } })
  if (!existing) throw new Error('Cliente não encontrado')
  audit({ tenantId, userId, action: 'delete', entity: 'client', entityId: clientId })
  return prisma.client.delete({ where: { id: clientId } })
}
