import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
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
import paymentsRoutes from './modules/payments/payments.routes'
import whatsappWebhook from './webhooks/whatsapp.webhook'
import { errorMiddleware } from './shared/middlewares/error.middleware'

const app = express()

const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))

app.use(express.json({ limit: '5mb' }))

// ─── Rate limiting ────────────────────────────────────────────────────────────

const generalLimit = rateLimit({
  windowMs: 60 * 1000,        // 1 minuto
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas requisições. Tente novamente em breve.' },
})

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas tentativas de login. Aguarde 15 minutos.' },
})

const webhookLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/auth', authLimit)
app.use('/api/booking/:slug/login', authLimit)
app.use('/api/booking/:slug/register', authLimit)
app.use('/api/payments/webhook', webhookLimit)
app.use('/webhooks', webhookLimit)
app.use('/api', generalLimit)

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
app.use('/api/payments', paymentsRoutes)
app.use('/webhooks', whatsappWebhook)

app.use(errorMiddleware)

export default app
