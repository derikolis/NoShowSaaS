import { useEffect, useState } from 'react'
import {
  CalendarDays, Users, RefreshCw, TrendingUp,
  CalendarCheck, CalendarX, CalendarClock, UserX, AlertTriangle,
} from 'lucide-react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  summary: { total: number; scheduled: number; confirmed: number; noShow: number; cancelled: number }
  attendanceRate: number | null
  recoveredSlots: number
  totalClients: number
  topNoShows: { id: string; name: string; phone: string; riskScore: number; count: number }[]
  upcoming: {
    id: string; service: string; scheduledAt: string; status: string; riskScore: number
    client: { name: string; phone: string }
  }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function dayLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const d = new Date(date); d.setHours(0, 0, 0, 0)

  if (d.getTime() === today.getTime()) return 'Hoje'
  if (d.getTime() === tomorrow.getTime()) return 'Amanhã'
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
}

function groupByDay(items: DashboardData['upcoming']) {
  const map = new Map<string, DashboardData['upcoming']>()
  for (const item of items) {
    const key = new Date(item.scheduledAt).toDateString()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return Array.from(map.entries()).map(([, group]) => ({
    label: dayLabel(group[0].scheduledAt),
    items: group,
  }))
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

function DashboardSkeleton() {
  return (
    <Layout>
      <div className="p-8 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
              <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-2">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-center py-1">
                <Skeleton className="h-4 w-4" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-2 w-full" />
                </div>
                <Skeleton className="h-4 w-6" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────

function RiskBar({ score }: { score: number }) {
  const color = score <= 30 ? 'bg-green-500' : score <= 60 ? 'bg-yellow-400' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-400 tabular-nums w-6 text-right">{score}</span>
    </div>
  )
}

function KpiCard({
  label, value, sub, icon: Icon, iconCls, valueCls,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; iconCls: string; valueCls: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconCls}`}>
          <Icon size={16} />
        </div>
      </div>
      <div>
        <div className={`text-3xl font-bold leading-none ${valueCls}`}>{value}</div>
        {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
      </div>
    </div>
  )
}

function StatusCard({
  label, value, borderCls, valueCls, icon: Icon, iconCls,
}: {
  label: string; value: number
  borderCls: string; valueCls: string
  icon: React.ElementType; iconCls: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 border-l-4 ${borderCls} flex items-center gap-4`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconCls}`}>
        <Icon size={18} />
      </div>
      <div>
        <div className={`text-2xl font-bold ${valueCls}`}>{value}</div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { name } = useAuth()
  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard')
      .then(({ data: res }) => setData(res.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardSkeleton />
  if (!data) return null

  const { summary, attendanceRate, recoveredSlots, totalClients, topNoShows, upcoming } = data
  const grouped = groupByDay(upcoming)

  const attendanceColor = attendanceRate === null ? 'text-gray-400'
    : attendanceRate >= 80 ? 'text-green-600'
    : attendanceRate >= 60 ? 'text-yellow-600'
    : 'text-red-600'

  const attendanceBarColor = attendanceRate === null ? 'bg-gray-200'
    : attendanceRate >= 80 ? 'bg-green-500'
    : attendanceRate >= 60 ? 'bg-yellow-400'
    : 'bg-red-500'

  return (
    <Layout>
      <div className="p-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}{name ? `, ${name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">{todayLabel()}</p>
        </div>

        {/* Row 1 — KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Comparecimento</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-500">
                <TrendingUp size={16} />
              </div>
            </div>
            <div>
              <div className={`text-3xl font-bold leading-none ${attendanceColor}`}>
                {attendanceRate !== null ? `${attendanceRate}%` : '—'}
              </div>
              <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${attendanceBarColor}`} style={{ width: `${attendanceRate ?? 0}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {attendanceRate !== null ? 'taxa dos agendamentos' : 'sem dados suficientes'}
              </p>
            </div>
          </div>

          <KpiCard label="Total de agendamentos" value={summary.total}
            icon={CalendarDays} iconCls="bg-gray-100 text-gray-500" valueCls="text-gray-900" />
          <KpiCard label="Clientes cadastrados" value={totalClients}
            icon={Users} iconCls="bg-indigo-50 text-indigo-500" valueCls="text-indigo-600" />
          <KpiCard label="Horários recuperados" value={recoveredSlots} sub="via lista de espera"
            icon={RefreshCw} iconCls="bg-green-50 text-green-500" valueCls="text-green-600" />
        </div>

        {/* Row 2 — Status */}
        <div className="grid grid-cols-4 gap-4">
          <StatusCard label="Agendados" value={summary.scheduled}
            borderCls="border-l-blue-400" valueCls="text-blue-600"
            icon={CalendarClock} iconCls="bg-blue-50 text-blue-500" />
          <StatusCard label="Confirmados" value={summary.confirmed}
            borderCls="border-l-green-400" valueCls="text-green-600"
            icon={CalendarCheck} iconCls="bg-green-50 text-green-500" />
          <StatusCard label="No-show" value={summary.noShow}
            borderCls="border-l-red-400" valueCls="text-red-600"
            icon={UserX} iconCls="bg-red-50 text-red-500" />
          <StatusCard label="Cancelados" value={summary.cancelled}
            borderCls="border-l-gray-300" valueCls="text-gray-600"
            icon={CalendarX} iconCls="bg-gray-100 text-gray-400" />
        </div>

        {/* Row 3 — Próximos + Top no-shows */}
        <div className="grid grid-cols-3 gap-4">

          <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">Próximos 7 dias</h2>
              {upcoming.length > 0 && (
                <span className="text-xs text-gray-400">{upcoming.length} agendamento{upcoming.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {upcoming.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <CalendarDays size={18} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">Nenhum agendamento nos próximos 7 dias</p>
                </div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-6 py-3">Cliente</th>
                    <th className="px-6 py-3">Serviço</th>
                    <th className="px-6 py-3">Hora</th>
                    <th className="px-6 py-3">Risco</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(({ label, items }) => (
                    <>
                      <tr key={label}>
                        <td colSpan={4} className="px-6 pt-4 pb-1.5">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 px-2 py-0.5 rounded-md capitalize">
                            {label}
                          </span>
                        </td>
                      </tr>
                      {items.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50 transition-colors border-t border-gray-50">
                          <td className="px-6 py-2.5">
                            <p className="font-medium text-gray-900">{a.client.name}</p>
                            <p className="text-xs text-gray-400">{a.client.phone}</p>
                          </td>
                          <td className="px-6 py-2.5 text-gray-600">{a.service}</td>
                          <td className="px-6 py-2.5 text-gray-600 tabular-nums">
                            {new Date(a.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-2.5 w-32">
                            <RiskBar score={a.riskScore} />
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400" />
              <h2 className="font-semibold text-gray-800 text-sm">Clientes com mais faltas</h2>
            </div>
            {topNoShows.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <UserX size={18} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">Nenhum no-show registrado</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {topNoShows.map((c, i) => (
                  <li key={c.id} className="px-6 py-3.5 flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-300 w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{c.name}</p>
                      <div className="mt-1.5">
                        <RiskBar score={c.riskScore} />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-red-500 shrink-0">{c.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </Layout>
  )
}
