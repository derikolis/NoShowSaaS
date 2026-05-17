import { useEffect, useState, useCallback } from 'react'
import {
  CalendarDays, Users, RefreshCw, TrendingUp,
  CalendarCheck, CalendarX, CalendarClock, UserX, AlertTriangle,
  CheckCircle2, XCircle, ArrowUp, ArrowDown, Clock,
} from 'lucide-react'
import Layout from '../../components/Layout'
import { useAuth } from '../../hooks/useAuth'
import api from '../../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TodayAppointment {
  id: string
  service: string
  scheduledAt: string
  status: string
  riskScore: number
  client: { name: string; phone: string; riskScore: number }
  professionalName: string
}

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
  todayAppointments: TodayAppointment[]
  weekComparison: {
    thisWeek: { total: number; noShow: number; rate: number | null }
    lastWeek: { total: number; noShow: number; rate: number | null }
  }
  noShowsByDay: { day: number; count: number }[]
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
  const date     = new Date(dateStr)
  const today    = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const d        = new Date(date); d.setHours(0, 0, 0, 0)
  if (d.getTime() === today.getTime())    return 'Hoje'
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

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Agendado',   cls: 'bg-blue-100 text-blue-700'   },
  confirmed: { label: 'Confirmado', cls: 'bg-green-100 text-green-700' },
  no_show:   { label: 'No-show',    cls: 'bg-red-100 text-red-700'     },
  cancelled: { label: 'Cancelado',  cls: 'bg-gray-100 text-gray-600'   },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

