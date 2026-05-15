import { JwtPayload } from './jwt'

declare global {
  namespace Express {
    interface Request {
      tenantId: string
      user: JwtPayload
    }
  }
}
