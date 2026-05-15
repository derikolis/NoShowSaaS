import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../../shared/middlewares/auth.middleware'
import { listClients, getClient, createClient, updateClient, deleteClient } from './clients.service'
import { ok, fail } from '../../shared/types/api'

const router = Router()
router.use(authMiddleware)

const createSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  consented: z.boolean({ message: 'Consentimento LGPD é obrigatório' }),
})

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional(),
  isVip: z.boolean().optional(),
})

// Leitura: todos os perfis autenticados
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clients = await listClients(req.tenantId)
    res.json(ok(clients))
  } catch (err) { next(err) }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await getClient(req.tenantId, String(req.params.id))
    res.json(ok(client))
  } catch (err) {
    if (err instanceof Error && err.message === 'Cliente não encontrado') {
      res.status(404).json(fail(err.message)); return
    }
    next(err)
  }
})

// Escrita: apenas owner e recepcionista
router.post('/', requireRole('owner', 'receptionist'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body)
    const client = await createClient(req.tenantId, body, req.user.sub)
    res.status(201).json(ok(client, 'Cliente criado com sucesso'))
  } catch (err) { next(err) }
})

router.put('/:id', requireRole('owner', 'receptionist'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateSchema.parse(req.body)
    const client = await updateClient(req.tenantId, String(req.params.id), body)
    res.json(ok(client, 'Cliente atualizado'))
  } catch (err) {
    if (err instanceof Error && err.message === 'Cliente não encontrado') {
      res.status(404).json(fail(err.message)); return
    }
    next(err)
  }
})

// Exclusão LGPD: apenas owner
router.delete('/:id', requireRole('owner'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteClient(req.tenantId, String(req.params.id), req.user.sub)
    res.json(ok(null, 'Dados do cliente removidos'))
  } catch (err) {
    if (err instanceof Error && err.message === 'Cliente não encontrado') {
      res.status(404).json(fail(err.message)); return
    }
    next(err)
  }
})

export default router
