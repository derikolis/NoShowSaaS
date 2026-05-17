import { useState, useEffect, useCallback } from 'react'
import { Smartphone, Server, MessageSquare, Clock, Link, QrCode, CreditCard } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import Layout from '../../components/Layout'
import api from '../../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type WaStatus = { connected: boolean; state: string; phone: string | null; profileName: string | null }
type QrData   = { base64: string | null; code: string | null }
type PeakRange = { start: number; end: number }

type Settings = {
  name: string
  slug: string
  whatsappPhone: string | null
  evolutionApiUrl: string | null
  evolutionApiKey: string | null
  evolutionInstance: string | null
  reminderTemplate: string | null
  confirmationTemplate: string | null
  peakHours: PeakRange[] | null
  reminderEnabled: boolean
  reminder1Hours: number
  reminder2Hours: number
  paymentProvider: string | null
  mpAccessToken: string | null
  stripeSecretKey: string | null
  stripeWebhookSecret: string | null
  abacatePayApiKey: string | null
  paymentFlow: string | null
  depositPercent: number | null
  noShowFee: number | null
  webhookUrls: { mercadopago: string; stripe: string; abacatepay: string } | null
}

const DEFAULT_REMINDER     = 'Olá {nome}.\nVocê tem um agendamento amanhã às {hora} com {profissional}.\nDeseja confirmar sua presença?'
const DEFAULT_CONFIRMATION = 'Olá {nome}.\nSeu agendamento é hoje às {hora}.\nPrecisamos da sua confirmação!'

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConnectionBadge({ status }: { status: WaStatus | null }) {
  if (!status) return <span className="text-xs text-gray-400">Verificando...</span>
  if (status.connected) return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      Conectado
    </span>
  )
  const label = status.state === 'not_configured' ? 'Não configurado'
    : status.state === 'connecting' ? 'Conectando...'
    : status.state === 'unavailable' ? 'API indisponível'
    : 'Desconectado'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      {label}
    </span>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function SaveButton({ saving, label = 'Salvar alterações' }: { saving: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors cursor-pointer"
    >
      {saving ? 'Salvando...' : label}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Section = 'booking' | 'whatsapp' | 'api' | 'notifications' | 'hours' | 'payments' | 'advanced'

const NAV: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'booking',       label: 'Agendamento',     icon: QrCode        },
  { id: 'whatsapp',      label: 'WhatsApp',        icon: Smartphone    },
  { id: 'api',           label: 'Integração API',  icon: Server        },
  { id: 'notifications', label: 'Notificações',    icon: MessageSquare },
  { id: 'hours',         label: 'Horários de pico', icon: Clock        },
  { id: 'payments',      label: 'Pagamentos',      icon: CreditCard    },
  { id: 'advanced',      label: 'Avançado',        icon: Link          },
]

