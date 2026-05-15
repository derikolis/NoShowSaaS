import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware } from '../../shared/middlewares/auth.middleware'
import { getDashboardStats } from './dashboard.service'
import { ok } from '../../shared/types/api'

const router = Router()
router.use(authMiddleware)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getDashboardStats(req.tenantId)
    res.json(ok(stats))
  } catch (err) { next(err) }
})

export default router
