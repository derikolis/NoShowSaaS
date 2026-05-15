import app from './app'
import './jobs/notification.worker'
import { registerRecurringJobs } from './jobs/scheduler'

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET não definido. Defina a variável antes de iniciar o servidor.')
  process.exit(1)
}

const PORT = process.env.PORT ?? 4000

registerRecurringJobs().catch((err) => {
  console.error('[scheduler] Falha ao registrar jobs recorrentes:', err)
})

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})
