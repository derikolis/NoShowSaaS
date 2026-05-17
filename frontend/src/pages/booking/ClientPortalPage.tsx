import { useEffect, useState, FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Clock, Loader2, LogOut, Phone, Lock, XCircle, AlertCircle } from 'lucide-react'
import api from '../../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Appointment {
  id:               string
  service:          string
  professionalName: string
  scheduledAt:      string
  status:           string
  createdAt:        string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function storageKey(slug: string) { return `noshow_client_${slug}` }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    scheduled:  { label: 'Agendado',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    confirmed:  { label: 'Confirmado', cls: 'bg-green-50 text-green-700 border-green-200' },
    cancelled:  { label: 'Cancelado',  cls: 'bg-gray-100 text-gray-500 border-gray-200' },
    no_show:    { label: 'Faltou',     cls: 'bg-red-50 text-red-600 border-red-200' },
    completed:  { label: 'Realizado',  cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500 border-gray-200' }
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ClientPortalPage() {
  const { slug } = useParams<{ slug: string }>()

  const [tenantName,  setTenantName]  = useState('')
  const [notFound,    setNotFound]    = useState(false)
  const [token,       setToken]       = useState(() => localStorage.getItem(storageKey(slug!)) ?? '')
  const [clientName,  setClientName]  = useState('')

  // Login state
  const [phone,       setPhone]       = useState('')
  const [password,    setPassword]    = useState('')
  const [logging,     setLogging]     = useState(false)
  const [loginErr,    setLoginErr]    = useState('')

  // Appointments state
  const [appts,       setAppts]       = useState<Appointment[]>([])
  const [loading,     setLoading]     = useState(false)
  const [cancelling,  setCancelling]  = useState<string | null>(null)
  const [cancelErr,   setCancelErr]   = useState('')

  // Load tenant name
  useEffect(() => {
    api.get(`/booking/${slug}`)
      .then(({ data }) => setTenantName(data.data?.tenant?.name ?? ''))
      .catch(() => setNotFound(true))
  }, [slug])

  // Load appointments when token is available
  useEffect(() => {
    if (!token) return
    setLoading(true)
    api.get(`/booking/${slug}/my/appointments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(({ data }) => setAppts(data.data))
      .catch(() => { setToken(''); localStorage.removeItem(storageKey(slug!)) })
      .finally(() => setLoading(false))
  }, [token, slug])

  // Decode client name from JWT payload
  useEffect(() => {
    if (!token) return
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setClientName(payload.name ?? '')
    } catch { /* ignore */ }
  }, [token])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoginErr(''); setLogging(true)
    try {
      const { data } = await api.post(`/booking/${slug}/login`, { phone, password })
      const t = data.data?.token
      if (!t) throw new Error('Token não recebido')
      localStorage.setItem(storageKey(slug!), t)
      setToken(t)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setLoginErr(msg ?? 'Telefone ou senha incorretos.')
    } finally { setLogging(false) }
  }

  function handleLogout() {
    localStorage.removeItem(storageKey(slug!))
    setToken(''); setAppts([]); setPhone(''); setPassword('')
  }

  async function handleCancel(id: string) {
    if (!confirm('Deseja cancelar este agendamento?')) return
    setCancelErr(''); setCancelling(id)
    try {
      await api.patch(`/booking/${slug}/my/appointments/${id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setAppts(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setCancelErr(msg ?? 'Erro ao cancelar. Tente novamente.')
    } finally { setCancelling(null) }
  }

  const now = new Date()
  const upcoming = appts.filter(a => new Date(a.scheduledAt) > now && a.status !== 'cancelled')
  const past     = appts.filter(a => new Date(a.scheduledAt) <= now || a.status === 'cancelled')

  // ── Not found ────────────────────────────────────────────────────────────

  if (notFound) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4 text-center">
      <CalendarDays size={32} className="text-gray-300" />
      <p className="text-gray-500 text-sm">Empresa não encontrada.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">Minha conta</p>
          <h1 className="text-lg font-bold text-gray-900">{tenantName}</h1>
        </div>
        {token && (
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 cursor-pointer">
            <LogOut size={15} /> Sair
          </button>
        )}
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">

        {/* ── Login ── */}
        {!token && (
          <div>
            <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={24} className="text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-1">Entrar na minha conta</h2>
            <p className="text-sm text-gray-500 text-center mb-6">Acompanhe e gerencie seus agendamentos</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Phone size={13} className="inline mr-1.5 text-gray-400" />WhatsApp
                </label>
                <input
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  required minLength={10} placeholder="(11) 99999-0001" autoFocus
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <Lock size={13} className="inline mr-1.5 text-gray-400" />Senha
                </label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required placeholder="Sua senha"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {loginErr && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{loginErr}</p>
              )}

              <button
                type="submit" disabled={logging}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {logging ? <><Loader2 size={18} className="animate-spin" /> Entrando...</> : 'Entrar'}
              </button>
            </form>

            <div className="mt-5 flex flex-col items-center gap-2 text-sm">
              <Link to={`/agendar/${slug}`} className="text-indigo-500 hover:text-indigo-700">
                Fazer novo agendamento
              </Link>
              <Link to={`/agendar/${slug}?forgot=1`} className="text-gray-400 hover:text-gray-600 text-xs">
                Esqueci minha senha
              </Link>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {token && loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="text-indigo-500 animate-spin" />
          </div>
        )}

        {/* ── Appointments ── */}
        {token && !loading && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Olá, {clientName}!</h2>
                <p className="text-sm text-gray-500">Seus agendamentos</p>
              </div>
              <Link
                to={`/agendar/${slug}`}
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-4 py-2 rounded-lg"
              >
                + Novo
              </Link>
            </div>

            {cancelErr && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
                <AlertCircle size={16} /> {cancelErr}
              </div>
            )}

            {/* Próximos */}
            {upcoming.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Próximos</p>
                <div className="space-y-3">
                  {upcoming.map(a => (
                    <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">{a.service}</p>
                          <p className="text-sm text-gray-500">{a.professionalName}</p>
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 border-t border-gray-50 pt-3">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays size={13} className="text-gray-400" />
                          {fmtDate(a.scheduledAt)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} className="text-gray-400" />
                          {fmtTime(a.scheduledAt)}
                        </span>
                        <button
                          onClick={() => handleCancel(a.id)}
                          disabled={cancelling === a.id}
                          className="ml-auto flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50 cursor-pointer font-medium"
                        >
                          {cancelling === a.id
                            ? <Loader2 size={13} className="animate-spin" />
                            : <XCircle size={13} />
                          }
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Sem próximos */}
            {upcoming.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                <CheckCircle2 size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">Nenhum agendamento futuro</p>
                <Link to={`/agendar/${slug}`} className="text-sm text-indigo-500 hover:text-indigo-700 mt-2 block">
                  Agendar agora
                </Link>
              </div>
            )}

            {/* Histórico */}
            {past.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Histórico</p>
                <div className="space-y-2">
                  {past.map(a => (
                    <div key={a.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-700 truncate">{a.service}</p>
                        <p className="text-xs text-gray-400">{a.professionalName} · {fmtDate(a.scheduledAt)} {fmtTime(a.scheduledAt)}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="text-center py-6">
        <p className="text-xs text-gray-300">Powered by Kired</p>
      </footer>
    </div>
  )
}