function DashboardSkeleton() {
  return (
    <Layout>
      <div className="p-8 space-y-6">
        <div className="space-y-2"><Sk className="h-8 w-56" /><Sk className="h-4 w-72" /></div>
        <Sk className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Sk key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Sk key={i} className="h-20 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Sk className="h-48 rounded-xl" />
          <Sk className="h-48 rounded-xl col-span-2" />
        </div>
      </div>
    </Layout>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function DeltaBadge({ now, prev }: { now: number; prev: number }) {
  if (prev === 0) return null
  const diff = now - prev
  const up   = diff >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {Math.abs(diff)}
    </span>
  )
}

function KpiCard({ label, value, sub, icon: Icon, iconCls, valueCls, delta }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; iconCls: string; valueCls: string
  delta?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconCls}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <div className={`text-3xl font-bold leading-none ${valueCls}`}>{value}</div>
        {delta}
      </div>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function StatusCard({ label, value, borderCls, valueCls, icon: Icon, iconCls }: {
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

function NoShowChart({ data }: { data: { day: number; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-800 mb-5">No-shows por dia da semana</h2>
      <div className="flex items-end gap-2 h-28">
        {data.map(({ day, count }) => (
          <div key={day} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-gray-400 tabular-nums">{count > 0 ? count : ''}</span>
            <div
              className="w-full rounded-t-md bg-red-400 transition-all"
              style={{ height: `${(count / max) * 80}px`, minHeight: count > 0 ? '4px' : '0' }}
            />
            <span className="text-[11px] text-gray-400 font-medium">{DAY_NAMES[day]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TodaySection({ appointments, onAction }: {
  appointments: TodayAppointment[]
  onAction: (id: string, action: 'confirm' | 'no-show') => Promise<void>
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const done     = appointments.filter(a => ['confirmed', 'no_show', 'cancelled'].includes(a.status)).length
  const total    = appointments.length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  async function handle(id: string, action: 'confirm' | 'no-show') {
    setLoadingId(id)
    try { await onAction(id, action) } finally { setLoadingId(null) }
  }

  if (total === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
          <CalendarDays size={20} className="text-indigo-400" />
        </div>
        <div>
          <p className="font-semibold text-gray-800">Nenhum agendamento hoje</p>
          <p className="text-sm text-gray-400 mt-0.5">Aproveite para adiantar tarefas ou adicionar novos agendamentos.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
            <Clock size={18} className="text-indigo-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Agenda de hoje</p>
            <p className="text-xs text-gray-400">{done} de {total} concluídos</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-gray-400 tabular-nums w-8 text-right">{progress}%</span>
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {appointments.map(a => {
          const cfg         = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.scheduled
          const isScheduled = a.status === 'scheduled'
          const loading     = loadingId === a.id

          return (
            <div key={a.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors">
              <div className="w-12 shrink-0 text-center">
                <p className="text-sm font-bold text-gray-900 tabular-nums">
                  {new Date(a.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{a.client.name}</p>
                <p className="text-xs text-gray-400 truncate">{a.service} · {a.professionalName}</p>
              </div>

              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${cfg.cls}`}>
                {cfg.label}
              </span>

              {isScheduled && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handle(a.id, 'confirm')}
                    disabled={!!loading}
                    title="Confirmar presença"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
                  >
                    <CheckCircle2 size={17} />
                  </button>
                  <button
                    onClick={() => handle(a.id, 'no-show')}
                    disabled={!!loading}
                    title="Registrar no-show"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    <XCircle size={17} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { name } = useAuth()
  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    api.get('/dashboard')
      .then(({ data: res }) => setData(res.data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleTodayAction(id: string, action: 'confirm' | 'no-show') {
    await api.patch(`/appointments/${id}/${action}`)
    load()
  }

  if (loading) return <DashboardSkeleton />
  if (!data)   return null

  const { summary, attendanceRate, recoveredSlots, totalClients, topNoShows, upcoming, todayAppointments, weekComparison, noShowsByDay } = data
  const { thisWeek, lastWeek } = weekComparison
  const grouped = groupByDay(upcoming)

  const attendanceColor    = attendanceRate === null ? 'text-gray-400' : attendanceRate >= 80 ? 'text-green-600' : attendanceRate >= 60 ? 'text-yellow-600' : 'text-red-600'
  const attendanceBarColor = attendanceRate === null ? 'bg-gray-200'   : attendanceRate >= 80 ? 'bg-green-500'   : attendanceRate >= 60 ? 'bg-yellow-400'   : 'bg-red-500'

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

        {/* Hoje */}
        <TodaySection appointments={todayAppointments} onAction={handleTodayAction} />

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Comparecimento</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-500">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className={`text-3xl font-bold leading-none ${attendanceColor}`}>
                {attendanceRate !== null ? `${attendanceRate}%` : '—'}
              </div>
              {thisWeek.rate !== null && lastWeek.rate !== null && (
                <DeltaBadge now={thisWeek.rate} prev={lastWeek.rate} />
              )}
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${attendanceBarColor}`} style={{ width: `${attendanceRate ?? 0}%` }} />
            </div>
            <p className="text-xs text-gray-400">
              {attendanceRate !== null ? 'taxa geral de comparecimento' : 'sem dados suficientes'}
            </p>
          </div>

          <KpiCard
            label="Agendamentos (semana)"
            value={thisWeek.total}
            icon={CalendarDays}
            iconCls="bg-gray-100 text-gray-500"
            valueCls="text-gray-900"
            delta={<DeltaBadge now={thisWeek.total} prev={lastWeek.total} />}
            sub="vs semana anterior"
          />
          <KpiCard
            label="Clientes cadastrados"
            value={totalClients}
            icon={Users}
            iconCls="bg-indigo-50 text-indigo-500"
            valueCls="text-indigo-600"
          />
          <KpiCard
            label="Horários recuperados"
            value={recoveredSlots}
            sub="via lista de espera"
            icon={RefreshCw}
            iconCls="bg-green-50 text-green-500"
            valueCls="text-green-600"
          />
        </div>

        {/* Status */}
        <div className="grid grid-cols-4 gap-4">
          <StatusCard label="Agendados"   value={summary.scheduled} borderCls="border-l-blue-400"  valueCls="text-blue-600"  icon={CalendarClock} iconCls="bg-blue-50 text-blue-500"   />
          <StatusCard label="Confirmados" value={summary.confirmed} borderCls="border-l-green-400" valueCls="text-green-600" icon={CalendarCheck}  iconCls="bg-green-50 text-green-500" />
          <StatusCard label="No-show"     value={summary.noShow}    borderCls="border-l-red-400"   valueCls="text-red-600"   icon={UserX}          iconCls="bg-red-50 text-red-500"     />
          <StatusCard label="Cancelados"  value={summary.cancelled} borderCls="border-l-gray-300"  valueCls="text-gray-600"  icon={CalendarX}      iconCls="bg-gray-100 text-gray-400"  />
        </div>

        {/* Gráfico + Próximos 7 dias */}
        <div className="grid grid-cols-3 gap-4">
          <NoShowChart data={noShowsByDay} />

          <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">Próximos 7 dias</h2>
              {upcoming.length > 0 && (
                <span className="text-xs text-gray-400">{upcoming.length} agendamento{upcoming.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <CalendarDays size={18} className="text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">Nenhum agendamento nos próximos 7 dias</p>
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
                        <td colSpan={4} className="px-6 pt-3 pb-1">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 px-2 py-0.5 rounded">
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
                          <td className="px-6 py-2.5 w-32"><RiskBar score={a.riskScore} /></td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Top no-shows */}
        {topNoShows.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400" />
              <h2 className="font-semibold text-gray-800 text-sm">Clientes com mais faltas</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {topNoShows.map((c, i) => (
                <div key={c.id} className="px-6 py-3.5 flex items-center gap-4">
                  <span className="text-sm font-bold text-gray-300 w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{c.name}</p>
                    <div className="mt-1.5"><RiskBar score={c.riskScore} /></div>
                  </div>
                  <span className="text-sm font-bold text-red-500 shrink-0 bg-red-50 px-2.5 py-0.5 rounded-full">{c.count}×</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
