import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { hash, compare } from 'bcryptjs'
import prisma from '../../shared/utils/prisma'
import { ok, fail } from '../../shared/types/api'

const router = Router()

// Rota pública — sem authMiddleware

// ── Helper: gera token de sessão do cliente ──────────────────────────────────
function signClientToken(client: { id: string; name: string; phone: string }, tenantId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign(
    { type: 'client', clientId: client.id, tenantId, name: client.name, phone: client.phone },
    process.env.JWT_SECRET!,
    { expiresIn: '30d' } as any,
  )
}

// ── Info pública do tenant ───────────────────────────────────────────────────
router.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, name: true, status: true },
    })
    if (!tenant || tenant.status === 'blocked') {
      res.status(404).json(fail('Empresa não encontrada')); return
    }

    const [services, professionals] = await Promise.all([
      prisma.service.findMany({
        where: { tenantId: tenant.id, active: true },
        select: { id: true, name: true, description: true, duration: true, price: true },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        where: { tenantId: tenant.id, role: { in: ['owner', 'employee'] } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])

    res.json(ok({ tenant: { name: tenant.name }, services, professionals }))
  } catch (err) { next(err) }
})

// ── Horários disponíveis ─────────────────────────────────────────────────────
router.get('/:slug/slots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, professionalId, duration } = req.query as Record<string, string>
    if (!date || !professionalId || !duration) {
      res.status(400).json(fail('Parâmetros obrigatórios: date, professionalId, duration')); return
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, status: true },
    })
    if (!tenant || tenant.status === 'blocked') {
      res.status(404).json(fail('Empresa não encontrada')); return
    }

    const dayStart = new Date(`${date}T00:00:00`)
    const dayEnd   = new Date(`${date}T23:59:59`)

    const booked = await prisma.appointment.findMany({
      where: {
        tenantId: tenant.id,
        professionalId,
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['cancelled'] },
      },
      select: { scheduledAt: true },
    })

    const takenMs = new Set(booked.map(a => a.scheduledAt.getTime()))
    const dur = Math.max(parseInt(duration) || 60, 15)
    const now = new Date()
    const slots: string[] = []

    const START = 8 * 60
    const END   = 18 * 60 - dur

    for (let m = START; m <= END; m += dur) {
      const slot = new Date(`${date}T00:00:00`)
      slot.setHours(Math.floor(m / 60), m % 60, 0, 0)
      if (slot <= now) continue
      if (takenMs.has(slot.getTime())) continue
      slots.push(slot.toISOString())
    }

    res.json(ok(slots))
  } catch (err) { next(err) }
})

// ── Lookup: verifica se telefone já tem conta ────────────────────────────────
router.get('/:slug/client', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.query as { phone: string }
    if (!phone) { res.status(400).json(fail('Telefone obrigatório')); return }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, status: true },
    })
    if (!tenant || tenant.status === 'blocked') {
      res.status(404).json(fail('Empresa não encontrada')); return
    }

    const client = await prisma.client.findFirst({
      where: { tenantId: tenant.id, phone },
      select: { name: true, hasAccount: true },
    } as Parameters<typeof prisma.client.findFirst>[0])

    // Retorna se existe e se tem conta com senha
    const found = await prisma.client.findFirst({
      where: { tenantId: tenant.id, phone },
    })

    if (!found) { res.json(ok(null)); return }

    res.json(ok({ name: found.name, hasAccount: !!found.passwordHash }))
  } catch (err) { next(err) }
})

// ── Cadastro de novo cliente ─────────────────────────────────────────────────
router.post('/:slug/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      name:      z.string().min(2),
      phone:     z.string().min(10),
      password:  z.string().min(6),
      email:     z.string().optional(),
      consented: z.boolean(),
    }).parse(req.body)

    if (!body.consented) {
      res.status(400).json(fail('Consentimento LGPD obrigatório')); return
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, status: true },
    })
    if (!tenant || tenant.status !== 'active') {
      res.status(404).json(fail('Empresa não encontrada')); return
    }

    const existing = await prisma.client.findFirst({
      where: { tenantId: tenant.id, phone: body.phone },
    })

    if (existing?.passwordHash) {
      res.status(409).json(fail('Telefone já cadastrado. Faça login.')); return
    }

    const passwordHash = await hash(body.password, 10)
    let client

    if (existing) {
      // Cliente já existe no sistema (agendado manualmente) — só adiciona a senha
      client = await prisma.client.update({
        where: { id: existing.id },
        data: { passwordHash, name: body.name, email: body.email || null, consentedAt: new Date() },
      })
    } else {
      client = await prisma.client.create({
        data: {
          tenantId: tenant.id,
          name: body.name,
          phone: body.phone,
          email: body.email || null,
          consentedAt: new Date(),
          passwordHash,
          riskScore: 15,
        },
      })
    }

    const token = signClientToken(client, tenant.id)
    res.status(201).json(ok({ token, client: { name: client.name } }, 'Conta criada com sucesso'))
  } catch (err) { next(err) }
})

