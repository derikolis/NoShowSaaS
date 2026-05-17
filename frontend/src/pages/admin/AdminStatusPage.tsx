import { useEffect, useState, useCallback } from 'react'
import {
  RefreshCw, Wifi, WifiOff, Bell, BellOff, CreditCard,
  Users, CalendarDays, Clock, AlertTriangle, CheckCircle2,
  ExternalLink, Activity,
} from 'lucide-react'
import AdminLayout from './AdminLayout'
import adminApi from '../../services/adminApi'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantHealth {
  id: string
  name: string
  slug: string
  plan: string
  status: 'active' | 'inactive' | 'blocked'
  ownerEmail: string
  createdAt: string
  stats: {
    totalClients: number
    totalAppointments: number
    appointmentsThisMonth: number
    noShowRate: number | null
    pendingAppointments: number
    notificationsSentThisMonth: number
    lastActivityAt: string | null
  }
  config: {
    whatsappConfigured: boolean
    reminderEnabled: boolean
    paymentConfigured: boolean
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return 'Nunca'
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 2)   return 'Agora mesmo'
  if (mins < 60)  return `${mins}min atrás`
  if (hours < 24) return `${hours}h atrás`
  if (days < 30)  return `${days}d atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function healthScore(t: TenantHealth): number {
  let score = 0
  if (t.status === 'active')            score += 30
  if (t.config.whatsappConfigured)      score += 25
  if (t.config.reminderEnabled)         score += 15
  if (t.config.paymentConfigured)       score += 10
  if (t.stats.appointmentsThisMonth > 0) score += 20
  return Math.min(score, 100)
}

function healthColor(score: number) {
  if (score >= 80) return 'text-green-400 bg-green-900/30 border-green-800'
  if (score >= 50) return 'text-yellow-400 bg-yellow-900/30 border-yellow-800'
  return 'text-red-400 bg-red-900/30 border-red-800'
}

function healthLabel(score: number) {
  if (score >= 80) return 'Saudável'
  if (score >= 50) return 'Parcial'
  return 'Atenção'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-green-500' : 'bg-slate-600'}`} />
  )
}

