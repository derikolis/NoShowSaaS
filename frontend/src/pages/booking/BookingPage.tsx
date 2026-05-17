import { useEffect, useState, FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Clock, CheckCircle2, ChevronLeft, User, CalendarDays, Phone, Mail, Loader2, Copy, Check, KeyRound, MessageCircle } from 'lucide-react'
import api from '../../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Service      { id: string; name: string; description: string | null; duration: number; price: number | null }
interface Professional { id: string; name: string }
interface TenantData   { tenant: { name: string }; services: Service[]; professionals: Professional[] }
interface BookingResult {
  appointment: { id: string; service: string; professional: string; scheduledAt: string; duration: number }
  client: { name: string; phone: string }
  payment: { pixQrCode: string; pixQrCodeBase64: string | null; amount: number } | null
}

type Step = 1 | 2 | 3 | 4 | 'done'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

function fmtPrice(price: number | null) {
  if (price === null) return null
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

function getNextDays(count = 30) {
  const days = []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let i = 0; i < count; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i)
    days.push({
      iso:     d.toISOString().split('T')[0],
      day:     d.getDate(),
      weekday: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      month:   d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      isToday: i === 0,
    })
  }
  return days
}

const DAYS = getNextDays()

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const steps = ['Serviço', 'Profissional', 'Data', 'Contato']
  const current = step === 'done' ? 5 : (step as number)
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const n = i + 1
        const done    = current > n
        const active  = current === n
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                done   ? 'bg-indigo-600 text-white' :
                active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' :
                         'bg-gray-100 text-gray-400'
              }`}>
                {done ? <CheckCircle2 size={16} /> : n}
              </div>
              <span className={`text-[10px] font-medium hidden sm:block ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-10 sm:w-16 h-0.5 mx-1 mb-4 ${current > n ? 'bg-indigo-600' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

// ─── PIX Screen ──────────────────────────────────────────────────────────────

function PixScreen({ payment }: { payment: { pixQrCode: string; pixQrCodeBase64: string | null; amount: number } }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(payment.pixQrCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="mb-6">
      <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 size={40} className="text-indigo-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Agendamento criado!</h2>
      <p className="text-gray-500 text-sm mb-6">
        Para garantir seu horário, pague o sinal de{' '}
        <strong className="text-gray-800">
          {payment.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </strong>{' '}
        via PIX.
      </p>

      {payment.pixQrCodeBase64 && (
        <div className="flex justify-center mb-4">
          <img
            src={`data:image/png;base64,${payment.pixQrCodeBase64}`}
            alt="QR Code PIX"
            className="w-44 h-44 border border-gray-200 rounded-xl"
          />
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3">
        <p className="text-[11px] text-gray-400 mb-1.5 font-medium uppercase tracking-wide">PIX Copia e Cola</p>
        <p className="text-xs text-gray-700 font-mono break-all leading-relaxed">{payment.pixQrCode}</p>
      </div>

      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
          copied
            ? 'bg-green-100 text-green-700 border border-green-200'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
        }`}
      >
        {copied ? <><Check size={15} /> Copiado!</> : <><Copy size={15} /> Copiar código PIX</>}
      </button>

      <p className="mt-3 text-[11px] text-gray-400">
        O pagamento é processado pelo Mercado Pago. Após confirmar, você receberá um lembrete.
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()

  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [data,      setData]      = useState<TenantData | null>(null)
  const [step,      setStep]      = useState<Step>(1)

  // Reset de senha
  type ResetStep = 'request' | 'choose' | 'code' | 'email-sent' | 'new-password' | 'done'
  const [resetStep,    setResetStep]    = useState<ResetStep | null>(null)
  const [resetPhone,   setResetPhone]   = useState('')
  const [resetMethod,  setResetMethod]  = useState<'whatsapp' | 'email'>('whatsapp')
  const [resetHint,    setResetHint]    = useState('')
  const [resetCode,    setResetCode]    = useState('')
  const [resetToken,   setResetToken]   = useState('')
  const [resetNewPw,   setResetNewPw]   = useState('')
  const [resetConfPw,  setResetConfPw]  = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetErr,     setResetErr]     = useState('')

  // Selections
  const [service,  setService]  = useState<Service | null>(null)
  const [pro,      setPro]      = useState<Professional | null>(null)
  const [date,     setDate]     = useState('')
  const [slot,     setSlot]     = useState('')

  // Slots
  const [slots,        setSlots]        = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Contact form
  const [phone,        setPhone]        = useState('')
  const [lookingUp,    setLookingUp]    = useState(false)
  const [knownClient,  setKnownClient]  = useState<{ name: string; email: string | null } | null>(null)
  const [phoneChecked, setPhoneChecked] = useState(false)
  const [name,         setName]         = useState('')
  const [email,        setEmail]        = useState('')
  const [consented,    setConsented]    = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [submitErr,    setSubmitErr]    = useState('')
  const [booking,      setBooking]      = useState<BookingResult | null>(null)

  // Load tenant info
  useEffect(() => {
    api.get(`/booking/${slug}`)
      .then(({ data: res }) => setData(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  // Detecta link de reset por e-mail (?reset=TOKEN)
  useEffect(() => {
    const token = searchParams.get('reset')
    if (token) { setResetToken(token); setResetStep('new-password') }
  }, [searchParams])

  // Load slots when date or pro changes (on step 3)
  useEffect(() => {
    if (!date || !pro || !service) return
    setSlotsLoading(true)
    setSlot('')
    api.get(`/booking/${slug}/slots`, {
      params: { date, professionalId: pro.id, duration: service.duration },
    })
      .then(({ data: res }) => setSlots(res.data))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [date, pro, service, slug])

  async function handlePhoneLookup(e: FormEvent) {
    e.preventDefault()
    if (phone.replace(/\D/g, '').length < 10) return
    setLookingUp(true)
    try {
      const { data: res } = await api.get(`/booking/${slug}/client`, { params: { phone } })
      if (res.data) {
        setKnownClient(res.data)
        setName(res.data.name)
        setEmail(res.data.email ?? '')
      } else {
        setKnownClient(null)
      }
      setPhoneChecked(true)
    } catch {
      setPhoneChecked(true)
    } finally {
      setLookingUp(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitErr('')
    setSubmitting(true)
    try {
      const { data: res } = await api.post(`/booking/${slug}`, {
        serviceId:      service!.id,
        professionalId: pro!.id,
        scheduledAt:    slot,
        name, phone,
        email: email || undefined,
        consented,
      })
      setBooking(res.data)
      setStep('done')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setSubmitErr(msg ?? 'Erro ao confirmar agendamento. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Reset handlers ──────────────────────────────────────────────────────

  async function handleResetRequest(e: FormEvent) {
    e.preventDefault()
    setResetErr(''); setResetLoading(true)
    try {
      const { data: res } = await api.post(`/booking/${slug}/reset-request`, { phone: resetPhone, method: resetMethod })
      setResetHint(res.data?.hint ?? '')
      if (resetMethod === 'whatsapp') setResetStep('code')
      else setResetStep('email-sent')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setResetErr(msg ?? 'Erro ao enviar. Tente novamente.')
    } finally { setResetLoading(false) }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault()
    if (resetNewPw !== resetConfPw) { setResetErr('As senhas não coincidem.'); return }
    setResetErr(''); setResetLoading(true)
    try {
      await api.post(`/booking/${slug}/reset-verify`, { phone: resetPhone, code: resetCode, newPassword: resetNewPw })
      setResetStep('done')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setResetErr(msg ?? 'Código inválido ou expirado.')
    } finally { setResetLoading(false) }
  }

  async function handleNewPassword(e: FormEvent) {
    e.preventDefault()
    if (resetNewPw !== resetConfPw) { setResetErr('As senhas não coincidem.'); return }
    setResetErr(''); setResetLoading(true)
    try {
      await api.post(`/booking/${slug}/reset-confirm`, { resetToken, newPassword: resetNewPw })
      setResetStep('done')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setResetErr(msg ?? 'Link inválido ou expirado.')
    } finally { setResetLoading(false) }
  }

  function exitReset() {
    setResetStep(null); setResetPhone(''); setResetCode(''); setResetNewPw('')
    setResetConfPw(''); setResetToken(''); setResetHint(''); setResetErr('')
    setResetMethod('whatsapp')
  }

  // ── Loading / Not found ──────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 size={32} className="text-indigo-600 animate-spin" />
    </div>
  )

  if (notFound || !data) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
        <CalendarDays size={28} className="text-gray-300" />
      </div>
      <h1 className="text-xl font-bold text-gray-800">Página não encontrada</h1>
      <p className="text-sm text-gray-500">O link de agendamento que você acessou não existe ou está desativado.</p>
    </div>
  )

  const { tenant, services, professionals } = data

  // ── Reset de senha ───────────────────────────────────────────────────────

  if (resetStep !== null) {
    const inputCls = 'w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-gray-100 px-4 py-4 text-center">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">Agendamento</p>
          <h1 className="text-lg font-bold text-gray-900">{tenant.name}</h1>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="max-w-sm w-full">

            {/* ── Tela: solicitar reset ── */}
            {(resetStep === 'request' || resetStep === 'choose') && (
              <div>
                <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <KeyRound size={24} className="text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 text-center mb-1">Esqueci minha senha</h2>
                <p className="text-sm text-gray-500 text-center mb-6">Informe seu telefone e como quer receber o código</p>

                <form onSubmit={handleResetRequest} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Seu WhatsApp</label>
                    <input type="tel" value={resetPhone} onChange={e => setResetPhone(e.target.value)}
                      required minLength={10} placeholder="(11) 99999-0001" autoFocus className={inputCls} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Como prefere receber?</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setResetMethod('whatsapp')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          resetMethod === 'whatsapp' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <MessageCircle size={20} className={resetMethod === 'whatsapp' ? 'text-indigo-600' : 'text-gray-400'} />
                        <span className={`text-sm font-semibold ${resetMethod === 'whatsapp' ? 'text-indigo-700' : 'text-gray-600'}`}>WhatsApp</span>
                        <span className="text-[10px] text-gray-400">Código de 6 dígitos</span>
                      </button>
                      <button type="button" onClick={() => setResetMethod('email')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          resetMethod === 'email' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <Mail size={20} className={resetMethod === 'email' ? 'text-indigo-600' : 'text-gray-400'} />
                        <span className={`text-sm font-semibold ${resetMethod === 'email' ? 'text-indigo-700' : 'text-gray-600'}`}>E-mail</span>
                        <span className="text-[10px] text-gray-400">Link na caixa de entrada</span>
                      </button>
                    </div>
                  </div>

                  {resetErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{resetErr}</p>}

                  <button type="submit" disabled={resetLoading || resetPhone.replace(/\D/g,'').length < 10}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2">
                    {resetLoading ? <><Loader2 size={18} className="animate-spin" /> Enviando...</> : 'Enviar'}
                  </button>
                  <button type="button" onClick={exitReset} className="w-full text-sm text-gray-400 hover:text-gray-600 cursor-pointer py-2">
                    Voltar
                  </button>
                </form>
              </div>
            )}

            {/* ── Tela: código WhatsApp + nova senha ── */}
            {resetStep === 'code' && (
              <div>
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle size={24} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 text-center mb-1">Código enviado!</h2>
                <p className="text-sm text-gray-500 text-center mb-6">
                  Enviamos um código para o WhatsApp terminado em <strong>...{resetHint}</strong>. Válido por 10 minutos.
                </p>
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Código de 6 dígitos</label>
                    <input value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                      required minLength={6} maxLength={6} placeholder="000000" autoFocus
                      className={`${inputCls} text-center text-2xl tracking-widest font-bold`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nova senha</label>
                    <input type="password" value={resetNewPw} onChange={e => setResetNewPw(e.target.value)}
                      required minLength={6} placeholder="Mínimo 6 caracteres" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar senha</label>
                    <input type="password" value={resetConfPw} onChange={e => setResetConfPw(e.target.value)}
                      required minLength={6} placeholder="Repita a senha" className={inputCls} />
                  </div>
                  {resetErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{resetErr}</p>}
                  <button type="submit" disabled={resetLoading || resetCode.length < 6 || !resetNewPw}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2">
                    {resetLoading ? <><Loader2 size={18} className="animate-spin" /> Verificando...</> : 'Redefinir senha'}
                  </button>
                  <button type="button" onClick={() => setResetStep('request')} className="w-full text-sm text-gray-400 hover:text-gray-600 cursor-pointer py-2">
                    Não recebi — tentar novamente
                  </button>
                </form>
              </div>
            )}

            {/* ── Tela: e-mail enviado ── */}
            {resetStep === 'email-sent' && (
              <div className="text-center">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail size={24} className="text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Verifique seu e-mail</h2>
                <p className="text-sm text-gray-500 mb-2">
                  Enviamos um link para <strong>{resetHint}</strong>.
                </p>
                <p className="text-xs text-gray-400 mb-6">O link expira em 1 hora. Verifique também o spam.</p>
                <button onClick={() => setResetStep('request')} className="text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium">
                  Não recebi — tentar novamente
                </button>
                <button onClick={exitReset} className="block w-full mt-3 text-sm text-gray-400 hover:text-gray-600 cursor-pointer">
                  Voltar ao agendamento
                </button>
              </div>
            )}

            {/* ── Tela: nova senha via link de e-mail ── */}
            {resetStep === 'new-password' && (
              <div>
                <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <KeyRound size={24} className="text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 text-center mb-1">Criar nova senha</h2>
                <p className="text-sm text-gray-500 text-center mb-6">Escolha uma senha com pelo menos 6 caracteres.</p>
                <form onSubmit={handleNewPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nova senha</label>
                    <input type="password" value={resetNewPw} onChange={e => setResetNewPw(e.target.value)}
                      required minLength={6} placeholder="Mínimo 6 caracteres" autoFocus className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar senha</label>
                    <input type="password" value={resetConfPw} onChange={e => setResetConfPw(e.target.value)}
                      required minLength={6} placeholder="Repita a senha" className={inputCls} />
                  </div>
                  {resetErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{resetErr}</p>}
                  <button type="submit" disabled={resetLoading || !resetNewPw || !resetConfPw}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2">
                    {resetLoading ? <><Loader2 size={18} className="animate-spin" /> Salvando...</> : 'Salvar nova senha'}
                  </button>
                </form>
              </div>
            )}

            {/* ── Tela: sucesso ── */}
            {resetStep === 'done' && (
              <div className="text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={28} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Senha redefinida!</h2>
                <p className="text-sm text-gray-500 mb-6">Sua senha foi atualizada com sucesso.</p>
                <button onClick={exitReset}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors cursor-pointer">
                  Voltar ao agendamento
                </button>
              </div>
            )}

          </div>
        </main>
      </div>
    )
  }

  // ── Confirmation screen ──────────────────────────────────────────────────

  if (step === 'done' && booking) return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 px-4 py-4 text-center">
        <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">Agendamento</p>
        <h1 className="text-lg font-bold text-gray-900">{tenant.name}</h1>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="max-w-sm w-full text-center">

          {booking.payment ? (
            <PixScreen payment={booking.payment} />
          ) : (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Confirmado!</h2>
              <p className="text-gray-500 text-sm mb-8">
                Você receberá uma mensagem de lembrete antes do horário.
              </p>
            </>
          )}

          <Card className="text-left mb-6">
            <div className="p-5 space-y-3">
              {[
                { label: 'Serviço',       value: booking.appointment.service },
                { label: 'Profissional',  value: booking.appointment.professional },
                { label: 'Data',          value: fmtDateLong(booking.appointment.scheduledAt) },
                { label: 'Horário',       value: `${fmtTime(booking.appointment.scheduledAt)} · ${fmtDuration(booking.appointment.duration)}` },
                { label: 'Nome',          value: booking.client.name },
                { label: 'WhatsApp',      value: booking.client.phone },
              ].map(row => (
                <div key={row.label} className="flex justify-between gap-4">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide shrink-0">{row.label}</span>
                  <span className="text-sm font-medium text-gray-800 text-right">{row.value}</span>
                </div>
              ))}
            </div>
          </Card>
          <button
            onClick={() => {
              setStep(1); setService(null); setPro(null)
              setDate(''); setSlot(''); setName(''); setPhone(''); setEmail(''); setConsented(false)
            }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
          >
            Fazer outro agendamento
          </button>
        </div>
      </main>
    </div>
  )

  // ── Main layout ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 text-center">
        <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">Agendamento online</p>
        <h1 className="text-lg font-bold text-gray-900">{tenant.name}</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <StepBar step={step} />

        {/* ── Step 1: Serviço ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Qual serviço você precisa?</h2>
            <p className="text-sm text-gray-400 mb-5">Selecione o serviço desejado</p>
            {services.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-sm text-gray-400">Nenhum serviço disponível no momento.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {services.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setService(s); setStep(2) }}
                    className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                          {s.name}
                        </p>
                        {s.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{s.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-sm text-gray-500 justify-end">
                          <Clock size={13} className="text-gray-400" />
                          {fmtDuration(s.duration)}
                        </div>
                        {fmtPrice(s.price) && (
                          <p className="text-sm font-semibold text-indigo-700 mt-0.5">{fmtPrice(s.price)}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Profissional ─────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 cursor-pointer mb-4">
              <ChevronLeft size={16} /> Voltar
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Com quem?</h2>
            <p className="text-sm text-gray-400 mb-5">Escolha o profissional</p>

            <div className="space-y-3">
              {professionals.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-sm text-gray-400">Nenhum profissional disponível.</p>
                </Card>
              ) : (
                professionals.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setPro(p); setStep(3) }}
                    className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group flex items-center gap-4"
                  >
                    <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-indigo-700">
                        {p.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">{p.name}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Data e Horário ───────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <button onClick={() => { setStep(2); setDate(''); setSlot('') }} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 cursor-pointer mb-4">
              <ChevronLeft size={16} /> Voltar
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Quando?</h2>
            <p className="text-sm text-gray-400 mb-5">Escolha o dia e horário</p>

            {/* Selected summary */}
            <Card className="p-4 mb-5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <User size={15} className="text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400">Profissional</p>
                <p className="text-sm font-semibold text-gray-900">{pro?.name}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-gray-400">Serviço</p>
                <p className="text-sm font-semibold text-gray-900">{service?.name}</p>
              </div>
            </Card>

            {/* Days strip */}
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Selecione o dia</p>
            <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none">
              {DAYS.map(d => (
                <button
                  key={d.iso}
                  onClick={() => setDate(d.iso)}
                  className={`flex flex-col items-center p-3 rounded-xl min-w-14 transition-all cursor-pointer border ${
                    date === d.iso
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-105'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'
                  }`}
                >
                  <span className={`text-[10px] font-semibold uppercase ${date === d.iso ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {d.weekday}
                  </span>
                  <span className="text-xl font-bold leading-tight">{d.day}</span>
                  <span className={`text-[10px] ${date === d.iso ? 'text-indigo-200' : 'text-gray-400'}`}>{d.month}</span>
                </button>
              ))}
            </div>

            {/* Time slots */}
            {date && (
              <div className="mt-6">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Horários disponíveis</p>
                {slotsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 size={24} className="text-indigo-500 animate-spin" />
                  </div>
                ) : slots.length === 0 ? (
                  <Card className="p-6 text-center">
                    <p className="text-sm text-gray-400">Nenhum horário disponível neste dia.</p>
                    <p className="text-xs text-gray-300 mt-1">Selecione outra data.</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map(s => (
                      <button
                        key={s}
                        onClick={() => { setSlot(s); setStep(4) }}
                        className={`py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${
                          slot === s
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-400 hover:text-indigo-700'
                        }`}
                      >
                        {fmtTime(s)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Contato ──────────────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <button
              onClick={() => { setStep(3); setSlot(''); setPhoneChecked(false); setKnownClient(null); setPhone(''); setName(''); setEmail(''); setConsented(false) }}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 cursor-pointer mb-4"
            >
              <ChevronLeft size={16} /> Voltar
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Seus dados</h2>
            <p className="text-sm text-gray-400 mb-5">Para confirmar o agendamento</p>

            {/* Booking summary */}
            <Card className="p-4 mb-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Serviço</p>
                  <p className="font-semibold text-gray-900">{service?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Profissional</p>
                  <p className="font-semibold text-gray-900">{pro?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Data</p>
                  <p className="font-semibold text-gray-900 capitalize">{fmtDateLong(slot)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Horário</p>
                  <p className="font-semibold text-gray-900">{fmtTime(slot)} · {service && fmtDuration(service.duration)}</p>
                </div>
              </div>
            </Card>

            {/* ── Fase 1: só telefone ── */}
            {!phoneChecked ? (
              <form onSubmit={handlePhoneLookup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <Phone size={13} className="inline mr-1.5 text-gray-400" />Seu WhatsApp *
                  </label>
                  <input
                    type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    required minLength={10} placeholder="(11) 99999-0001" autoFocus
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Usamos para enviar lembretes e verificar se você já é cliente</p>
                </div>
                <button
                  type="submit" disabled={lookingUp || phone.replace(/\D/g, '').length < 10}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {lookingUp ? <><Loader2 size={18} className="animate-spin" /> Verificando...</> : 'Continuar'}
                </button>
              </form>
            ) : (
              /* ── Fase 2: cliente reconhecido ou formulário completo ── */
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Cliente reconhecido */}
                {knownClient ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <User size={18} className="text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Olá, {knownClient.name}!</p>
                        <p className="text-xs text-gray-500">Você já é cliente — só confirme abaixo.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setPhoneChecked(false); setKnownClient(null); setPhone(''); setName(''); setEmail('') }}
                        className="ml-auto text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        Trocar
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setResetPhone(phone); setResetStep('request') }}
                      className="text-xs text-indigo-500 hover:text-indigo-700 cursor-pointer"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                ) : (
                  /* Novo cliente — pede nome e e-mail */
                  <>
                    <div className="flex items-center gap-2 text-sm text-gray-500 -mb-1">
                      <Phone size={13} className="text-gray-400" />
                      <span>{phone}</span>
                      <button type="button" onClick={() => { setPhoneChecked(false); setPhone('') }} className="text-indigo-500 hover:text-indigo-700 text-xs ml-1 cursor-pointer">
                        Trocar
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        <User size={13} className="inline mr-1.5 text-gray-400" />Nome completo *
                      </label>
                      <input
                        value={name} onChange={e => setName(e.target.value)}
                        required minLength={2} placeholder="Seu nome" autoFocus
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        <Mail size={13} className="inline mr-1.5 text-gray-400" />E-mail
                      </label>
                      <input
                        type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="Opcional"
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </>
                )}

                {/* LGPD */}
                <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox" checked={consented} onChange={e => setConsented(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs text-gray-600 leading-relaxed">
                    Concordo com o uso dos meus dados para envio de lembretes deste agendamento, conforme a <strong>LGPD</strong>. *
                  </span>
                </label>

                {submitErr && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                    {submitErr}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !consented}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors cursor-pointer text-base flex items-center justify-center gap-2"
                >
                  {submitting
                    ? <><Loader2 size={18} className="animate-spin" /> Confirmando...</>
                    : 'Confirmar agendamento'
                  }
                </button>
              </form>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 mt-4">
        <p className="text-xs text-gray-300">Powered by Kired</p>
      </footer>
    </div>
  )
}
