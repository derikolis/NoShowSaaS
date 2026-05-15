import { useEffect, useState, FormEvent } from 'react'
import Layout from '../components/Layout'
import api from '../services/api'

interface Client { id: string; name: string }
interface Professional { id: string; name: string; role: string }
interface WaitlistEntry { id: string; position: number; client: { name: string; phone: string }; notifiedAt: string | null; acceptedAt: string | null }

interface Appointment {
  id: string
  service: string
  scheduledAt: string
  status: string
  riskScore: number
  client: { name: string; phone: string }
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  no_show: 'No-show',
}

const STATUS_CLASS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  no_show: 'bg-red-100 text-red-700',
}

function RiskBadge({ score }: { score: number }) {
  if (score <= 30) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Baixo</span>
  if (score <= 60) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Médio</span>
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Alto</span>
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [showForm, setShowForm] = useState(false)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [newScheduledAt, setNewScheduledAt] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)

  const [clientId, setClientId] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [service, setService] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  const [waitlistSlot, setWaitlistSlot] = useState<string | null>(null)
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [waitlistClientId, setWaitlistClientId] = useState('')
  const [addingToWaitlist, setAddingToWaitlist] = useState(false)

  function load() {
    api.get('/appointments').then(({ data }) => setAppointments(data.data))
  }

  useEffect(() => {
    load()
    api.get('/clients').then(({ data }) => setClients(data.data))
    api.get('/professionals').then(({ data }) => setProfessionals(data.data))
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const iso = new Date(scheduledAt).toISOString()
      await api.post('/appointments', { clientId, service, scheduledAt: iso, professionalId })
      setClientId(''); setService(''); setScheduledAt('')
      setShowForm(false)
      load()
      showToast('Agendamento criado com sucesso')
    } catch {
      showToast('Erro ao criar agendamento')
    } finally {
      setSaving(false)
    }
  }

  async function handleReschedule(e: React.FormEvent) {
    e.preventDefault()
    if (!rescheduleId) return
    try {
      await api.patch(`/appointments/${rescheduleId}/reschedule`, { scheduledAt: new Date(newScheduledAt).toISOString() })
      load()
      setRescheduleId(null)
      setNewScheduledAt('')
      showToast('Agendamento reagendado')
    } catch {
      showToast('Erro ao reagendar')
    }
  }

  async function openWaitlist(slot: string) {
    if (waitlistSlot === slot) { setWaitlistSlot(null); return }
    setWaitlistSlot(slot)
    const { data } = await api.get('/waitlist', { params: { slot } })
    setWaitlist(data.data)
    setWaitlistClientId('')
  }

  async function handleAddToWaitlist(e: FormEvent) {
    e.preventDefault()
    if (!waitlistSlot) return
    setAddingToWaitlist(true)
    try {
      await api.post('/waitlist', { clientId: waitlistClientId, slot: waitlistSlot })
      const { data } = await api.get('/waitlist', { params: { slot: waitlistSlot } })
      setWaitlist(data.data)
      setWaitlistClientId('')
      showToast('Cliente adicionado à lista de espera')
    } catch {
      showToast('Erro ao adicionar à lista de espera')
    } finally {
      setAddingToWaitlist(false)
    }
  }

  async function action(id: string, type: 'confirm' | 'cancel' | 'no-show') {
    try {
      await api.patch(`/appointments/${id}/${type}`)
      load()
      const labels = { confirm: 'confirmado', cancel: 'cancelado', 'no-show': 'marcado como no-show' }
      showToast(`Agendamento ${labels[type]}`)
    } catch {
      showToast('Erro ao atualizar agendamento')
    }
  }

  const filtered = filterStatus === 'all'
    ? appointments
    : appointments.filter(a => a.status === filterStatus)

  const tabs = [
    { key: 'all', label: 'Todos' },
    { key: 'scheduled', label: 'Agendados' },
    { key: 'confirmed', label: 'Confirmados' },
    { key: 'no_show', label: 'No-show' },
    { key: 'cancelled', label: 'Cancelados' },
  ]

  return (
    <Layout>
      <div className="p-8">
        {toast && (
          <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
            {toast}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {showForm ? 'Cancelar' : '+ Novo agendamento'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-gray-800 mb-4">Novo agendamento</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cliente *</label>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Profissional *</label>
                <select
                  value={professionalId}
                  onChange={e => setProfessionalId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Selecione o profissional</option>
                  {professionals.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Serviço *</label>
                <input
                  value={service}
                  onChange={e => setService(e.target.value)}
                  required
                  placeholder="Ex: Consulta, Corte, Massagem"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data e hora *</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Salvando...' : 'Salvar agendamento'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex gap-1 px-4 pt-4 border-b border-gray-100">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  filterStatus === key
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3">Serviço</th>
                <th className="px-6 py-3">Data/Hora</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Risco</th>
                <th className="px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Nenhum agendamento encontrado
                  </td>
                </tr>
              )}
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{a.client.name}</td>
                  <td className="px-6 py-3 text-gray-600">{a.service}</td>
                  <td className="px-6 py-3 text-gray-600">{new Date(a.scheduledAt).toLocaleString('pt-BR')}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLASS[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </td>
                  <td className="px-6 py-3"><RiskBadge score={a.riskScore} /></td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      {a.status === 'scheduled' && (
                        <>
                          <button onClick={() => action(a.id, 'confirm')} className="text-xs text-green-700 hover:text-green-900 font-medium">Confirmar</button>
                          <button onClick={() => setRescheduleId(rescheduleId === a.id ? null : a.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Reagendar</button>
                          <button onClick={() => action(a.id, 'cancel')} className="text-xs text-red-600 hover:text-red-800 font-medium">Cancelar</button>
                        </>
                      )}
                      {rescheduleId === a.id && (
                        <form onSubmit={handleReschedule} className="flex gap-2 mt-1 col-span-full">
                          <input
                            type="datetime-local"
                            value={newScheduledAt}
                            onChange={e => setNewScheduledAt(e.target.value)}
                            required
                            className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button type="submit" className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700">Confirmar</button>
                        </form>
                      )}
                      {a.status === 'confirmed' && (
                        <button
                          onClick={() => action(a.id, 'no-show')}
                          className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                        >
                          No-show
                        </button>
                      )}
                      {a.status === 'cancelled' && (
                        <button
                          onClick={() => openWaitlist(a.scheduledAt)}
                          className={`text-xs font-medium px-2 py-0.5 rounded transition-colors ${waitlistSlot === a.scheduledAt ? 'bg-indigo-100 text-indigo-700' : 'text-indigo-600 hover:text-indigo-800'}`}
                        >
                          Lista de espera
                        </button>
                      )}
                      {a.status === 'no_show' && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {waitlistSlot && (
        <div className="mx-8 mb-8 bg-white rounded-xl shadow-sm border border-indigo-100">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">Lista de espera</h2>
              <p className="text-xs text-gray-400 mt-0.5">{new Date(waitlistSlot).toLocaleString('pt-BR')}</p>
            </div>
            <button onClick={() => setWaitlistSlot(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
          </div>

          <div className="p-6">
            <form onSubmit={handleAddToWaitlist} className="flex gap-3 mb-5">
              <select
                value={waitlistClientId}
                onChange={e => setWaitlistClientId(e.target.value)}
                required
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Selecione o cliente para adicionar</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={addingToWaitlist}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                {addingToWaitlist ? 'Adicionando...' : '+ Adicionar'}
              </button>
            </form>

            {waitlist.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum cliente na lista de espera</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="pb-2">Posição</th>
                    <th className="pb-2">Cliente</th>
                    <th className="pb-2">Telefone</th>
                    <th className="pb-2">Notificado</th>
                    <th className="pb-2">Confirmou</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {waitlist.map(e => (
                    <tr key={e.id}>
                      <td className="py-2 text-gray-500">#{e.position}</td>
                      <td className="py-2 font-medium text-gray-900">{e.client.name}</td>
                      <td className="py-2 text-gray-500">{e.client.phone}</td>
                      <td className="py-2">
                        {e.notifiedAt
                          ? <span className="text-xs text-green-600">Sim</span>
                          : <span className="text-xs text-gray-400">Não</span>}
                      </td>
                      <td className="py-2">
                        {e.acceptedAt
                          ? <span className="text-xs text-green-600">Sim</span>
                          : <span className="text-xs text-gray-400">Aguardando</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
