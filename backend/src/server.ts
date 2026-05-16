import app from './app'
import './jobs/notification.worker'
import { registerRecurringJobs } from './jobs/scheduler'

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET não definido. Defina a variável antes de iniciar o servidor.')
  process.exit(1)
}

const jwtExpiry = process.env.JWT_EXPIRES_IN ?? '7d'
const numericOnly = /^\d+$/.test(jwtExpiry)
if (numericOnly && parseInt(jwtExpiry) < 3600) {
  console.warn(`AVISO: JWT_EXPIRES_IN="${jwtExpiry}" parece ser segundos (${jwtExpiry}s). Use "7d", "24h" etc. para valores maiores.`)
}

const PORT = process.env.PORT ?? 4000

registerRecurringJobs().catch((err) => {
  console.error('[scheduler] Falha ao registrar jobs recorrentes:', err)
})

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})
