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

function isPeakHour(date: Date): boolean {
  const hour = date.getHours()
  return (hour >= 12 && hour < 14) || (hour >= 18 && hour < 20)
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
  const client = await prisma.client.findFirst({ where: { id: clientId, tenantId } })
  if (!client) throw new Error('Cliente não encontrado')

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

  if (isPeakHour(scheduledAt)) score += POINTS.PEAK_HOUR
  if (isLastMinute(scheduledAt)) score += POINTS.LAST_MINUTE
  if (client.isVip) score += POINTS.VIP

  // score mínimo 0
  score = Math.max(0, score)

  return { score, level: classifyRisk(score) }
}

export async function recalculateClientScore(tenantId: string, clientId: string): Promise<void> {
  const noShows = await prisma.appointment.count({ where: { tenantId, clientId, status: 'no_show' } })

  let score = 0
  if (noShows === 1) score = POINTS.NO_SHOW_ONCE
  else if (noShows >= 2) score = POINTS.NO_SHOW_MULTIPLE

  await prisma.client.update({ where: { id: clientId }, data: { riskScore: score } })
}
