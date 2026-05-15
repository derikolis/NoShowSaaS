import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { fail } from '../types/api'

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const messages = err.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    res.status(400).json(fail(`Dados inválidos: ${messages}`))
    return
  }

  console.error(err)
  res.status(500).json(fail('Erro interno do servidor'))
}
