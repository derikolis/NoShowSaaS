import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import dashboardRoutes from './modules/dashboard/dashboard.routes'
import authRoutes from './modules/auth/auth.routes'
import clientRoutes from './modules/clients/clients.routes'
import schedulingRoutes from './modules/scheduling/scheduling.routes'
import waitlistRoutes from './modules/waitlist/waitlist.routes'
import professionalsRoutes from './modules/professionals/professionals.routes'
import settingsRoutes from './modules/settings/settings.routes'
import whatsappWebhook from './webhooks/whatsapp.webhook'
import { errorMiddleware } from './shared/middlewares/error.middleware'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
}))

app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/dashboard', dashboardRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/clients', clientRoutes)
app.use('/api/appointments', schedulingRoutes)
app.use('/api/waitlist', waitlistRoutes)
app.use('/api/professionals', professionalsRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/webhooks', whatsappWebhook)

app.use(errorMiddleware)

export default app
