import nodemailer from 'nodemailer'

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST ?? '',
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
    },
  })
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? ''
  if (!process.env.SMTP_HOST || !from) {
    console.log(`[E-mail simulado] Para ${to} | ${subject}`)
    return
  }
  const transport = createTransport()
  await transport.sendMail({ from, to, subject, html })
}
