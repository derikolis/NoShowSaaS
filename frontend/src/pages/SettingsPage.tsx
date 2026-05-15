import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import api from '../services/api'

type WaStatus = {
  connected: boolean
  state: string
  phone: string | null
  profileName: string | null
}

type QrData = {
  base64: string | null
  code:   string | null
}

function ConnectionBadge({ status }: { status: WaStatus | null }) {
  if (!status) {
    return <span className="text-xs text-gray-400">Verificando...</span>
  }
  if (status.connected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Conectado
      </span>
    )
  }
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

export default function SettingsPage() {
  const [waStatus, setWaStatus]           = useState<WaStatus | null>(null)
  const [qrData, setQrData]               = useState<QrData | null>(null)
  const [loadingQr, setLoadingQr]         = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [polling, setPolling]             = useState(false)

  const [instanceName, setInstanceName] = useState('')
  const [savingInstance, setSavingInstance] = useState(false)

  const [testPhone, setTestPhone] = useState('')
  const [testing, setTesting]     = useState(false)

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
      setInstanceName(data.data.evolutionInstance ?? '')
    })
  }, [fetchStatus])

  // Polling enquanto QR está sendo exibido
  useEffect(() => {
    if (!polling) return
    const interval = setInterval(async () => {
      const s = await fetchStatus()
      if (s?.connected) {
        setPolling(false)
        setQrData(null)
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [polling, fetchStatus])

  async function handleShowQr() {
    setLoadingQr(true)
    setQrData(null)
    setMessage(null)
    try {
      const { data } = await api.get('/settings/whatsapp/qrcode')
      if (data.data?.base64 || data.data?.code) {
        setQrData(data.data)
        setPolling(true)
      } else {
        setMessage({ type: 'error', text: 'QR ainda não disponível. Aguarde alguns segundos e tente novamente.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Não foi possível obter o QR code. Verifique se a Evolution API está rodando.' })
    } finally {
      setLoadingQr(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Deseja desconectar o WhatsApp? Os lembretes automáticos deixarão de ser enviados.')) return
    setDisconnecting(true)
    try {
      await api.post('/settings/whatsapp/disconnect')
      setWaStatus({ connected: false, state: 'close', phone: null, profileName: null })
      setQrData(null)
      setPolling(false)
    } catch {
      setMessage({ type: 'error', text: 'Erro ao desconectar.' })
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleSaveInstance(e: React.FormEvent) {
    e.preventDefault()
    setSavingInstance(true)
    setMessage(null)
    try {
      await api.put('/settings', { evolutionInstance: instanceName || null })
      setMessage({ type: 'success', text: 'Instância salva.' })
      fetchStatus()
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar.' })
    } finally {
      setSavingInstance(false)
    }
  }

  async function handleTest(e: React.FormEvent) {
    e.preventDefault()
    setTesting(true)
    setMessage(null)
    try {
      await api.post('/settings/test-whatsapp', { phone: testPhone })
      setMessage({ type: 'success', text: `Mensagem enviada para ${testPhone}.` })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setMessage({ type: 'error', text: msg ?? 'Falha ao enviar mensagem de teste.' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Layout>
      <div className="p-8 max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Configurações</h1>
        <p className="text-sm text-gray-500 mb-8">WhatsApp e integrações</p>

        {message && (
          <div className={`mb-5 px-4 py-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Status + conexão */}
        <div className="bg-white rounded-xl border border-gray-200 mb-4">
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-gray-800">WhatsApp</h2>
              <div className="flex items-center gap-2">
                <ConnectionBadge status={waStatus} />
                <button
                  onClick={() => fetchStatus()}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                  title="Atualizar"
                >
                  ↻
                </button>
              </div>
            </div>

            {waStatus?.connected ? (
              /* Conectado: mostra info do número */
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    {waStatus.profileName && (
                      <p className="text-sm font-medium text-green-900">{waStatus.profileName}</p>
                    )}
                    {waStatus.phone && (
                      <p className="text-xs text-green-700 mt-0.5">+{waStatus.phone}</p>
                    )}
                    {!waStatus.phone && !waStatus.profileName && (
                      <p className="text-sm text-green-800">Número conectado</p>
                    )}
                  </div>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 ml-4"
                  >
                    {disconnecting ? 'Saindo...' : 'Desconectar'}
                  </button>
                </div>
              </div>
            ) : (
              /* Desconectado: mostra QR ou botão para gerar */
              <div>
                {qrData?.base64 ? (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-gray-600 text-center">
                      No WhatsApp: <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong>
                    </p>
                    <img
                      src={qrData.base64.startsWith('data:') ? qrData.base64 : `data:image/png;base64,${qrData.base64}`}
                      alt="QR Code"
                      className="w-52 h-52 border border-gray-200 rounded-lg"
                    />
                    <p className="text-xs text-gray-400">Atualizando automaticamente ao escanear...</p>
                    <button onClick={handleShowQr} className="text-xs text-indigo-600 hover:text-indigo-800">
                      Gerar novo QR
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <p className="text-sm text-gray-500 text-center">
                      Nenhum número conectado. Vincule o WhatsApp que vai disparar os lembretes.
                    </p>
                    <button
                      onClick={handleShowQr}
                      disabled={loadingQr}
                      className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {loadingQr ? 'Gerando QR...' : 'Conectar WhatsApp'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Instância (único campo configurável por tenant) */}
        <div className="bg-white rounded-xl border border-gray-200 mb-4">
          <form onSubmit={handleSaveInstance} className="px-6 py-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Instância Evolution API</h2>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="noshow (padrão do servidor)"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="submit"
                disabled={savingInstance}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {savingInstance ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Deixe em branco para usar a instância padrão configurada no servidor.
            </p>
          </form>
        </div>

        {/* Teste de envio — só quando conectado */}
        {waStatus?.connected && (
          <div className="bg-white rounded-xl border border-gray-200">
            <form onSubmit={handleTest} className="px-6 py-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Testar envio</h2>
              <p className="text-xs text-gray-400 mb-4">Envia uma mensagem para confirmar que está funcionando.</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="5511999990000"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  required
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  type="submit"
                  disabled={testing}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {testing ? 'Enviando...' : 'Enviar teste'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Layout>
  )
}
