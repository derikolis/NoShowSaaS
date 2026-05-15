import prisma from '../../shared/utils/prisma'

export async function getDashboardStats(tenantId: string) {
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [appointments, waitlistRecovered, clients] = await Promise.all([
    prisma.appointment.findMany({
      where: { tenantId },
      include: { client: { select: { id: true, name: true, phone: true, riskScore: true } } },
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.waitlist.count({ where: { tenantId, acceptedAt: { not: null } } }),
    prisma.client.findMany({ where: { tenantId }, select: { id: true, name: true, phone: true, riskScore: true } }),
  ])

  const total = appointments.length
  const confirmed = appointments.filter(a => a.status === 'confirmed').length
  const noShow = appointments.filter(a => a.status === 'no_show').length
  const cancelled = appointments.filter(a => a.status === 'cancelled').length
  const scheduled = appointments.filter(a => a.status === 'scheduled').length

  // Taxa de comparecimento: confirmados / (confirmados + no_show), ignora cancelamentos
  const concluded = confirmed + noShow
  const attendanceRate = concluded > 0 ? Math.round((confirmed / concluded) * 100) : null

  // Clientes com mais no-shows (top 5)
  const noShowCount: Record<string, { name: string; phone: string; riskScore: number; count: number }> = {}
  for (const a of appointments) {
    if (a.status === 'no_show') {
      const id = a.client.id
      if (!noShowCount[id]) {
        noShowCount[id] = { name: a.client.name, phone: a.client.phone, riskScore: a.client.riskScore, count: 0 }
      }
      noShowCount[id].count++
    }
  }
  const topNoShows = Object.entries(noShowCount)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Próximos agendamentos (7 dias)
  const upcoming = appointments.filter(
    a => a.status === 'scheduled' && new Date(a.scheduledAt) >= now && new Date(a.scheduledAt) <= sevenDaysFromNow
  ).slice(0, 10)

  return {
    summary: { total, scheduled, confirmed, noShow, cancelled },
    attendanceRate,
    recoveredSlots: waitlistRecovered,
    totalClients: clients.length,
    topNoShows,
    upcoming,
  }
}
