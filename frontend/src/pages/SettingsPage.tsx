import { useState, useEffect, useCallback } from 'react'
import { Smartphone, Server, MessageSquare, Clock, Link } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type WaStatus = { connected: boolean; state: string; phone: string | null; profileName: string | null }
type QrData   = { base64: string | null; code: string | null }
type PeakRange = { start: number; end: number }

type Settings = {
  whatsappPhone: string | null
  evolutionApiUrl: string | null
  evolutionApiKey: string | null
  evolutionInstance: string | null
  reminderTemplate: string | null
  confirmationTemplate: string | null
  peakHours: PeakRange[] | null
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

type Section = 'whatsapp' | 'api' | 'notifications' | 'hours' | 'advanced'

const NAV: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'whatsapp',      label: 'WhatsApp',       icon: Smartphone    },
  { id: 'api',           label: 'Integração API',  icon: Server        },
  { id: 'notifications', label: 'Notificações',    icon: MessageSquare },
  { id: 'hours',         label: 'Horários de pico', icon: Clock        },
  { id: 'advanced',      label: 'Avançado',        icon: Link          },
]

export default function SettingsPage() {
  const [active, setActive] = useState<Section>('whatsapp')

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
  const [savingTpl,        setSavingTpl]        = useState(false)

  // Peak hours state
  const [peakHours,   setPeakHours]   = useState<PeakRange[]>([])
  const [newStart,    setNewStart]    = useState(12)
  const [newEnd,      setNewEnd]      = useState(14)
  const [savingPeak,  setSavingPeak]  = useState(false)

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
      setApiUrl(s.evolutionApiUrl ?? '')
      setApiKey(s.evolutionApiKey ?? '')
      setInstanceName(s.evolutionInstance ?? '')
      setWaPhone(s.whatsappPhone ?? '')
      setReminderTpl(s.reminderTemplate ?? DEFAULT_REMINDER)
      setConfirmationTpl(s.confirmationTemplate ?? DEFAULT_CONFIRMATION)
      setPeakHours(s.peakHours ?? [{ start: 12, end: 14 }, { start: 18, end: 20 }])
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
      await api.put('/settings', { reminderTemplate: reminderTpl || null, confirmationTemplate: confirmationTpl || null })
      showToast('success', 'Templates salvos.')
    } catch { showToast('error', 'Erro ao salvar templates.') }
    finally { setSavingTpl(false) }
  }

  function addPeakRange() {
    if (newEnd <= newStart) { showToast('error', 'Hora final deve ser maior que a inicial.'); return }
    setPeakHours(prev => [...prev, { start: newStart, end: newEnd }])
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

  const webhookUrl = `${window.location.origin}/api/webhooks/whatsapp`

  const sections: Record<Section, React.ReactNode> = {

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
          <p className="text-sm text-gray-500 mt-1">Personalize o texto das mensagens enviadas via WhatsApp.</p>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Lembrete — 24h e 2h antes</label>
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
          <div className="flex-1 bg-white rounded-xl border border-gray-200 px-8 py-7 min-h-[400px]">
            {sections[active]}
          </div>
        </div>
      </div>
    </Layout>
  )
}
