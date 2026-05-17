import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../shared/utils/prisma'
import { JwtPayload } from '../../shared/types/jwt'

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