// ── Login do cliente ─────────────────────────────────────────────────────────
router.post('/:slug/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      phone:    z.string().min(10),
      password: z.string(),
    }).parse(req.body)

    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, status: true },
    })
    if (!tenant || tenant.status !== 'active') {
      res.status(404).json(fail('Empresa não encontrada')); return
    }

    const client = await prisma.client.findFirst({
      where: { tenantId: tenant.id, phone: body.phone },
    })

    if (!client?.passwordHash) {
      res.status(401).json(fail('Conta não encontrada. Cadastre-se.')); return
    }

    const valid = await compare(body.password, client.passwordHash)
    if (!valid) {
      res.status(401).json(fail('Senha incorreta.')); return
    }

    const token = signClientToken(client, tenant.id)
    res.json(ok({ token, client: { name: client.name } }, 'Login realizado'))
  } catch (err) { next(err) }
})

// ── Criar agendamento público ────────────────────────────────────────────────
router.post('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      serviceId:      z.string().uuid(),
      professionalId: z.string().uuid(),
      scheduledAt:    z.string(),
      clientToken:    z.string().optional(), // autenticado via portal
      name:           z.string().min(2).optional(),
      phone:          z.string().min(10).optional(),
      email:          z.string().optional(),
      consented:      z.boolean(),
    }).parse(req.body)

    if (!body.consented) {
      res.status(400).json(fail('Consentimento LGPD obrigatório')); return
    }
    if (!body.clientToken && (!body.name || !body.phone)) {
      res.status(400).json(fail('Nome e telefone obrigatórios')); return
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, status: true },
    })
    if (!tenant || tenant.status !== 'active') {
      res.status(404).json(fail('Empresa não encontrada ou inativa')); return
    }

    const [service, professional] = await Promise.all([
      prisma.service.findFirst({ where: { id: body.serviceId, tenantId: tenant.id, active: true } }),
      prisma.user.findFirst({ where: { id: body.professionalId, tenantId: tenant.id }, select: { id: true, name: true } }),
    ])

    if (!service)      { res.status(404).json(fail('Serviço não encontrado')); return }
    if (!professional) { res.status(404).json(fail('Profissional não encontrado')); return }

    const scheduledAt = new Date(body.scheduledAt)

    const conflict = await prisma.appointment.findFirst({
      where: { tenantId: tenant.id, professionalId: body.professionalId, scheduledAt, status: { notIn: ['cancelled'] } },
    })
    if (conflict) {
      res.status(409).json(fail('Horário indisponível. Escolha outro horário.')); return
    }

    // Resolve o cliente: via token ou via phone
    let client
    if (body.clientToken) {
      const payload = jwt.verify(body.clientToken, process.env.JWT_SECRET!) as { clientId: string; tenantId: string }
      if (payload.tenantId !== tenant.id) {
        res.status(403).json(fail('Token inválido')); return
      }
      client = await prisma.client.findUnique({ where: { id: payload.clientId } })
      if (!client) { res.status(404).json(fail('Cliente não encontrado')); return }
      // Atualiza consentimento
      await prisma.client.update({ where: { id: client.id }, data: { consentedAt: new Date() } })
    } else {
      client = await prisma.client.findFirst({ where: { tenantId: tenant.id, phone: body.phone! } })
      if (!client) {
        client = await prisma.client.create({
          data: { tenantId: tenant.id, name: body.name!, phone: body.phone!, email: body.email || null, consentedAt: new Date(), riskScore: 15 },
        })
      }
    }

    const appointment = await prisma.appointment.create({
      data: { tenantId: tenant.id, clientId: client.id, professionalId: body.professionalId, service: service.name, scheduledAt, riskScore: client.riskScore },
    })

    res.status(201).json(ok({
      appointment: { id: appointment.id, service: service.name, professional: professional.name, scheduledAt: appointment.scheduledAt, duration: service.duration },
      client: { name: client.name, phone: client.phone },
    }, 'Agendamento realizado com sucesso'))
  } catch (err) { next(err) }
})

export default router