export default function SettingsPage() {
  const [active, setActive] = useState<Section>('booking')

  // WhatsApp state
  const [waStatus,      setWaStatus]      = useState<WaStatus | null>(null)
  const [qrData,        setQrData]        = useState<QrData | null>(null)
  const [loadingQr,     setLoadingQr]     = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [polling,       setPolling]       = useState(false)

  // API state
  const [apiUrl,        setApiUrl]        = useState('')
  const [apiKey,        setApiKey]        = useState('')
  const [instanceName,  setInstanceName]  = useState('')
  const [waPhone,       setWaPhone]       = useState('')
  const [savingApi,     setSavingApi]     = useState(false)

  // Templates state
  const [reminderTpl,      setReminderTpl]      = useState(DEFAULT_REMINDER)
  const [confirmationTpl,  setConfirmationTpl]  = useState(DEFAULT_CONFIRMATION)
  const [reminderEnabled,  setReminderEnabled]  = useState(true)
  const [reminder1Hours,   setReminder1Hours]   = useState(24)
  const [reminder2Hours,   setReminder2Hours]   = useState(2)
  const [savingTpl,        setSavingTpl]        = useState(false)

  // Booking link state
  const [tenantSlug, setTenantSlug] = useState('')

  // Peak hours state
  const [peakHours,   setPeakHours]   = useState<PeakRange[]>([])
  const [newStart,    setNewStart]    = useState(12)
  const [newEnd,      setNewEnd]      = useState(14)
  const [savingPeak,  setSavingPeak]  = useState(false)

  // Payment state
  const [paymentProvider,     setPaymentProvider]     = useState('')
  const [mpToken,             setMpToken]             = useState('')
  const [stripeKey,           setStripeKey]           = useState('')
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('')
  const [abacateKey,          setAbacateKey]          = useState('')
  const [paymentFlow,         setPaymentFlow]         = useState('disabled')
  const [depositPercent,      setDepositPercent]      = useState(30)
  const [noShowFee,           setNoShowFee]           = useState(0)
  const [savingPayment,       setSavingPayment]       = useState(false)
  const [webhookUrls,         setWebhookUrls]         = useState<Settings['webhookUrls']>(null)

  // Test send
  const [testPhone, setTestPhone] = useState('')
  const [testing,   setTesting]   = useState(false)

  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/settings/whatsapp/status')
      setWaStatus(data.data)
      return data.data as WaStatus
    } catch {
      setWaStatus({ connected: false, state: 'unavailable', phone: null, profileName: null })
      return null
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    api.get('/settings').then(({ data }) => {
      const s: Settings = data.data
      setTenantSlug(s.slug ?? '')
      setApiUrl(s.evolutionApiUrl ?? '')
      setApiKey(s.evolutionApiKey ?? '')
      setInstanceName(s.evolutionInstance ?? '')
      setWaPhone(s.whatsappPhone ?? '')
      setReminderTpl(s.reminderTemplate ?? DEFAULT_REMINDER)
      setConfirmationTpl(s.confirmationTemplate ?? DEFAULT_CONFIRMATION)
      setReminderEnabled(s.reminderEnabled ?? true)
      setReminder1Hours(s.reminder1Hours ?? 24)
      setReminder2Hours(s.reminder2Hours ?? 2)
      setPeakHours(s.peakHours ?? [{ start: 12, end: 14 }, { start: 18, end: 20 }])
      setPaymentProvider(s.paymentProvider ?? '')
      setMpToken(s.mpAccessToken ?? '')
      setStripeKey(s.stripeSecretKey ?? '')
      setStripeWebhookSecret(s.stripeWebhookSecret ?? '')
      setAbacateKey(s.abacatePayApiKey ?? '')
      setPaymentFlow(s.paymentFlow ?? 'disabled')
      setDepositPercent(s.depositPercent ?? 30)
      setNoShowFee(s.noShowFee ?? 0)
      setWebhookUrls(s.webhookUrls ?? null)
    })
  }, [fetchStatus])

  useEffect(() => {
    if (!polling) return
    const interval = setInterval(async () => {
      const s = await fetchStatus()
      if (s?.connected) { setPolling(false); setQrData(null) }
    }, 4000)
    return () => clearInterval(interval)
  }, [polling, fetchStatus])

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleShowQr() {
    setLoadingQr(true); setQrData(null)
    try {
      const { data } = await api.get('/settings/whatsapp/qrcode')
      if (data.data?.base64 || data.data?.code) { setQrData(data.data); setPolling(true) }
      else showToast('error', 'QR ainda não disponível. Aguarde alguns segundos.')
    } catch { showToast('error', 'Evolution API indisponível.') }
    finally { setLoadingQr(false) }
  }

  async function handleDisconnect() {
    if (!confirm('Deseja desconectar o WhatsApp? Os lembretes automáticos deixarão de ser enviados.')) return
    setDisconnecting(true)
    try {
      await api.post('/settings/whatsapp/disconnect')
      setWaStatus({ connected: false, state: 'close', phone: null, profileName: null })
      setQrData(null); setPolling(false)
    } catch { showToast('error', 'Erro ao desconectar.') }
    finally { setDisconnecting(false) }
  }

  async function handleSaveApi(e: React.FormEvent) {
    e.preventDefault(); setSavingApi(true)
    try {
      await api.put('/settings', {
        evolutionApiUrl: apiUrl || null,
        evolutionApiKey: apiKey || null,
        evolutionInstance: instanceName || null,
        whatsappPhone: waPhone || null,
      })
      showToast('success', 'Configurações da API salvas.')
      fetchStatus()
    } catch { showToast('error', 'Erro ao salvar.') }
    finally { setSavingApi(false) }
  }

  async function handleSaveTemplates(e: React.FormEvent) {
    e.preventDefault(); setSavingTpl(true)
    try {
      await api.put('/settings', {
        reminderTemplate: reminderTpl || null,
        confirmationTemplate: confirmationTpl || null,
        reminderEnabled,
        reminder1Hours,
        reminder2Hours,
      })
      showToast('success', 'Notificações salvas.')
    } catch { showToast('error', 'Erro ao salvar.') }
    finally { setSavingTpl(false) }
  }

  function addPeakRange() {
    if (newEnd <= newStart) { showToast('error', 'Hora final deve ser maior que a inicial.'); return }
    setPeakHours(prev => [...prev, { start: newStart, end: newEnd }])
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault(); setSavingPayment(true)
    try {
      await api.put('/settings', {
        paymentProvider: paymentProvider || null,
        mpAccessToken:       paymentProvider === 'mercadopago' ? (mpToken || null) : null,
        stripeSecretKey:     paymentProvider === 'stripe'      ? (stripeKey || null) : null,
        stripeWebhookSecret: paymentProvider === 'stripe'      ? (stripeWebhookSecret || null) : null,
        abacatePayApiKey:    paymentProvider === 'abacatepay'  ? (abacateKey || null) : null,
        paymentFlow:  paymentProvider ? paymentFlow : 'disabled',
        depositPercent: paymentFlow === 'deposit'      || paymentFlow === 'both' ? depositPercent : null,
        noShowFee:      paymentFlow === 'no_show_fee'  || paymentFlow === 'both' ? noShowFee      : null,
      })
      showToast('success', 'Configurações de pagamento salvas.')
    } catch { showToast('error', 'Erro ao salvar.') }
    finally { setSavingPayment(false) }
  }

  async function handleSavePeakHours() {
    setSavingPeak(true)
    try {
      await api.put('/settings', { peakHours: peakHours.length > 0 ? peakHours : null })
      showToast('success', 'Horários de pico salvos.')
    } catch { showToast('error', 'Erro ao salvar.') }
    finally { setSavingPeak(false) }
  }

  async function handleTest(e: React.FormEvent) {
    e.preventDefault(); setTesting(true)
    try {
      await api.post('/settings/test-whatsapp', { phone: testPhone })
      showToast('success', `Mensagem enviada para ${testPhone}.`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast('error', msg ?? 'Falha ao enviar.')
    } finally { setTesting(false) }
  }

  // ── Shared input class ───────────────────────────────────────────────────────

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow'

  // ── Section content ──────────────────────────────────────────────────────────

  const webhookUrl  = `${window.location.origin}/api/webhooks/whatsapp`
  const bookingUrl  = tenantSlug ? `${window.location.origin}/agendar/${tenantSlug}` : ''

  const sections: Record<Section, React.ReactNode> = {

    booking: (
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Agendamento online</h2>
          <p className="text-sm text-gray-500 mt-1">
            Compartilhe este link com seus clientes para que eles agendem sozinhos, sem precisar ligar.
          </p>
        </div>

        {tenantSlug ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Link de agendamento</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={bookingUrl}
                  className="flex-1 border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-700 font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(bookingUrl); showToast('success', 'Link copiado!') }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Copiar link
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                O cliente escolhe o serviço, profissional e horário — sem precisar entrar em contato.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">QR Code</label>
              <div className="inline-flex flex-col items-center gap-4 p-5 border border-gray-200 rounded-xl bg-white">
                <QRCodeSVG
                  value={bookingUrl}
                  size={180}
                  level="M"
                  includeMargin={false}
                />
                <p className="text-xs text-gray-400 text-center max-w-48">
                  Imprima ou mostre aos clientes na recepção para eles agendarem pelo celular.
                </p>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-indigo-800 mb-1">Como funciona</p>
              <ol className="text-xs text-indigo-700 space-y-1 list-decimal list-inside">
                <li>Cliente acessa o link ou escaneia o QR</li>
                <li>Escolhe o serviço, profissional e horário</li>
                <li>Informa nome e WhatsApp</li>
                <li>Agendamento é criado automaticamente no sistema</li>
                <li>Cliente recebe lembretes via WhatsApp</li>
              </ol>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            Carregando...
          </div>
        )}
      </div>
    ),

    whatsapp: (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">WhatsApp</h2>
          <p className="text-sm text-gray-500 mt-1">Gerencie a conexão com o número que dispara os lembretes.</p>
        </div>

        <div className="flex items-center gap-3">
          <ConnectionBadge status={waStatus} />
          <button onClick={() => fetchStatus()} className="text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer" title="Atualizar">↻</button>
        </div>

        {waStatus?.connected ? (
          <div className="bg-green-50 border border-green-100 rounded-xl px-5 py-4 flex items-center justify-between">
            <div>
              {waStatus.profileName && <p className="text-sm font-semibold text-green-900">{waStatus.profileName}</p>}
              {waStatus.phone && <p className="text-sm text-green-700 mt-0.5">+{waStatus.phone}</p>}
              {!waStatus.phone && !waStatus.profileName && <p className="text-sm text-green-800">Número conectado</p>}
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-50 cursor-pointer"
            >
              {disconnecting ? 'Saindo...' : 'Desconectar'}
            </button>
          </div>
        ) : (
          <div className="border border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center gap-4">
            {qrData?.base64 ? (
              <>
                <p className="text-sm text-gray-600 text-center">
                  No WhatsApp: <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong>
                </p>
                <img
                  src={qrData.base64.startsWith('data:') ? qrData.base64 : `data:image/png;base64,${qrData.base64}`}
                  alt="QR Code"
                  className="w-52 h-52 border border-gray-200 rounded-lg"
                />
                <p className="text-xs text-gray-400">Atualizando automaticamente ao escanear...</p>
                <button onClick={handleShowQr} className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer">
                  Gerar novo QR
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <Smartphone size={22} className="text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Nenhum número conectado</p>
                  <p className="text-sm text-gray-400 mt-1">Vincule o WhatsApp que vai disparar os lembretes aos clientes.</p>
                </div>
                <button
                  onClick={handleShowQr}
                  disabled={loadingQr}
                  className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {loadingQr ? 'Gerando QR...' : 'Conectar WhatsApp'}
                </button>
              </>
            )}
          </div>
        )}

        {waStatus?.connected && (
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Testar envio</h3>
            <form onSubmit={handleTest} className="flex gap-3">
              <input
                type="text"
                placeholder="5511999990000"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                required
                className={`flex-1 ${inputCls}`}
              />
              <button
                type="submit"
                disabled={testing}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {testing ? 'Enviando...' : 'Enviar teste'}
              </button>
            </form>
          </div>
        )}
      </div>
    ),

    api: (
      <form onSubmit={handleSaveApi} className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Integração API</h2>
          <p className="text-sm text-gray-500 mt-1">Configurações da Evolution API por empresa. Deixe em branco para usar as variáveis de ambiente do servidor.</p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <Field label="URL da API">
            <input
              type="url"
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              placeholder="https://evolution.seuservidor.com"
              className={inputCls}
            />
          </Field>
          <Field label="API Key">
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </Field>
          <Field label="Nome da instância">
            <input
              value={instanceName}
              onChange={e => setInstanceName(e.target.value)}
              placeholder="noshow"
              className={inputCls}
            />
          </Field>
          <Field label="Número remetente" hint="Número que os clientes verão como remetente das mensagens.">
            <input
              value={waPhone}
              onChange={e => setWaPhone(e.target.value)}
              placeholder="5511999990000"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="flex justify-end pt-2">
          <SaveButton saving={savingApi} />
        </div>
      </form>
    ),

    notifications: (
      <form onSubmit={handleSaveTemplates} className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Notificações</h2>
          <p className="text-sm text-gray-500 mt-1">Configure quando e como os lembretes são enviados via WhatsApp.</p>
        </div>

        {/* Reminder toggle + hours */}
        <div className="border border-gray-200 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Lembretes automáticos</p>
              <p className="text-xs text-gray-400 mt-0.5">Envia WhatsApp aos clientes antes do horário agendado</p>
            </div>
            <button
              type="button"
              onClick={() => setReminderEnabled(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${reminderEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${reminderEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {reminderEnabled && (
            <div className="grid grid-cols-2 gap-4 pt-1 border-t border-gray-100">
              <Field label="Primeiro lembrete" hint="Horas antes do agendamento">
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} max={72}
                    value={reminder1Hours}
                    onChange={e => setReminder1Hours(Number(e.target.value))}
                    className={inputCls}
                  />
                  <span className="text-sm text-gray-500 shrink-0">h antes</span>
                </div>
              </Field>
              <Field label="Segundo lembrete" hint="Horas antes do agendamento">
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} max={24}
                    value={reminder2Hours}
                    onChange={e => setReminder2Hours(Number(e.target.value))}
                    className={inputCls}
                  />
                  <span className="text-sm text-gray-500 shrink-0">h antes</span>
                </div>
              </Field>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Texto do lembrete</label>
              <span className="text-xs text-gray-400 font-mono bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                {'{nome}'} {'{hora}'} {'{profissional}'} {'{data}'}
              </span>
            </div>
            <textarea
              rows={4}
              value={reminderTpl}
              onChange={e => setReminderTpl(e.target.value)}
              className={`${inputCls} resize-none font-mono text-xs leading-relaxed`}
            />
            <button
              type="button"
              onClick={() => setReminderTpl(DEFAULT_REMINDER)}
              className="mt-1.5 text-xs text-indigo-500 hover:text-indigo-700 cursor-pointer"
            >
              Restaurar padrão
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Confirmação — risco médio / alto</label>
              <span className="text-xs text-gray-400 font-mono bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                {'{nome}'} {'{hora}'} {'{data}'}
              </span>
            </div>
            <textarea
              rows={4}
              value={confirmationTpl}
              onChange={e => setConfirmationTpl(e.target.value)}
              className={`${inputCls} resize-none font-mono text-xs leading-relaxed`}
            />
            <button
              type="button"
              onClick={() => setConfirmationTpl(DEFAULT_CONFIRMATION)}
              className="mt-1.5 text-xs text-indigo-500 hover:text-indigo-700 cursor-pointer"
            >
              Restaurar padrão
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <SaveButton saving={savingTpl} />
        </div>
      </form>
    ),

    hours: (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Horários de pico</h2>
          <p className="text-sm text-gray-500 mt-1">Agendamentos nesses períodos recebem lembretes extras — são slots mais valiosos e com maior risco de imprevisto.</p>
        </div>

        <div className="space-y-2">
          {peakHours.length === 0 && (
            <p className="text-sm text-gray-400 py-2">Nenhum horário configurado.</p>
          )}
          {peakHours.map((r, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
              <span className="text-sm font-mono text-gray-700">
                {String(r.start).padStart(2, '0')}:00 – {String(r.end).padStart(2, '0')}:00
              </span>
              <button
                onClick={() => setPeakHours(prev => prev.filter((_, idx) => idx !== i))}
                className="text-xs text-red-500 hover:text-red-700 font-medium cursor-pointer"
              >
                Remover
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-3 pt-2 border-t border-gray-100">
          <Field label="De">
            <select
              value={newStart}
              onChange={e => setNewStart(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </Field>
          <Field label="Até">
            <select
              value={newEnd}
              onChange={e => setNewEnd(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h + 1} value={h + 1}>{String(h + 1).padStart(2, '0')}:00</option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            onClick={addPeakRange}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            + Adicionar
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSavePeakHours}
            disabled={savingPeak}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors cursor-pointer"
          >
            {savingPeak ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    ),

    payments: (
      <form onSubmit={handleSavePayment} className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Pagamentos</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure cobranças via PIX. Escolha o provedor e informe suas credenciais — sem custo fixo, só por transação.
          </p>
        </div>

        {/* ── Provedor ── */}
        <Field label="Provedor de pagamento">
          <select
            value={paymentProvider}
            onChange={e => { setPaymentProvider(e.target.value); if (!e.target.value) setPaymentFlow('disabled') }}
            className={inputCls}
          >
            <option value="">Sem pagamento — desabilitado</option>
            <option value="abacatepay">AbacatePay (recomendado)</option>
            <option value="mercadopago">Mercado Pago</option>
            <option value="stripe">Stripe</option>
          </select>
        </Field>

        {/* ── Credenciais por provedor ── */}
        {paymentProvider === 'abacatepay' && (
          <Field label="API Key do AbacatePay" hint="Encontre em app.abacatepay.com → Configurações → API Keys.">
            <input
              type="password"
              value={abacateKey}
              onChange={e => setAbacateKey(e.target.value)}
              placeholder="abacate_live_••••••••••••••••"
              className={inputCls}
            />
          </Field>
        )}

        {paymentProvider === 'mercadopago' && (
          <Field label="Access Token do Mercado Pago" hint="Encontre em mercadopago.com.br → Seu negócio → Credenciais → Access Token de produção.">
            <input
              type="password"
              value={mpToken}
              onChange={e => setMpToken(e.target.value)}
              placeholder="APP_USR-••••••••••••••••"
              className={inputCls}
            />
          </Field>
        )}

        {paymentProvider === 'stripe' && (<>
          <Field label="Secret Key do Stripe" hint="Encontre em dashboard.stripe.com → Developers → API Keys → Secret key.">
            <input
              type="password"
              value={stripeKey}
              onChange={e => setStripeKey(e.target.value)}
              placeholder="sk_live_••••••••••••••••"
              className={inputCls}
            />
          </Field>
          <Field label="Webhook Signing Secret do Stripe" hint="Encontre em Stripe Dashboard → Developers → Webhooks → seu endpoint → Signing secret.">
            <input
              type="password"
              value={stripeWebhookSecret}
              onChange={e => setStripeWebhookSecret(e.target.value)}
              placeholder="whsec_••••••••••••••••"
              className={inputCls}
            />
          </Field>
        </>)}

        {/* ── URL de Webhook para configurar no provedor ── */}
        {paymentProvider && webhookUrls && (
          <div className="border border-gray-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">URL do webhook</p>
            <p className="text-xs text-gray-400">
              {paymentProvider === 'stripe'
                ? 'Configure essa URL em Stripe Dashboard → Developers → Webhooks → Add endpoint.'
                : paymentProvider === 'mercadopago'
                ? 'Configure essa URL em mercadopago.com.br → Seu negócio → Webhooks → Notificações.'
                : 'Configure essa URL em app.abacatepay.com → Configurações → Webhooks.'}
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={webhookUrls[paymentProvider as keyof typeof webhookUrls]}
                className="flex-1 border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrls[paymentProvider as keyof typeof webhookUrls])
                  showToast('success', 'URL copiada!')
                }}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 text-sm font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Copiar
              </button>
            </div>
            {paymentProvider === 'stripe' && (
              <p className="text-xs text-amber-600">
                Eventos necessários: <span className="font-mono">payment_intent.succeeded</span> e <span className="font-mono">payment_intent.payment_failed</span>
              </p>
            )}
          </div>
        )}

        {/* ── Fluxo de pagamento ── */}
        {paymentProvider && (<>
          <Field label="Fluxo de pagamento">
            <select
              value={paymentFlow}
              onChange={e => setPaymentFlow(e.target.value)}
              className={inputCls}
            >
              <option value="disabled">Desabilitado — sem cobrança</option>
              <option value="deposit">Sinal no agendamento — cliente paga % ao agendar</option>
              <option value="no_show_fee">Taxa de no-show — cobra se não comparecer</option>
              <option value="both">Ambos — sinal + taxa de no-show</option>
            </select>
          </Field>

          {(paymentFlow === 'deposit' || paymentFlow === 'both') && (
            <Field label="Percentual do sinal (%)" hint="Ex: 30 = cliente paga 30% do valor do serviço ao agendar.">
              <input
                type="number"
                min={1}
                max={100}
                value={depositPercent}
                onChange={e => setDepositPercent(Number(e.target.value))}
                className={inputCls}
              />
            </Field>
          )}

          {(paymentFlow === 'no_show_fee' || paymentFlow === 'both') && (
            <Field label="Valor da taxa de no-show (R$)" hint="Valor fixo cobrado quando o cliente não comparecer.">
              <input
                type="number"
                min={0}
                step={0.01}
                value={noShowFee}
                onChange={e => setNoShowFee(Number(e.target.value))}
                className={inputCls}
              />
            </Field>
          )}

          {paymentFlow !== 'disabled' && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">Como funciona</p>
              <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                {(paymentFlow === 'deposit' || paymentFlow === 'both') && (
                  <li>Após o agendamento, cliente recebe QR Code PIX para pagar o sinal</li>
                )}
                {(paymentFlow === 'no_show_fee' || paymentFlow === 'both') && (
                  <li>Ao marcar no-show, o sistema gera PIX e envia via WhatsApp ao cliente</li>
                )}
                <li>Pagamentos confirmados em tempo real via webhook</li>
                {paymentProvider === 'abacatepay'  && <li>AbacatePay cobra taxa por transação PIX — sem custo fixo</li>}
                {paymentProvider === 'mercadopago' && <li>Mercado Pago cobra ~1,49% por transação PIX — sem custo fixo</li>}
                {paymentProvider === 'stripe'      && <li>Stripe cobra ~2,9% + R$0,30 por transação — PIX requer confirmação</li>}
              </ul>
            </div>
          )}
        </>)}

        <div className="flex justify-end pt-2">
          <SaveButton saving={savingPayment} />
        </div>
      </form>
    ),

    advanced: (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Avançado</h2>
          <p className="text-sm text-gray-500 mt-1">Configurações técnicas da integração.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">URL do Webhook</label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={webhookUrl}
              className="flex-1 border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-600 font-mono focus:outline-none"
            />
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(webhookUrl); showToast('success', 'URL copiada!') }}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Copiar
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Configure essa URL na Evolution API para receber confirmações e cancelamentos dos clientes via WhatsApp. Em desenvolvimento, use ngrok ou similar para expor o servidor localmente.
          </p>
        </div>
      </div>
    ),
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Configurações</h1>

        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm shadow-lg border ${
            toast.type === 'success'
              ? 'bg-white text-green-800 border-green-200'
              : 'bg-white text-red-800 border-red-200'
          }`}>
            {toast.text}
          </div>
        )}

        <div className="flex gap-8">
          {/* ── Left nav ─────────────────────────────────────────────────────── */}
          <nav className="w-52 shrink-0">
            <ul className="space-y-0.5">
              {NAV.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    onClick={() => setActive(id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
                      active === id
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={16} className={active === id ? 'text-indigo-600' : 'text-gray-400'} />
                    {label}
                    {id === 'whatsapp' && waStatus && (
                      <span className={`ml-auto w-2 h-2 rounded-full shrink-0 ${waStatus.connected ? 'bg-green-500' : 'bg-gray-300'}`} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* ── Right content ─────────────────────────────────────────────────── */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 px-8 py-7 min-h-100">
            {sections[active]}
          </div>
        </div>
      </div>
    </Layout>
  )
}
