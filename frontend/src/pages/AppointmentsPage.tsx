import { useEffect, useState, FormEvent } from 'react'
import { X, Phone, Calendar, User, Briefcase, CalendarDays, Search } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../services/api'

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

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Agendado',   cls: 'bg-blue-100 text-blue-700'   },
  confirmed: { label: 'Confirmado', cls: 'bg-green-100 text-green-700'  },
  cancelled: { label: 'Cancelado',  cls: 'bg-gray-100 text-gray-500'    },
  no_show:   { label: 'No-show',    cls: 'bg-red-100 text-red-700'      },
}

const TABS = [
  { key: 'all',       label: 'Todos'      },
  { key: 'scheduled', label: 'Agendados'  },
  { key: 'confirmed', label: 'Confirmados'},
  { key: 'no_show',   label: 'No-show'    },
  { key: 'cancelled', label: 'Cancelados' },
]

function todayISO() {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

// ─── Small components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
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

// ─── Appointment Drawer ───────────────────────────────────────────────────────

function AppointmentDrawer({
  appointment, professionals, clients,
  onClose, onRefresh, showToast,
}: {
  appointment: Appointment
  professionals: Professional[]
  clients: Client[]
  onClose: () => void
  onRefresh: (updated?: Partial<Appointment>) => void
  showToast: (msg: string) => void
}) {
  const [rescheduling, setRescheduling]     = useState(false)
  const [newDate, setNewDate]               = useState('')
  const [waitlistOpen, setWaitlistOpen]     = useState(false)
  const [waitlist, setWaitlist]             = useState<WaitlistEntry[]>([])
  const [waitlistClientId, setWaitlistClientId] = useState('')
  const [addingToWaitlist, setAddingToWaitlist] = useState(false)

  const professional = professionals.find(p => p.id === appointment.professionalId)

  const dt = new Date(appointment.scheduledAt)
  const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  async function handleAction(type: 'confirm' | 'cancel' | 'no-show') {
    try {
      await api.patch(`/appointments/${appointment.id}/${type}`)
      const labels = { confirm: 'confirmado', cancel: 'cancelado', 'no-show': 'marcado como no-show' }
      showToast(`Agendamento ${labels[type]}`)
      onRefresh()
    } catch { showToast('Erro ao atualizar agendamento') }
  }

  async function handleReschedule(e: FormEvent) {
    e.preventDefault()
    try {
      await api.patch(`/appointments/${appointment.id}/reschedule`, { scheduledAt: new Date(newDate).toISOString() })
      showToast('Agendamento reagendado')
      setRescheduling(false); setNewDate('')
      onRefresh()
    } catch { showToast('Erro ao reagendar') }
  }

  async function openWaitlist() {
    if (waitlistOpen) { setWaitlistOpen(false); return }
    const { data } = await api.get('/waitlist', { params: { slot: appointment.scheduledAt } })
    setWaitlist(data.data); setWaitlistOpen(true); setWaitlistClientId('')
  }

  async function handleAddToWaitlist(e: FormEvent) {
    e.preventDefault(); setAddingToWaitlist(true)
    try {
      await api.post('/waitlist', { clientId: waitlistClientId, slot: appointment.scheduledAt })
      const { data } = await api.get('/waitlist', { params: { slot: appointment.scheduledAt } })
      setWaitlist(data.data); setWaitlistClientId('')
      showToast('Cliente adicionado à lista de espera')
    } catch { showToast('Erro ao adicionar à lista de espera') }
    finally { setAddingToWaitlist(false) }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Info */}
          <div className="px-6 py-5 space-y-3 border-b border-gray-100">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Calendar size={15} className="text-gray-400 shrink-0" />
              <span className="capitalize">{dateStr} às {timeStr}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <User size={15} className="text-gray-400 shrink-0" />
              <span>{professional?.name ?? 'Profissional não encontrado'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Phone size={15} className="text-gray-400 shrink-0" />
              <span>{appointment.client.phone}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Briefcase size={15} className="text-gray-400 shrink-0" />
              <span>{appointment.service}</span>
            </div>
          </div>

          {/* Status + Risk */}
          <div className="px-6 py-5 space-y-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</span>
              <StatusBadge status={appointment.status} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Risco de no-show</span>
                <RiskBadge score={appointment.riskScore} />
              </div>
              <RiskBar score={appointment.riskScore} />
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-5 space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ações</p>

            {appointment.status === 'scheduled' && (
              <div className="space-y-2">
                <button
                  onClick={() => handleAction('confirm')}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Confirmar presença
                </button>
                <button
                  onClick={() => { setRescheduling(!rescheduling); setNewDate('') }}
                  className="w-full py-2.5 bg-white hover:bg-gray-50 text-indigo-600 text-sm font-semibold rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                >
                  {rescheduling ? 'Cancelar reagendamento' : 'Reagendar'}
                </button>
                {rescheduling && (
                  <form onSubmit={handleReschedule} className="flex gap-2 pt-1">
                    <input
                      type="datetime-local"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      required
                      className={inputCls}
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Confirmar
                    </button>
                  </form>
                )}
                <button
                  onClick={() => handleAction('cancel')}
                  className="w-full py-2.5 bg-white hover:bg-red-50 text-red-600 text-sm font-semibold rounded-lg border border-red-200 transition-colors cursor-pointer"
                >
                  Cancelar agendamento
                </button>
              </div>
            )}

            {appointment.status === 'confirmed' && (
              <button
                onClick={() => handleAction('no-show')}
                className="w-full py-2.5 bg-white hover:bg-orange-50 text-orange-600 text-sm font-semibold rounded-lg border border-orange-200 transition-colors cursor-pointer"
              >
                Marcar como no-show
              </button>
            )}

            {appointment.status === 'cancelled' && (
              <div className="space-y-3">
                <button
                  onClick={openWaitlist}
                  className="w-full py-2.5 bg-white hover:bg-indigo-50 text-indigo-600 text-sm font-semibold rounded-lg border border-indigo-200 transition-colors cursor-pointer"
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
                        <select
                          value={waitlistClientId}
                          onChange={e => setWaitlistClientId(e.target.value)}
                          required
                          className={`flex-1 ${inputCls} bg-white`}
                        >
                          <option value="">Selecionar cliente</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button
                          type="submit"
                          disabled={addingToWaitlist}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {addingToWaitlist ? '...' : '+ Add'}
                        </button>
                      </form>

                      {waitlist.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">Nenhum cliente na fila</p>
                      ) : waitlist.map(e => (
                        <div key={e.id} className="flex items-center justify-between py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 tabular-nums">#{e.position}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{e.client.name}</p>
                              <p className="text-xs text-gray-400">{e.client.phone}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {e.notifiedAt
                              ? <span className="text-xs text-green-600">Notificado</span>
                              : <span className="text-xs text-gray-400">Aguardando</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {appointment.status === 'no_show' && (
              <p className="text-sm text-gray-400 text-center py-2">Nenhuma ação disponível</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── New Appointment Modal ────────────────────────────────────────────────────

function NewAppointmentModal({
  clients, professionals, onClose, onCreated, showToast,
}: {
  clients: Client[]; professionals: Professional[]
  onClose: () => void; onCreated: () => void; showToast: (msg: string) => void
}) {
  const [clientId,      setClientId]      = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [service,       setService]       = useState('')
  const [scheduledAt,   setScheduledAt]   = useState('')
  const [saving,        setSaving]        = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post('/appointments', { clientId, service, scheduledAt: new Date(scheduledAt).toISOString(), professionalId })
      showToast('Agendamento criado')
      onCreated()
    } catch { showToast('Erro ao criar agendamento') }
    finally { setSaving(false) }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Novo agendamento</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Cliente *</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)} required className={inputCls}>
                  <option value="">Selecione</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Profissional *</label>
                <select value={professionalId} onChange={e => setProfessionalId(e.target.value)} required className={inputCls}>
                  <option value="">Selecione</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Serviço *</label>
              <input
                value={service} onChange={e => setService(e.target.value)}
                required placeholder="Ex: Consulta, Corte, Massagem"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Data e hora *</label>
              <input
                type="datetime-local" value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)} required
                className={inputCls}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 cursor-pointer">
                Cancelar
              </button>
              <button
                type="submit" disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
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
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [total,        setTotal]        = useState(0)
  const [totalPages,   setTotalPages]   = useState(1)
  const [page,         setPage]         = useState(1)

  const [clients,       setClients]       = useState<Client[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])

  const [selected,  setSelected]  = useState<Appointment | null>(null)
  const [showNew,   setShowNew]   = useState(false)

  const [filterStatus, setFilterStatus] = useState('all')
  const [dateFrom,     setDateFrom]     = useState(todayISO())
  const [dateTo,       setDateTo]       = useState('')
  const [search,       setSearch]       = useState('')

  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function load(currentPage = page) {
    const params: Record<string, string | number> = { page: currentPage, limit: 20 }
    if (filterStatus !== 'all') params.status = filterStatus
    if (dateFrom) params.dateFrom = new Date(dateFrom).toISOString()
    if (dateTo)   params.dateTo   = new Date(dateTo + 'T23:59:59').toISOString()
    api.get('/appointments', { params }).then(({ data }) => {
      setAppointments(data.data.appointments)
      setTotal(data.data.total)
      setTotalPages(data.data.totalPages)
    })
  }

  const filtered = appointments.filter(a =>
    a.client.name.toLowerCase().includes(search.toLowerCase()) ||
    a.service.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => { setPage(1); load(1) }, [filterStatus, dateFrom, dateTo]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    api.get('/clients').then(({ data }) => setClients(data.data))
    api.get('/professionals').then(({ data }) => setProfessionals(data.data))
  }, [])

  function handleRefresh() {
    load(page)
    setSelected(null)
  }

  return (
    <Layout>
      <div className="p-8">
        {toast && (
          <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {search ? `${filtered.length} de ${total}` : total} agendamento{total !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por cliente ou serviço"
                className="pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              + Novo agendamento
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <label className="font-medium text-gray-500 text-xs uppercase tracking-wide">De</label>
              <input
                type="date" value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <label className="font-medium text-gray-500 text-xs uppercase tracking-wide">Até</label>
              <input
                type="date" value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo('') }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 px-5 border-b border-gray-100">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer border-b-2 ${
                  filterStatus === key
                    ? 'text-indigo-600 border-indigo-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Serviço</th>
                <th className="px-5 py-3">Data e hora</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Risco</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        {search
                          ? <Search size={22} className="text-gray-300" />
                          : <CalendarDays size={22} className="text-gray-300" />
                        }
                      </div>
                      {search ? (
                        <>
                          <p className="text-sm text-gray-400">Nenhum resultado para "{search}"</p>
                          <button
                            onClick={() => setSearch('')}
                            className="text-xs text-indigo-600 hover:underline cursor-pointer"
                          >
                            Limpar busca
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">Nenhum agendamento encontrado</p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map(a => (
                <tr
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{a.client.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{a.client.phone}</p>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{a.service}</td>
                  <td className="px-5 py-3.5 text-gray-600">
                    <p>{new Date(a.scheduledAt).toLocaleDateString('pt-BR')}</p>
                    <p className="text-xs text-gray-400">{new Date(a.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={a.status} /></td>
                  <td className="px-5 py-3.5 w-36"><RiskBar score={a.riskScore} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-gray-500">
              <span>Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { const p = page - 1; setPage(p); load(p) }}
                  disabled={page === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => { const p = page + 1; setPage(p); load(p) }}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors cursor-pointer"
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
          appointment={selected}
          professionals={professionals}
          clients={clients}
          onClose={() => setSelected(null)}
          onRefresh={handleRefresh}
          showToast={showToast}
        />
      )}

      {showNew && (
        <NewAppointmentModal
          clients={clients}
          professionals={professionals}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(page) }}
          showToast={showToast}
        />
      )}
    </Layout>
  )
}
