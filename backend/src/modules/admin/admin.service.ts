import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../shared/utils/prisma'
import { JwtPayload } from '../../shared/types/jwt'
import { sendEmail } from '../../shared/utils/email'

export async function adminLogin(email: string, password: string) {
  if (email !== process.env.ADMIN_EMAIL) throw new Error('Credenciais inválidas')

  const hash = process.env.ADMIN_PASSWORD_HASH
  if (!hash) throw new Error('Credenciais inválidas')

  const valid = await bcrypt.compare(password, hash)
  if (!valid) throw new Error('Credenciais inválidas')

  const payload: JwtPayload = {
    sub: 'superadmin',
    tenantId: '',
    slug: '',
    role: 'superadmin',
    email,
    name: 'Super Admin',
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '12h' as any })
  return { token }
}

export async function getAdminStats() {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const [total, active, inactive, blocked, newThisMonth] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: 'active' } }),
    prisma.tenant.count({ where: { status: 'inactive' } }),
    prisma.tenant.count({ where: { status: 'blocked' } }),
    prisma.tenant.count({ where: { createdAt: { gte: startOfMonth } } }),
  ])

  return {
    totalTenants: total,
    activeTenants: active,
    inactiveTenants: inactive + blocked,
    newThisMonth,
  }
}

export async function listTenants() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      users: {
        where: { role: 'owner' },
        select: { email: true },
        take: 1,
      },
    },
  })

  return tenants.map(t => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    plan: t.plan,
    status: t.status,
    ownerEmail: t.users[0]?.email ?? '',
    createdAt: t.createdAt,
  }))
}

export async function createTenant(
  companyName: string,
  slug: string,
  ownerName: string,
  ownerEmail: string,
  ownerPassword: string,
) {
  const existing = await prisma.tenant.findUnique({ where: { slug } })
  if (existing) throw new Error('Slug já em uso')

  const passwordHash = await bcrypt.hash(ownerPassword, 10)

  await prisma.tenant.create({
    data: {
      name: companyName,
      slug,
      users: {
        create: { name: ownerName, email: ownerEmail, passwordHash, role: 'owner' },
      },
    },
  })
}

export async function updateTenantStatus(id: string, status: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id } })
  if (!tenant) throw new Error('Empresa não encontrada')

  await prisma.tenant.update({ where: { id }, data: { status } })
}

export async function getAuditLogs(filters: {
  tenantId?: string
  action?: string
  entity?: string
  dateFrom?: Date
  dateTo?: Date
  page?: number
  limit?: number
}) {
  const { tenantId, action, entity, dateFrom, dateTo, page = 1, limit = 50 } = filters

  const where = {
    ...(tenantId ? { tenantId } : {}),
    ...(action   ? { action }   : {}),
    ...(entity   ? { entity }   : {}),
    ...((dateFrom || dateTo) ? {
      createdAt: {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo   ? { lte: dateTo }   : {}),
      },
    } : {}),
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const tenantIds = [...new Set(logs.map(l => l.tenantId))]
  const userIds   = [...new Set(logs.map(l => l.userId).filter(Boolean) as string[])]

  const [tenants, users] = await Promise.all([
    prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } }),
    userIds.length > 0
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ])

  const tenantMap = new Map(tenants.map(t => [t.id, t.name]))
  const userMap   = new Map(users.map(u => [u.id, u.name]))

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    logs: logs.map(l => ({
      id:         l.id,
      tenantId:   l.tenantId,
      tenantName: tenantMap.get(l.tenantId) ?? '—',
      userId:     l.userId,
      userName:   l.userId ? (userMap.get(l.userId) ?? 'Sistema') : 'Sistema',
      action:     l.action,
      entity:     l.entity,
      entityId:   l.entityId,
      ip:         l.ip,
      createdAt:  l.createdAt,
    })),
  }
}

