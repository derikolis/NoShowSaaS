import { useEffect, useState, FormEvent, useCallback } from 'react'
import {
  X, Phone, Calendar, User, Briefcase, CalendarDays, Search,
  CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight,
  MoreHorizontal, Clock,
} from 'lucide-react'
import Layout from '../../components/Layout'
import api from '../../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client       { id: string; name: string }
interface Professional { id: string; name: string; role: string }
interface WaitlistEntry {
  id: string; position: number
  client: { name: string; phone: string }
  notifiedAt: string | null; acceptedAt: string | null
}
interface Appointment {
  id: string; service: string; scheduledAt: string
  status: string; riskScore: number; professionalId: string
  client: { name: string; phone: string }
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; cls: string }> = {
  scheduled: { label: 'Agendado',   dot: 'bg-blue-500',  cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'   },
  confirmed: { label: 'Confirmado', dot: 'bg-green-500', cls: 'bg-green-50 text-green-700 ring-1 ring-green-200' },
  cancelled: { label: 'Cancelado',  dot: 'bg-gray-400',  cls: 'bg-gray-50 text-gray-600 ring-1 ring-gray-200'   },
  no_show:   { label: 'No-show',    dot: 'bg-red-500',   cls: 'bg-red-50 text-red-700 ring-1 ring-red-200'      },
}

const TABS = [
  { key: 'all',       label: 'Todos'       },
  { key: 'scheduled', label: 'Agendados'   },
  { key: 'confirmed', label: 'Confirmados' },
  { key: 'no_show',   label: 'No-show'     },
  { key: 'cancelled', label: 'Cancelados'  },
]

type Period = 'day' | 'week' | 'month'

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

function getPeriodRange(period: Period, anchor: Date): { from: string; to: string; label: string } {
  const d = new Date(anchor)
  if (period === 'day') {
    const label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
    return { from: isoDate(d), to: isoDate(d), label }
  }
  if (period === 'week') {
    const dow = d.getDay()
    const mon = new Date(d); mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); mon.setHours(0,0,0,0)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    const label = `${mon.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${sun.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
    return { from: isoDate(mon), to: isoDate(sun), label }
  }
  // month
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return { from: isoDate(start), to: isoDate(end), label }
}

function shiftAnchor(period: Period, anchor: Date, dir: 1 | -1): Date {
  const d = new Date(anchor)
  if (period === 'day')   d.setDate(d.getDate() + dir)
  if (period === 'week')  d.setDate(d.getDate() + dir * 7)
  if (period === 'month') d.setMonth(d.getMonth() + dir)
  return d
}

// ─── Small components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: 'bg-gray-400', cls: 'bg-gray-50 text-gray-600' }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function RiskBadge({ score }: { score: number }) {
  if (score <= 30) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Baixo</span>
  if (score <= 60) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Médio</span>
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Alto</span>
}

function RiskBar({ score }: { score: number }) {
  const color = score <= 30 ? 'bg-green-500' : score <= 60 ? 'bg-yellow-400' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-6 text-right">{score}</span>
    </div>
  )
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-2xl">
      {message}
    </div>
  )
}

// ─── Appointment Drawer ───────────────────────────────────────────────────────

function AppointmentDrawer({
  appointment, professionals, clients, onClose, onRefresh, showToast,
}: {
  appointment: Appointment; professionals: Professional[]; clients: Client[]
  onClose: () => void; onRefresh: () => void; showToast: (msg: string) => void
}) {
  const [rescheduling,    setRescheduling]    = useState(false)
  const [newDate,         setNewDate]         = useState('')
  const [waitlistOpen,    setWaitlistOpen]    = useState(false)
  const [waitlist,        setWaitlist]        = useState<WaitlistEntry[]>([])
  const [waitlistClient,  setWaitlistClient]  = useState('')
  const [addingWaitlist,  setAddingWaitlist]  = useState(false)
  const [actionLoading,   setActionLoading]   = useState('')

  const professional = professionals.find(p => p.id === appointment.professionalId)
  const dt      = new Date(appointment.scheduledAt)
  const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  async function handleAction(type: 'confirm' | 'cancel' | 'no-show') {
    setActionLoading(type)
    try {
      await api.patch(`/appointments/${appointment.id}/${type}`)
      const labels: Record<string, string> = { confirm: 'confirmado', cancel: 'cancelado', 'no-show': 'marcado como no-show' }
      showToast(`Agendamento ${labels[type]}`)
      onRefresh()
    } catch { showToast('Erro ao atualizar agendamento') }
    finally { setActionLoading('') }
  }

  async function handleReschedule(e: FormEvent) {
    e.preventDefault()
    try {
      await api.patch(`/appointments/${appointment.id}/reschedule`, { scheduledAt: new Date(newDate).toISOString() })
      showToast('Agendamento reagendado')
      setRescheduling(false); setNewDate(''); onRefresh()
    } catch { showToast('Erro ao reagendar') }
  }

  async function openWaitlist() {
    if (waitlistOpen) { setWaitlistOpen(false); return }
    const { data } = await api.get('/waitlist', { params: { slot: appointment.scheduledAt } })
    setWaitlist(data.data); setWaitlistOpen(true)
  }

  async function handleAddToWaitlist(e: FormEvent) {
    e.preventDefault(); setAddingWaitlist(true)
    try {
      await api.post('/waitlist', { clientId: waitlistClient, slot: appointment.scheduledAt })
      const { data } = await api.get('/waitlist', { params: { slot: appointment.scheduledAt } })
      setWaitlist(data.data); setWaitlistClient('')
      showToast('Cliente adicionado à lista de espera')
    } catch { showToast('Erro ao adicionar à lista de espera') }
    finally { setAddingWaitlist(false) }
  }

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[420px] bg-white z-50 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{appointment.client.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{appointment.service}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Info */}
          <div className="px-6 py-5 space-y-3 border-b border-gray-100">
            {[
              { icon: Calendar,  text: `${dateStr} às ${timeStr}`.replace(/^\w/, c => c.toUpperCase()) },
              { icon: User,      text: professional?.name ?? '—' },
              { icon: Phone,     text: appointment.client.phone },
              { icon: Briefcase, text: appointment.service },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                <Icon size={15} className="text-gray-400 shrink-0" />
                <span className="capitalize">{text}</span>
              </div>
            ))}
          </div>

          {/* Status + Risk */}
          <div className="px-6 py-5 space-y-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</span>
              <StatusBadge status={appointment.status} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Risco de no-show</span>
                <RiskBadge score={appointment.riskScore} />
              </div>
              <RiskBar score={appointment.riskScore} />
              <p className="text-xs text-gray-400 mt-2">
                {appointment.riskScore <= 30 && 'Baixo risco — lembrete padrão 24h e 2h antes.'}
                {appointment.riskScore > 30 && appointment.riskScore <= 60 && 'Risco médio — confirmação adicional 4h antes.'}
                {appointment.riskScore > 60 && 'Alto risco — confirmação 6h antes e horário de pico bloqueado.'}
              </p>
            </div>
          </div>

          {/* Ações */}
          <div className="px-6 py-5 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Ações</p>

            {appointment.status === 'scheduled' && (
              <>
                <button
                  onClick={() => handleAction('confirm')} disabled={!!actionLoading}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {actionLoading === 'confirm' ? 'Confirmando...' : 'Confirmar presença'}
                </button>
                <button
                  onClick={() => { setRescheduling(!rescheduling); setNewDate('') }}
                  className="w-full py-2.5 bg-white hover:bg-gray-50 text-indigo-600 text-sm font-semibold rounded-lg border border-indigo-200 transition-colors"
                >
                  {rescheduling ? 'Cancelar reagendamento' : 'Reagendar'}
                </button>
                {rescheduling && (
                  <form onSubmit={handleReschedule} className="flex gap-2">
                    <input type="datetime-local" value={newDate} onChange={e => setNewDate(e.target.value)} required className={inp} />
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 rounded-lg whitespace-nowrap">
                      Salvar
                    </button>
                  </form>
                )}
                <button
                  onClick={() => handleAction('cancel')} disabled={!!actionLoading}
                  className="w-full py-2.5 bg-white hover:bg-red-50 text-red-600 text-sm font-semibold rounded-lg border border-red-200 transition-colors"
                >
                  {actionLoading === 'cancel' ? 'Cancelando...' : 'Cancelar agendamento'}
                </button>
              </>
            )}

            {appointment.status === 'confirmed' && (
              <button
                onClick={() => handleAction('no-show')} disabled={!!actionLoading}
                className="w-full py-2.5 bg-white hover:bg-orange-50 text-orange-600 text-sm font-semibold rounded-lg border border-orange-200 transition-colors"
              >
                {actionLoading === 'no-show' ? 'Registrando...' : 'Marcar como no-show'}
              </button>
            )}

            {appointment.status === 'cancelled' && (
              <div className="space-y-3">
                <button
                  onClick={openWaitlist}
                  className="w-full py-2.5 bg-white hover:bg-indigo-50 text-indigo-600 text-sm font-semibold rounded-lg border border-indigo-200 transition-colors"
                >
                  {waitlistOpen ? 'Fechar lista de espera' : 'Ver lista de espera'}
                </button>
                {waitlistOpen && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Lista de espera</p>
                    </div>
                    <div className="p-3 space-y-3">
                      <form onSubmit={handleAddToWaitlist} className="flex gap-2">
                        <select value={waitlistClient} onChange={e => setWaitlistClient(e.target.value)} required className={`flex-1 ${inp}`}>
                          <option value="">Selecionar cliente</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button type="submit" disabled={addingWaitlist} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-3 rounded-lg whitespace-nowrap">
                          {addingWaitlist ? '...' : '+ Add'}
                        </button>
                      </form>
                      {waitlist.length === 0
                        ? <p className="text-xs text-gray-400 text-center py-2">Nenhum cliente na fila</p>
                        : waitlist.map(e => (
                          <div key={e.id} className="flex items-center justify-between py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 tabular-nums">#{e.position}</span>
                              <div>
                                <p className="text-sm font-medium text-gray-800">{e.client.name}</p>
                                <p className="text-xs text-gray-400">{e.client.phone}</p>
                              </div>
                            </div>
                            <span className={`text-xs ${e.notifiedAt ? 'text-green-600' : 'text-gray-400'}`}>
                              {e.notifiedAt ? 'Notificado' : 'Aguardando'}
                            </span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            )}

            {appointment.status === 'no_show' && (
              <p className="text-sm text-gray-400 text-center py-4">Nenhuma ação disponível para este status.</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── New Appointment Modal ────────────────────────────────────────────────────

function NewAppointmentModal({ clients, professionals, onClose, onCreated, showToast }: {
  clients: Client[]; professionals: Professional[]
  onClose: () => void; onCreated: () => void; showToast: (msg: string) => void
}) {
  const [clientId,       setClientId]       = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [service,        setService]        = useState('')
  const [scheduledAt,    setScheduledAt]    = useState('')
  const [saving,         setSaving]         = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post('/appointments', { clientId, service, scheduledAt: new Date(scheduledAt).toISOString(), professionalId })
      showToast('Agendamento criado com sucesso')
      onCreated()
    } catch { showToast('Erro ao criar agendamento') }
    finally { setSaving(false) }
  }

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Novo agendamento</h2>
              <p className="text-xs text-gray-400 mt-0.5">Preencha os dados do agendamento</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Cliente *</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)} required className={inp}>
                  <option value="">Selecione</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Profissional *</label>
                <select value={professionalId} onChange={e => setProfessionalId(e.target.value)} required className={inp}>
                  <option value="">Selecione</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Serviço *</label>
              <input value={service} onChange={e => setService(e.target.value)} required placeholder="Ex: Consulta, Corte, Massagem" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Data e hora *</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} required className={inp} />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
                {saving ? 'Salvando...' : 'Criar agendamento'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const [appointments,  setAppointments]  = useState<Appointment[]>([])
  const [total,         setTotal]         = useState(0)
  const [totalPages,    setTotalPages]    = useState(1)
  const [page,          setPage]          = useState(1)
  const [clients,       setClients]       = useState<Client[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [selected,      setSelected]      = useState<Appointment | null>(null)
  const [showNew,       setShowNew]       = useState(false)
  const [filterStatus,  setFilterStatus]  = useState('all')
  const [filterPro,     setFilterPro]     = useState('')
  const [search,        setSearch]        = useState('')
  const [period,        setPeriod]        = useState<Period>('week')
  const [anchor,        setAnchor]        = useState(new Date())
  const [inlineLoading, setInlineLoading] = useState<string | null>(null)
  const [toast,         setToast]         = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const { from, to, label } = getPeriodRange(period, anchor)

  const load = useCallback((p = 1) => {
    const params: Record<string, string | number> = { page: p, limit: 20 }
    if (filterStatus !== 'all') params.status = filterStatus
    params.dateFrom = new Date(from).toISOString()
    params.dateTo   = new Date(to + 'T23:59:59').toISOString()
    api.get('/appointments', { params }).then(({ data }) => {
      setAppointments(data.data.appointments)
      setTotal(data.data.total)
      setTotalPages(data.data.totalPages)
    })
  }, [filterStatus, from, to])

  useEffect(() => { setPage(1); load(1) }, [load])

  useEffect(() => {
    api.get('/clients').then(({ data }) => setClients(data.data))
    api.get('/professionals').then(({ data }) => setProfessionals(data.data))
  }, [])

  const proMap = new Map(professionals.map(p => [p.id, p.name]))

  const filtered = appointments.filter(a => {
    const matchSearch = !search ||
      a.client.name.toLowerCase().includes(search.toLowerCase()) ||
      a.service.toLowerCase().includes(search.toLowerCase())
    const matchPro = !filterPro || a.professionalId === filterPro
    return matchSearch && matchPro
  })

  async function handleInlineAction(e: React.MouseEvent, id: string, action: 'confirm' | 'cancel' | 'no-show') {
    e.stopPropagation()
    setInlineLoading(`${id}-${action}`)
    try {
      await api.patch(`/appointments/${id}/${action}`)
      const labels: Record<string, string> = { confirm: 'Confirmado', cancel: 'Cancelado', 'no-show': 'No-show registrado' }
      showToast(labels[action])
      load(page)
    } catch { showToast('Erro ao atualizar') }
    finally { setInlineLoading(null) }
  }

  function goToday()  { setAnchor(new Date()) }
  function goPrev()   { setAnchor(shiftAnchor(period, anchor, -1)) }
  function goNext()   { setAnchor(shiftAnchor(period, anchor, 1)) }

  return (
    <Layout>
      <div className="p-8">
        {toast && <Toast message={toast} />}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {total} agendamento{total !== 1 ? 's' : ''}{search ? ` · ${filtered.length} filtrado${filtered.length !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar cliente ou serviço…"
                className="pl-9 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-60"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              + Novo agendamento
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">

          {/* ── Toolbar ─────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">

            {/* Navegação de período */}
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                {(['day', 'week', 'month'] as Period[]).map(p => (
                  <button
                    key={p}
                    onClick={() => { setPeriod(p); setAnchor(new Date()) }}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${period === p ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    {p === 'day' ? 'Dia' : p === 'week' ? 'Semana' : 'Mês'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <button onClick={goPrev} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                  <ChevronLeft size={15} />
                </button>
                <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  Hoje
                </button>
                <button onClick={goNext} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                  <ChevronRight size={15} />
                </button>
              </div>

              <span className="text-sm font-medium text-gray-700 capitalize">{label}</span>
            </div>

            {/* Filtro por profissional */}
            {professionals.length > 0 && (
              <div className="flex items-center gap-2">
                <User size={14} className="text-gray-400" />
                <select
                  value={filterPro} onChange={e => setFilterPro(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-600"
                >
                  <option value="">Todos os profissionais</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* ── Tabs ──────────────────────────────────────────────────────────── */}
          <div className="flex px-5 border-b border-gray-100">
            {TABS.map(({ key, label: tLabel }) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  filterStatus === key ? 'text-indigo-600 border-indigo-600' : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                {tLabel}
              </button>
            ))}
          </div>

          {/* ── Table ─────────────────────────────────────────────────────────── */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Profissional</th>
                <th className="px-5 py-3">Serviço</th>
                <th className="px-5 py-3">Data e hora</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Risco</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        {search ? <Search size={22} className="text-gray-300" /> : <CalendarDays size={22} className="text-gray-300" />}
                      </div>
                      <p className="text-sm text-gray-400">
                        {search ? `Nenhum resultado para "${search}"` : 'Nenhum agendamento neste período'}
                      </p>
                      {search && (
                        <button onClick={() => setSearch('')} className="text-xs text-indigo-600 hover:underline">
                          Limpar busca
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map(a => {
                const loadingConfirm = inlineLoading === `${a.id}-confirm`
                const loadingCancel  = inlineLoading === `${a.id}-cancel`
                const loadingNoShow  = inlineLoading === `${a.id}-no-show`
                const anyLoading     = loadingConfirm || loadingCancel || loadingNoShow

                return (
                  <tr
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{a.client.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.client.phone}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {(proMap.get(a.professionalId) ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm">{proMap.get(a.professionalId) ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{a.service}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Clock size={13} className="text-gray-400 shrink-0" />
                        <div>
                          <p className="text-sm">{new Date(a.scheduledAt).toLocaleDateString('pt-BR')}</p>
                          <p className="text-xs text-gray-400">{new Date(a.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={a.status} /></td>
                    <td className="px-5 py-3.5 w-32"><RiskBar score={a.riskScore} /></td>

                    {/* Ações inline */}
                    <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {a.status === 'scheduled' && (
                          <>
                            <button
                              onClick={e => handleInlineAction(e, a.id, 'confirm')}
                              disabled={anyLoading}
                              title="Confirmar presença"
                              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
                            >
                              {loadingConfirm ? <span className="text-[10px]">…</span> : <CheckCircle2 size={15} />}
                            </button>
                            <button
                              onClick={e => handleInlineAction(e, a.id, 'cancel')}
                              disabled={anyLoading}
                              title="Cancelar agendamento"
                              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                            >
                              {loadingCancel ? <span className="text-[10px]">…</span> : <XCircle size={15} />}
                            </button>
                          </>
                        )}
                        {a.status === 'confirmed' && (
                          <button
                            onClick={e => handleInlineAction(e, a.id, 'no-show')}
                            disabled={anyLoading}
                            title="Marcar no-show"
                            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors disabled:opacity-40"
                          >
                            {loadingNoShow ? <span className="text-[10px]">…</span> : <AlertCircle size={15} />}
                          </button>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); setSelected(a) }}
                          title="Ver detalhes"
                          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* ── Paginação ─────────────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-gray-500">
              <span>Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { const p = page - 1; setPage(p); load(p) }}
                  disabled={page === 1}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => { const p = page + 1; setPage(p); load(p) }}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <AppointmentDrawer
          appointment={selected} professionals={professionals} clients={clients}
          onClose={() => setSelected(null)}
          onRefresh={() => { load(page); setSelected(null) }}
          showToast={showToast}
        />
      )}

      {showNew && (
        <NewAppointmentModal
          clients={clients} professionals={professionals}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(page) }}
          showToast={showToast}
        />
      )}
    </Layout>
  )
}
