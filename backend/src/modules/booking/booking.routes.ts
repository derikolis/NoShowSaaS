import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { hash, compare } from 'bcryptjs'
import { randomInt } from 'crypto'
import { Prisma } from '@prisma/client'
import prisma from '../../shared/utils/prisma'
import { ok, fail } from '../../shared/types/api'
import { createPixCharge } from '../payments/payments.service'
import { sendWhatsApp } from '../notifications/notification.service'
import { sendEmail } from '../../shared/utils/email'

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
      where: { slug: (req.params.slug as string) },
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

type DayPeriod    = { start: string; end: string }
type WeekSchedule = Record<string, DayPeriod[]>
const WEEK_KEYS   = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DEFAULT_DAY = [{ start: '08:00', end: '18:00' }]

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

router.get('/:slug/slots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, professionalId, duration } = req.query as Record<string, string>
    if (!date || !professionalId || !duration) {
      res.status(400).json(fail('Parâmetros obrigatórios: date, professionalId, duration')); return
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: (req.params.slug as string) },
      select: { id: true, status: true },
    })
    if (!tenant || tenant.status === 'blocked') {
      res.status(404).json(fail('Empresa não encontrada')); return
    }

    // Busca horários do profissional
    const professional = await prisma.user.findFirst({
      where: { id: professionalId, tenantId: tenant.id },
    }) as unknown as { weekSchedule: WeekSchedule | null } | null
    if (!professional) { res.json(ok([])); return }

    const schedule   = professional.weekSchedule ?? null
    const dayKey     = WEEK_KEYS[new Date(`${date}T12:00:00`).getDay()]
    const dayPeriods = schedule ? (schedule[dayKey] ?? []) : DEFAULT_DAY

    // Dia sem expediente → retorna vazio
    if (dayPeriods.length === 0) { res.json(ok([])); return }

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
    const dur     = Math.max(parseInt(duration) || 60, 15)
    const now     = new Date()
    const slots:  string[] = []

    for (const period of dayPeriods) {
      const start = toMinutes(period.start)
      const end   = toMinutes(period.end) - dur

      for (let m = start; m <= end; m += dur) {
        const slot = new Date(`${date}T00:00:00`)
        slot.setHours(Math.floor(m / 60), m % 60, 0, 0)
        if (slot <= now) continue
        if (takenMs.has(slot.getTime())) continue
        slots.push(slot.toISOString())
      }
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
      where: { slug: (req.params.slug as string) },
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

    res.json(ok({ name: found.name, hasAccount: !!(found as unknown as { passwordHash: string | null }).passwordHash }))
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
      where: { slug: (req.params.slug as string) },
      select: { id: true, status: true },
    })
    if (!tenant || tenant.status !== 'active') {
      res.status(404).json(fail('Empresa não encontrada')); return
    }

    const existing = await prisma.client.findFirst({
      where: { tenantId: tenant.id, phone: body.phone },
    })

    if ((existing as unknown as { passwordHash: string | null } | null)?.passwordHash) {
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
      where: { slug: (req.params.slug as string) },
      select: { id: true, status: true },
    })
    if (!tenant || tenant.status !== 'active') {
      res.status(404).json(fail('Empresa não encontrada')); return
    }

    const client = await prisma.client.findFirst({
      where: { tenantId: tenant.id, phone: body.phone },
    })

    type ClientWithHash = typeof client & { passwordHash: string | null }
    const clientTyped = client as ClientWithHash
    if (!clientTyped?.passwordHash) {
      res.status(401).json(fail('Conta não encontrada. Cadastre-se.')); return
    }

    const valid = await compare(body.password, clientTyped.passwordHash)
    if (!valid) {
      res.status(401).json(fail('Senha incorreta.')); return
    }

    const token = signClientToken(client!, tenant.id)
    res.json(ok({ token, client: { name: client!.name } }, 'Login realizado'))
  } catch (err) { next(err) }
})