export async function updateTenantPlan(id: string, plan: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id } })
  if (!tenant) throw new Error('Empresa não encontrada')
  await prisma.tenant.update({ where: { id }, data: { plan } })
}

export async function broadcastToOwners(subject: string, message: string) {
  const owners = await prisma.user.findMany({
    where: { role: 'owner' },
    select: { email: true, name: true },
  })

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <p style="color:#1e293b;font-size:15px;line-height:1.6">${message.replace(/\n/g, '<br>')}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="color:#94a3b8;font-size:12px">Você recebe este e-mail pois é administrador de uma conta no sistema.</p>
    </div>`

  const results = await Promise.allSettled(
    owners.map(o => sendEmail(o.email, subject, html))
  )

  return {
    total:  owners.length,
    sent:   results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  }
}

export async function resetOwnerPassword(tenantId: string, newPassword: string) {
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: 'owner' },
  })
  if (!owner) throw new Error('Owner não encontrado')

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: owner.id }, data: { passwordHash } })
}

export async function deleteTenant(id: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id } })
  if (!tenant) throw new Error('Empresa não encontrada')

  // Deleta na ordem correta para respeitar foreign keys
  await prisma.notification.deleteMany({ where: { tenantId: id } })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).payment.deleteMany({ where: { tenantId: id } })
  await prisma.waitlist.deleteMany({ where: { tenantId: id } })
  await prisma.appointment.deleteMany({ where: { tenantId: id } })
  await prisma.client.deleteMany({ where: { tenantId: id } })
  await prisma.user.deleteMany({ where: { tenantId: id } })
  await prisma.service.deleteMany({ where: { tenantId: id } })
  await prisma.tenant.delete({ where: { id } })
}

export async function getTenantHealth() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      users: { where: { role: 'owner' }, select: { email: true }, take: 1 },
    },
  })

  const results = await Promise.all(tenants.map(async (t) => {
    const [
      totalClients,
      totalAppointments,
      appointmentsThisMonth,
      noShowCount,
      confirmedCount,
      completedCount,
      pendingCount,
      notificationsSent,
      lastAppt,
    ] = await Promise.all([
      prisma.client.count({ where: { tenantId: t.id } }),
      prisma.appointment.count({ where: { tenantId: t.id } }),
      prisma.appointment.count({ where: { tenantId: t.id, createdAt: { gte: startOfMonth } } }),
      prisma.appointment.count({ where: { tenantId: t.id, status: 'no_show' } }),
      prisma.appointment.count({ where: { tenantId: t.id, status: 'confirmed' } }),
      prisma.appointment.count({ where: { tenantId: t.id, status: 'completed' } }),
      prisma.appointment.count({ where: { tenantId: t.id, status: 'scheduled' } }),
      prisma.notification.count({ where: { tenantId: t.id, status: 'sent', sentAt: { gte: startOfMonth } } }),
      prisma.appointment.findFirst({
        where: { tenantId: t.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ])

    const concluded = noShowCount + confirmedCount + completedCount
    const noShowRate = concluded > 0 ? Math.round((noShowCount / concluded) * 100) : null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tAny = t as any

    return {
      id:         t.id,
      name:       t.name,
      slug:       t.slug,
      plan:       t.plan,
      status:     t.status,
      ownerEmail: t.users[0]?.email ?? '',
      createdAt:  t.createdAt,
      stats: {
        totalClients,
        totalAppointments,
        appointmentsThisMonth,
        noShowRate,
        pendingAppointments:        pendingCount,
        notificationsSentThisMonth: notificationsSent,
        lastActivityAt:             lastAppt?.createdAt ?? null,
      },
      config: {
        whatsappConfigured: !!(t.evolutionApiUrl && t.evolutionApiKey),
        reminderEnabled:    tAny.reminderEnabled ?? true,
        paymentConfigured:  !!(tAny.paymentProvider && (tAny.mpAccessToken || tAny.stripeSecretKey || tAny.abacatePayApiKey)),
      },
    }
  }))

  return results
}
