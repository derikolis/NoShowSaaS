import { Queue } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export const notificationQueue = new Queue('notifications', { connection })
export const riskRecalcQueue = new Queue('risk-recalc', { connection })

export { connection }
