import prisma from '../../shared/utils/prisma'

export async function getDashboardStats(tenantId: string) {
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999)

  // Semana atual: segunda-feira até agora
  const dow = now.getDay()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  startOfWeek.setHours(0, 0, 0, 0)

  // Semana anterior completa
  const startOfLastWeek = new Date(startOfWeek)
  startOfLastWeek.setDate(startOfWeek.getDate() - 7)
  const endOfLastWeek = new Date(startOfWeek)
  endOfLastWeek.setMilliseconds(-1)

  const [appointments, todayAppointments, lastWeekAppointments, waitlistRecovered, clients, users] = await Promise.all([
    prisma.appointment.findMany({
      where: { tenantId },
      include: { client: { select: { id: true, name: true, phone: true, riskScore: true } } },
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.appointment.findMany({
      where: { tenantId, scheduledAt: { gte: todayStart, lte: todayEnd } },
      include: { client: { select: { name: true, phone: true, riskScore: true } } },
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.appointment.findMany({
      where: { tenantId, scheduledAt: { gte: startOfLastWeek, lte: endOfLastWeek } },
      select: { status: true },
    }),
    prisma.waitlist.count({ where: { tenantId, acceptedAt: { not: null } } }),
    prisma.client.count({ where: { tenantId } }),
    prisma.user.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ])

  const userMap = new Map(users.map(u => [u.id, u.name]))

  const total     = appointments.length
  const confirmed = appointments.filter(a => a.status === 'confirmed').length
  const noShow    = appointments.filter(a => a.status === 'no_show').length
  const cancelled = appointments.filter(a => a.status === 'cancelled').length
  const scheduled = appointments.filter(a => a.status === 'scheduled').length

  const concluded      = confirmed + noShow
  const attendanceRate = concluded > 0 ? Math.round((confirmed / concluded) * 100) : null

  // Comparativo semanal
  const thisWeekAppts     = appointments.filter(a => new Date(a.scheduledAt) >= startOfWeek)
  const thisWeekTotal     = thisWeekAppts.length
  const thisWeekNoShow    = thisWeekAppts.filter(a => a.status === 'no_show').length
  const thisWeekConfirmed = thisWeekAppts.filter(a => a.status === 'confirmed').length
  const thisWeekConcluded = thisWeekConfirmed + thisWeekNoShow
  const thisWeekRate      = thisWeekConcluded > 0 ? Math.round((thisWeekConfirmed / thisWeekConcluded) * 100) : null

  const lastWeekTotal     = lastWeekAppointments.length
  const lastWeekNoShow    = lastWeekAppointments.filter(a => a.status === 'no_show').length
  const lastWeekConfirmed = lastWeekAppointments.filter(a => a.status === 'confirmed').length
  const lastWeekConcluded = lastWeekConfirmed + lastWeekNoShow
  const lastWeekRate      = lastWeekConcluded > 0 ? Math.round((lastWeekConfirmed / lastWeekConcluded) * 100) : null

  // No-shows por dia da semana (histórico completo)
  const noShowsByDay = Array.from({ length: 7 }, (_, i) => ({
    day: i,
    count: appointments.filter(a => a.status === 'no_show' && new Date(a.scheduledAt).getDay() === i).length,
  }))

  // Top clientes com mais no-shows
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

  // Próximos agendamentos (7 dias, apenas scheduled)
  const upcoming = appointments
    .filter(a => a.status === 'scheduled' && new Date(a.scheduledAt) >= now && new Date(a.scheduledAt) <= sevenDaysFromNow)
    .slice(0, 10)

  // Agendamentos de hoje com nome do profissional
  const todayFormatted = todayAppointments.map(a => ({
    id:              a.id,
    service:         a.service,
    scheduledAt:     a.scheduledAt,
    status:          a.status,
    riskScore:       a.riskScore,
    client:          a.client,
    professionalName: userMap.get(a.professionalId) ?? 'Profissional',
  }))

  return {
    summary: { total, scheduled, confirmed, noShow, cancelled },
    attendanceRate,
    recoveredSlots: waitlistRecovered,
    totalClients: clients,
    topNoShows,
    upcoming,
    todayAppointments: todayFormatted,
    weekComparison: {
      thisWeek:  { total: thisWeekTotal,  noShow: thisWeekNoShow,  rate: thisWeekRate  },
      lastWeek:  { total: lastWeekTotal,  noShow: lastWeekNoShow,  rate: lastWeekRate  },
    },
    noShowsByDay,
  }
}
