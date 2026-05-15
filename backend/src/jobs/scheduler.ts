import { notificationQueue } from './queues'

export async function registerRecurringJobs() {
  await notificationQueue.add(
    'cancel_unconfirmed',
    { type: 'cancel_unconfirmed' },
    {
      repeat: { pattern: '0 * * * *' },
      jobId: 'recurring-cancel-unconfirmed',
    },
  )

  await notificationQueue.add(
    'recalc_all_scores',
    { type: 'recalc_all_scores' },
    {
      repeat: { pattern: '0 0 * * *' },
      jobId: 'recurring-recalc-scores',
    },
  )

  console.log('[scheduler] Jobs recorrentes registrados')
}
