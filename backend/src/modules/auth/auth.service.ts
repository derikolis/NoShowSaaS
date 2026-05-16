import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../shared/utils/prisma'
import { JwtPayload } from '../../shared/types/jwt'

export async function registerTenant(name: string, slug: string, ownerName: string, email: string, password: string) {
  const existing = await prisma.tenant.findUnique({ where: { slug } })
  if (existing) throw new Error('Slug já em uso')

  const passwordHash = await bcrypt.hash(password, 10)

  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      users: {
        create: { name: ownerName, email, passwordHash, role: 'owner' },
      },
    },
    include: { users: true },
  })

  return tenant
}

export async function login(email: string, password: string, tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
  if (!tenant) throw new Error('Empresa não encontrada')

  const user = await prisma.user.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email } } })
  if (!user) throw new Error('Credenciais inválidas')

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw new Error('Credenciais inválidas')

  const payload: JwtPayload = { sub: user.id, tenantId: tenant.id, role: user.role, email: user.email, name: user.name }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as any })

  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } }
}