// ── Solicitar reset de senha ─────────────────────────────────────────────────
router.post('/:slug/reset-request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      phone:  z.string().min(10),
      method: z.enum(['whatsapp', 'email']).default('whatsapp'),
    }).parse(req.body)

    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug as string },
      select: { id: true, status: true },
    })
    if (!tenant || tenant.status !== 'active') {
      res.status(404).json(fail('Empresa não encontrada')); return
    }

    const client = await prisma.client.findFirst({ where: { tenantId: tenant.id, phone: body.phone } })
    // Sempre retorna 200 para não revelar se o número existe
    if (!client || !(client as unknown as { passwordHash: string | null }).passwordHash) {
      res.json(ok(null, 'Se o número tiver cadastro, você receberá as instruções.')); return
    }

    // Invalida tokens anteriores
    await (prisma as any).passwordReset.updateMany({
      where: { clientId: client.id, usedAt: null },
      data: { usedAt: new Date() },
    })

    if (body.method === 'whatsapp') {
      const code      = String(randomInt(100000, 999999))
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min
      await (prisma as any).passwordReset.create({
        data: { clientId: client.id, tenantId: tenant.id, token: code, method: 'whatsapp', expiresAt },
      })
      await sendWhatsApp(client.phone, `*Kired — Redefinição de senha*\n\nSeu código de verificação é: *${code}*\n\nVálido por 10 minutos. Não compartilhe com ninguém.`).catch(() => null)
      res.json(ok({ method: 'whatsapp', hint: client.phone.slice(-4) }, 'Código enviado por WhatsApp.'))

    } else {
      if (!client.email) {
        res.status(400).json(fail('Nenhum e-mail cadastrado nessa conta.')); return
      }
      const token     = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1h
      await (prisma as any).passwordReset.create({
        data: { clientId: client.id, tenantId: tenant.id, token, method: 'email', expiresAt },
      })
      const frontendUrl = process.env.FRONTEND_URL?.split(',')[0] ?? 'https://kired.com.br'
      const link = `${frontendUrl}/agendar/${req.params.slug}?reset=${token}`
      await sendEmail(
        client.email,
        'Redefinição de senha — Kired',
        `<p>Olá, ${client.name}!</p>
         <p>Clique no link abaixo para redefinir sua senha. O link expira em 1 hora.</p>
         <p><a href="${link}">${link}</a></p>
         <p>Se não solicitou, ignore este e-mail.</p>`,
      ).catch(() => null)
      const hint = client.email.replace(/(.{2}).*(@.*)/, '$1***$2')
      res.json(ok({ method: 'email', hint }, 'Link enviado por e-mail.'))
    }
  } catch (err) { next(err) }
})

// ── Verificar código WhatsApp e trocar senha ──────────────────────────────────
router.post('/:slug/reset-verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      phone:       z.string().min(10),
      code:        z.string().min(6).max(6),
      newPassword: z.string().min(6),
    }).parse(req.body)

    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug as string },
      select: { id: true, status: true },
    })
    if (!tenant || tenant.status !== 'active') {
      res.status(404).json(fail('Empresa não encontrada')); return
    }

    const client = await prisma.client.findFirst({ where: { tenantId: tenant.id, phone: body.phone } })
    if (!client) { res.status(400).json(fail('Código inválido ou expirado.')); return }

    const reset = await (prisma as any).passwordReset.findFirst({
      where: { clientId: client.id, token: body.code, method: 'whatsapp', usedAt: null },
    })
    if (!reset || new Date(reset.expiresAt) < new Date()) {
      res.status(400).json(fail('Código inválido ou expirado.')); return
    }

    const passwordHash = await hash(body.newPassword, 10)
    await prisma.client.update({ where: { id: client.id }, data: { passwordHash } as any })
    await (prisma as any).passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } })

    const token = signClientToken(client, tenant.id)
    res.json(ok({ token, client: { name: client.name } }, 'Senha redefinida com sucesso.'))
  } catch (err) { next(err) }
})

