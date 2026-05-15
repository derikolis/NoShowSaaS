import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../../shared/middlewares/auth.middleware'
import { addToWaitlist, listWaitlist } from './waitlist.service'
import { ok, fail } from '../../shared/types/api'

const router = Router()
router.use(authMiddleware)

const addSchema = z.object({
  clientId: z.string().uuid(),
  slot: z.string().datetime(),
})

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slot = req.query.slot as string
    if (!slot) { res.status(400).json(fail('Parâmetro slot é obrigatório')); return }
    const list = await listWaitlist(req.tenantId, new Date(slot))
    res.json(ok(list))
  } catch (err) { next(err) }
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = addSchema.parse(req.body)
    const entry = await addToWaitlist(req.tenantId, body.clientId, new Date(body.slot))
    res.status(201).json(ok(entry, 'Adicionado à lista de espera'))
  } catch (err) { next(err) }
})

export default router
