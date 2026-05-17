import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { authMiddleware, requireRole } from '../../shared/middlewares/auth.middleware'
import { ok, fail } from '../../shared/types/api'
import prisma from '../../shared/utils/prisma'
import { sendWhatsApp, getTenantWhatsAppConfig } from '../notifications/notification.service'

const router = Router()
router.use(authMiddleware)

const peakHourRangeSchema = z.object({
  start: z.number().int().min(0).max(23),
  end:   z.number().int().min(1).max(24),
})

const updateSchema = z.object({
  whatsappPhone:        z.string().optional().nullable(),
  evolutionApiUrl:      z.string().url('URL inválida').optional().nullable(),
  evolutionApiKey:      z.string().min(1).optional().nullable(),
  evolutionInstance:    z.string().min(1).optional().nullable(),
  reminderTemplate:     z.string().min(10, 'Template muito curto').optional().nullable(),
  confirmationTemplate: z.string().min(10, 'Template muito curto').optional().nullable(),
  peakHours:            z.array(peakHourRangeSchema).optional().nullable(),
})

function tenantFields(tenant: {
  name: string
  slug: string
  whatsappPhone: string | null
  evolutionApiUrl: string | null
  evolutionApiKey: string | null
  evolutionInstance: string | null
  reminderTemplate: string | null
  confirmationTemplate: string | null
  peakHours: unknown
}) {
  return {
    name:                 tenant.name,
    slug:                 tenant.slug,
    whatsappPhone:        tenant.whatsappPhone,
    evolutionApiUrl:      tenant.evolutionApiUrl,
    evolutionApiKey:      tenant.evolutionApiKey,
    evolutionInstance:    tenant.evolutionInstance,
    reminderTemplate:     tenant.reminderTemplate,
    confirmationTemplate: tenant.confirmationTemplate,
    peakHours:            tenant.peakHours,
  }
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: req.tenantId } })
    res.json(ok(tenantFields(tenant)))
  } catch (err) { next(err) }
})

router.put('/', requireRole('owner'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { peakHours, ...rest } = updateSchema.parse(req.body)
    const data: Prisma.TenantUpdateInput = {
      ...rest,
      ...(peakHours !== undefined && { peakHours: peakHours === null ? Prisma.DbNull : peakHours }),
    }
    const tenant = await prisma.tenant.update({ where: { id: req.tenantId }, data })
    res.json(ok(tenantFields(tenant), 'Configurações salvas'))
  } catch (err) { next(err) }
})

router.post('/test-whatsapp', requireRole('owner'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = z.object({ phone: z.string().min(10) }).parse(req.body)
    await sendWhatsApp(phone, '✅ Teste de conexão WhatsApp — No-Show SaaS. Integração funcionando!')
    res.json(ok(null, 'Mensagem de teste enviada'))
  } catch (err) {
    if (err instanceof Error) { res.status(400).json(fail(err.message)); return }
    next(err)
  }
})

// Status da conexão WhatsApp + número conectado
router.get('/whatsapp/status', requireRole('owner'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cfg = await getTenantWhatsAppConfig(req.tenantId)
    if (!cfg) { res.json(ok({ connected: false, state: 'not_configured', phone: null, profileName: null })); return }

    const [stateRes, instanceRes] = await Promise.all([
      fetch(`${cfg.apiUrl}/instance/connectionState/${cfg.instance}`, { headers: { apikey: cfg.apiKey } }),
      fetch(`${cfg.apiUrl}/instance/fetchInstances`, { headers: { apikey: cfg.apiKey } }),
    ])

    if (!stateRes.ok) { res.json(ok({ connected: false, state: 'unavailable', phone: null, profileName: null })); return }

    const stateData = await stateRes.json() as { instance?: { state?: string }; state?: string }
    const state: string = stateData?.instance?.state ?? stateData?.state ?? 'unknown'

    let phone: string | null = null
    let profileName: string | null = null
    if (instanceRes.ok) {
      const instances = await instanceRes.json() as Array<{ name: string; ownerJid?: string; profileName?: string; number?: string }>
      const found = Array.isArray(instances)
        ? instances.find((i) => i.name === cfg.instance)
        : instances
      if (found) {
        phone = found.number ?? found.ownerJid?.replace('@s.whatsapp.net', '') ?? null
        profileName = found.profileName ?? null
      }
    }

    res.json(ok({ connected: state === 'open', state, phone, profileName }))
  } catch (err) { next(err) }
})

// QR code para conectar
router.get('/whatsapp/qrcode', requireRole('owner'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cfg = await getTenantWhatsAppConfig(req.tenantId)
    if (!cfg) { res.status(400).json(fail('Evolution API não configurada')); return }

    const r = await fetch(`${cfg.apiUrl}/instance/connect/${cfg.instance}`, {
      headers: { apikey: cfg.apiKey },
    })
    if (!r.ok) { res.status(502).json(fail('Evolution API indisponível')); return }

    const data = await r.json() as { base64?: string; code?: string; count?: number }

    if (!data.base64 && !data.code) {
      res.status(202).json(ok(null, 'QR ainda não disponível, tente novamente em alguns segundos'))
      return
    }

    res.json(ok({ base64: data.base64 ?? null, code: data.code ?? null, count: data.count ?? 0 }))
  } catch (err) { next(err) }
})

// Desconectar WhatsApp
router.post('/whatsapp/disconnect', requireRole('owner'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cfg = await getTenantWhatsAppConfig(req.tenantId)
    if (!cfg) { res.status(400).json(fail('Evolution API não configurada')); return }

    await fetch(`${cfg.apiUrl}/instance/logout/${cfg.instance}`, {
      method: 'DELETE',
      headers: { apikey: cfg.apiKey },
    })
    res.json(ok(null, 'WhatsApp desconectado'))
  } catch (err) { next(err) }
})

export default router