// ── Confirmar reset via link de e-mail ────────────────────────────────────────
router.post('/:slug/reset-confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      resetToken:  z.string().min(1),
      newPassword: z.string().min(6),
    }).parse(req.body)

    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug as string },
      select: { id: true, status: true },
    })
    if (!tenant || tenant.status !== 'active') {
      res.status(404).json(fail('Empresa não encontrada')); return
    }

    const reset = await (prisma as any).passwordReset.findFirst({
      where: { tenantId: tenant.id, token: body.resetToken, method: 'email', usedAt: null },
    })
    if (!reset || new Date(reset.expiresAt) < new Date()) {
      res.status(400).json(fail('Link inválido ou expirado.')); return
    }

    const client = await prisma.client.findUnique({ where: { id: reset.clientId } })
    if (!client) { res.status(400).json(fail('Cliente não encontrado.')); return }

    const passwordHash = await hash(body.newPassword, 10)
    await prisma.client.update({ where: { id: client.id }, data: { passwordHash } as any })
    await (prisma as any).passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } })

    const token = signClientToken(client, tenant.id)
    res.json(ok({ token, client: { name: client.name } }, 'Senha redefinida com sucesso.'))
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
      where: { slug: (req.params.slug as string) },
      select: { id: true, status: true, paymentProvider: true, mpAccessToken: true, stripeSecretKey: true, abacatePayApiKey: true, paymentFlow: true, depositPercent: true },
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

    let appointment
    try {
      appointment = await prisma.appointment.create({
        data: { tenantId: tenant.id, clientId: client.id, professionalId: body.professionalId, service: service.name, scheduledAt, riskScore: client.riskScore },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        res.status(409).json(fail('Horário indisponível. Escolha outro horário.')); return
      }
      throw err
    }

    // Cobrança de depósito PIX (se configurado)
    type TenantPay = typeof tenant & {
      paymentProvider: string | null
      stripeSecretKey: string | null
      abacatePayApiKey: string | null
    }
    const tenantPay = tenant as unknown as TenantPay

    let paymentData: { pixQrCode: string; pixQrCodeBase64: string | null; amount: number } | null = null
    const provider = tenantPay.paymentProvider ?? 'mercadopago'
    const hasKey = provider === 'stripe'     ? !!tenantPay.stripeSecretKey
                 : provider === 'abacatepay' ? !!tenantPay.abacatePayApiKey
                 : !!tenantPay.mpAccessToken
    const needsDeposit = (tenantPay.paymentFlow === 'deposit' || tenantPay.paymentFlow === 'both')
      && hasKey && service.price && (tenantPay.depositPercent ?? 0) > 0

    if (needsDeposit) {
      try {
        const amount = Math.round((service.price! * (tenantPay.depositPercent! / 100)) * 100) / 100
        const payment = await createPixCharge({
          tenantId:      tenantPay.id,
          appointmentId: appointment.id,
          type:          'deposit',
          amount,
          description:   `Sinal — ${service.name}`,
          payerEmail:    client.email ?? 'cliente@kired.com.br',
          payerName:     client.name,
          provider,
          accessToken:   tenantPay.mpAccessToken    ?? undefined,
          stripeKey:     tenantPay.stripeSecretKey  ?? undefined,
          abacatePayKey: tenantPay.abacatePayApiKey ?? undefined,
        })
        paymentData = {
          pixQrCode:       payment.pixQrCode ?? '',
          pixQrCodeBase64: payment.pixQrCodeBase64 ?? null,
          amount,
        }
      } catch { /* ignora erro de pagamento — agendamento já foi criado */ }
    }

    res.status(201).json(ok({
      appointment: { id: appointment.id, service: service.name, professional: professional.name, scheduledAt: appointment.scheduledAt, duration: service.duration },
      client: { name: client.name, phone: client.phone },
      payment: paymentData,
    }, 'Agendamento realizado com sucesso'))
  } catch (err) { next(err) }
})

// ─── Portal do cliente (autenticado com token de cliente) ─────────────────────

function requireClientAuth(req: Request, res: Response): { clientId: string; tenantId: string } | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) { res.status(401).json(fail('Token não fornecido')); return null }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as {
      type: string; clientId: string; tenantId: string
    }
    if (payload.type !== 'client') { res.status(401).json(fail('Token inválido')); return null }
    return payload
  } catch {
    res.status(401).json(fail('Token expirado ou inválido'))
    return null
  }
}

// Lista agendamentos do cliente autenticado
router.get('/:slug/my/appointments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug as string },
      select: { id: true, status: true },
    })
    if (!tenant || tenant.status === 'blocked') { res.status(404).json(fail('Empresa não encontrada')); return }

    const auth = requireClientAuth(req, res)
    if (!auth || auth.tenantId !== tenant.id) return

    const appointments = await prisma.appointment.findMany({
      where: { clientId: auth.clientId, tenantId: tenant.id },
      orderBy: { scheduledAt: 'desc' },
      select: {
        id: true, service: true, professionalId: true,
        scheduledAt: true, status: true, createdAt: true,
      },
    })

    // Busca nomes dos profissionais em lote
    const profIds = [...new Set(appointments.map(a => a.professionalId))]
    const professionals = await prisma.user.findMany({
      where: { id: { in: profIds } },
      select: { id: true, name: true },
    })
    const profMap = Object.fromEntries(professionals.map(p => [p.id, p.name]))

    const result = appointments.map(a => ({
      ...a,
      professionalName: profMap[a.professionalId] ?? 'Profissional',
    }))

    res.json(ok(result))
  } catch (err) { next(err) }
})

// Cancela agendamento do cliente autenticado
router.patch('/:slug/my/appointments/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug as string },
      select: { id: true, status: true },
    })
    if (!tenant || tenant.status === 'blocked') { res.status(404).json(fail('Empresa não encontrada')); return }

    const auth = requireClientAuth(req, res)
    if (!auth || auth.tenantId !== tenant.id) return

    const appointment = await prisma.appointment.findFirst({
      where: { id: String(req.params.id), clientId: auth.clientId, tenantId: tenant.id },
    })
    if (!appointment) { res.status(404).json(fail('Agendamento não encontrado')); return }
    if (appointment.status === 'cancelled') { res.status(400).json(fail('Agendamento já cancelado')); return }
    if (new Date(appointment.scheduledAt) <= new Date()) {
      res.status(400).json(fail('Não é possível cancelar agendamentos passados')); return
    }

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    })

    res.json(ok(null, 'Agendamento cancelado'))
  } catch (err) { next(err) }
})

export default router
