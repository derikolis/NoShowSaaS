import app from './app'
import './jobs/notification.worker'
import { registerRecurringJobs } from './jobs/scheduler'

const PORT = process.env.PORT ?? 4000

registerRecurringJobs().catch((err) => {
  console.error('[scheduler] Falha ao registrar jobs recorrentes:', err)
})

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})
