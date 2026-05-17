import prisma from '../../shared/utils/prisma'

// Pontuação conforme regras do CLAUDE.md
const POINTS = {
  NEW_CLIENT: 15,
  NO_SHOW_ONCE: 20,
  NO_SHOW_MULTIPLE: 40,
  PEAK_HOUR: 20,
  CONFIRMED: -30,
  LAST_MINUTE: 25,  // < 2h
  VIP: -20,
} as const

type PeakHourRange = { start: number; end: number }

const DEFAULT_PEAK_HOURS: PeakHourRange[] = [
  { start: 12, end: 14 },
  { start: 18, end: 20 },
]

function isPeakHour(date: Date, peakHours: PeakHourRange[] = DEFAULT_PEAK_HOURS): boolean {
  const hour = date.getHours()
  return peakHours.some(({ start, end }) => hour >= start && hour < end)
}

function isLastMinute(scheduledAt: Date): boolean {
  const diffMs = scheduledAt.getTime() - Date.now()
  return diffMs < 2 * 60 * 60 * 1000
}

export type RiskLevel = 'low' | 'medium' | 'high'

export function classifyRisk(score: number): RiskLevel {
  if (score <= 30) return 'low'
  if (score <= 60) return 'medium'
  return 'high'
}

export async function calculateScore(tenantId: string, clientId: string, scheduledAt: Date): Promise<{ score: number; level: RiskLevel }> {
  const [client, tenant] = await Promise.all([
    prisma.client.findFirst({ where: { id: clientId, tenantId } }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { peakHours: true } }),
  ])

  if (!client) throw new Error('Cliente não encontrado')

  const peakHours = (tenant?.peakHours as PeakHourRange[] | null) ?? DEFAULT_PEAK_HOURS

  const history = await prisma.appointment.findMany({
    where: { clientId, tenantId, status: { in: ['no_show', 'confirmed'] } },
  })

  let score = 0

  if (history.length === 0) score += POINTS.NEW_CLIENT

  const noShows = history.filter(a => a.status === 'no_show').length
  if (noShows === 1) score += POINTS.NO_SHOW_ONCE
  else if (noShows >= 2) score += POINTS.NO_SHOW_MULTIPLE

  // Cliente com histórico de confirmações reduz o risco
  const confirmedCount = history.filter(a => a.status === 'confirmed').length
  if (confirmedCount > 0) score += POINTS.CONFIRMED  // -30

  if (isPeakHour(scheduledAt, peakHours)) score += POINTS.PEAK_HOUR
  if (isLastMinute(scheduledAt)) score += POINTS.LAST_MINUTE
  if (client.isVip) score += POINTS.VIP

  // score mínimo 0
  score = Math.max(0, score)

  return { score, level: classifyRisk(score) }
}

export async function recalculateClientScore(tenantId: string, clientId: string): Promise<void> {
  const [noShows, completions, confirmations] = await Promise.all([
    prisma.appointment.count({ where: { tenantId, clientId, status: 'no_show' } }),
    prisma.appointment.count({ where: { tenantId, clientId, status: 'completed' } }),
    prisma.appointment.count({ where: { tenantId, clientId, status: 'confirmed' } }),
  ])

  let score = 0
  if (noShows === 1) score += POINTS.NO_SHOW_ONCE
  else if (noShows >= 2) score += POINTS.NO_SHOW_MULTIPLE

  // Cada comparecimento e confirmação reduz o risco
  score -= completions * 10
  score -= confirmations * 5

  score = Math.max(0, Math.min(100, score))

  await prisma.client.update({ where: { id: clientId }, data: { riskScore: score } })
}