function Pill({ label, ok, icon: Icon, offIcon: OffIcon }: {
  label: string; ok: boolean
  icon: React.ElementType; offIcon: React.ElementType
}) {
  const I = ok ? Icon : OffIcon
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
      ok
        ? 'bg-green-900/30 text-green-400 border-green-800'
        : 'bg-slate-800 text-slate-500 border-slate-700'
    }`}>
      <I size={11} />
      {label}
    </span>
  )
}

function TenantStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:   { label: 'Ativa',     cls: 'bg-green-900/40 text-green-400 border-green-800' },
    inactive: { label: 'Inativa',   cls: 'bg-slate-800 text-slate-400 border-slate-700' },
    blocked:  { label: 'Bloqueada', cls: 'bg-red-900/40 text-red-400 border-red-800' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-slate-800 text-slate-400 border-slate-700' }
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
  )
}

function NoShowBar({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-xs text-slate-600">—</span>
  const color = rate <= 10 ? 'bg-green-500' : rate <= 25 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-400">{rate}%</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminStatusPage() {
  const [tenants,   setTenants]   = useState<TenantHealth[]>([])
  const [loading,   setLoading]   = useState(true)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await adminApi.get('/tenants/health')
      setTenants(data.data)
      setLastFetch(new Date())
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Summary counts ──────────────────────────────────────────────────────────
  const totalActive    = tenants.filter(t => t.status === 'active').length
  const withWhatsApp   = tenants.filter(t => t.config.whatsappConfigured).length
  const withActivity   = tenants.filter(t => t.stats.appointmentsThisMonth > 0).length
  const needAttention  = tenants.filter(t => healthScore(t) < 50).length

  return (
    <AdminLayout>
      <div className="p-8 text-white">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Status das Empresas</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Monitoramento em tempo real das {tenants.length} empresa{tenants.length !== 1 ? 's' : ''} cadastradas
              {lastFetch && (
                <span className="ml-2 text-slate-500">
                  · atualizado {relativeTime(lastFetch.toISOString())}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* ── Summary cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Ativas',         value: totalActive,   sub: `de ${tenants.length} total`, color: 'text-green-400',  dot: 'bg-green-500' },
            { label: 'Com WhatsApp',   value: withWhatsApp,  sub: 'configurado',                color: 'text-indigo-400', dot: 'bg-indigo-500' },
            { label: 'Com atividade',  value: withActivity,  sub: 'este mês',                   color: 'text-blue-400',   dot: 'bg-blue-500' },
            { label: 'Precisam atenção', value: needAttention, sub: 'saúde < 50%',              color: needAttention > 0 ? 'text-red-400' : 'text-slate-400', dot: needAttention > 0 ? 'bg-red-500' : 'bg-slate-600' },
          ].map(card => (
            <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${card.dot}`} />
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{card.label}</p>
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>{loading ? '—' : card.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-800">
                <th className="px-5 py-3.5">Empresa</th>
                <th className="px-5 py-3.5">Saúde</th>
                <th className="px-5 py-3.5">Integrações</th>
                <th className="px-5 py-3.5">Clientes</th>
                <th className="px-5 py-3.5">Agend. mês</th>
                <th className="px-5 py-3.5">No-show</th>
                <th className="px-5 py-3.5">Pendentes</th>
                <th className="px-5 py-3.5">Notif. mês</th>
                <th className="px-5 py-3.5">Atividade</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">

              {loading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-3.5 bg-slate-800 rounded w-20" />
                    </td>
                  ))}
                </tr>
              ))}

              {!loading && tenants.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center text-slate-500">
                    Nenhuma empresa cadastrada
                  </td>
                </tr>
              )}

              {!loading && tenants.map(t => {
                const score = healthScore(t)
                const hCls  = healthColor(score)
                return (
                  <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">

                    {/* Empresa */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <StatusDot ok={t.status === 'active'} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white leading-tight">{t.name}</p>
                            <TenantStatusBadge status={t.status} />
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">/{t.slug} · {t.plan}</p>
                        </div>
                      </div>
                    </td>

                    {/* Saúde */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${hCls}`}>
                          {healthLabel(score)}
                        </span>
                      </div>
                    </td>

                    {/* Integrações */}
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <Pill label="WhatsApp" ok={t.config.whatsappConfigured} icon={Wifi}     offIcon={WifiOff}  />
                        <Pill label="Lembretes" ok={t.config.reminderEnabled}   icon={Bell}     offIcon={BellOff}  />
                        <Pill label="PIX"       ok={t.config.paymentConfigured}  icon={CreditCard} offIcon={CreditCard} />
                      </div>
                    </td>

                    {/* Clientes */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Users size={13} className="text-slate-500" />
                        <span className="tabular-nums">{t.stats.totalClients}</span>
                      </div>
                    </td>

                    {/* Agend. mês */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <CalendarDays size={13} className="text-slate-500" />
                        <span className="tabular-nums">{t.stats.appointmentsThisMonth}</span>
                        {t.stats.appointmentsThisMonth === 0 && (
                          <span className="text-slate-600 text-xs">sem uso</span>
                        )}
                      </div>
                    </td>

                    {/* No-show */}
                    <td className="px-5 py-4">
                      <NoShowBar rate={t.stats.noShowRate} />
                    </td>

                    {/* Pendentes */}
                    <td className="px-5 py-4">
                      <div className={`flex items-center gap-1.5 tabular-nums ${
                        t.stats.pendingAppointments > 0 ? 'text-indigo-300' : 'text-slate-500'
                      }`}>
                        <Clock size={13} className="shrink-0" />
                        {t.stats.pendingAppointments}
                      </div>
                    </td>

                    {/* Notif. mês */}
                    <td className="px-5 py-4">
                      <div className={`flex items-center gap-1.5 tabular-nums ${
                        t.stats.notificationsSentThisMonth > 0 ? 'text-green-400' : 'text-slate-500'
                      }`}>
                        {t.stats.notificationsSentThisMonth > 0
                          ? <CheckCircle2 size={13} className="shrink-0" />
                          : <AlertTriangle size={13} className="shrink-0" />
                        }
                        {t.stats.notificationsSentThisMonth}
                      </div>
                    </td>

                    {/* Atividade */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                        <Activity size={12} className="text-slate-600 shrink-0" />
                        {relativeTime(t.stats.lastActivityAt)}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <a
                        href={`/agendar/${t.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir portal de agendamento"
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer"
                      >
                        <ExternalLink size={13} />
                        Portal
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Legend ──────────────────────────────────────────────────────── */}
        {!loading && tenants.length > 0 && (
          <div className="mt-4 flex items-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />Saúde ≥ 80% — Ativa, WhatsApp + lembretes configurados, uso no mês</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500" />50–79% — Parcialmente configurada</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />&lt; 50% — Precisa de atenção</span>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
