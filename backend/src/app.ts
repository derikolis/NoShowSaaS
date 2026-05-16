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
import servicesRoutes from './modules/services/services.routes'
import bookingRoutes  from './modules/booking/booking.routes'
import usersRoutes from './modules/users/users.routes'
import adminRoutes from './modules/admin/admin.routes'
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
app.use('/api/services', servicesRoutes)
app.use('/api/booking',  bookingRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/admin', adminRoutes)
app.use('/webhooks', whatsappWebhook)

app.use(errorMiddleware)

export default app
