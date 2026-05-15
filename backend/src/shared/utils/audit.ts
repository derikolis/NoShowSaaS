import prisma from './prisma'

export async function audit(params: {
  tenantId: string
  userId?: string
  action: string
  entity: string
  entityId: string
  ip?: string
}) {
  await prisma.auditLog.create({ data: params }).catch(() => null) // não bloqueia a operação principal
}
