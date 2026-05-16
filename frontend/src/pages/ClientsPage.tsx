import { useEffect, useState, FormEvent } from 'react'
import Layout from '../components/Layout'
import api from '../services/api'

interface Client {
  id: string
  name: string
  phone: string
  email: string | null
  riskScore: number
  isVip: boolean
  consentedAt: string | null
}

function RiskBadge({ score }: { score: number }) {
  if (score <= 30) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Baixo ({score})</span>
  if (score <= 60) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Médio ({score})</span>
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Alto ({score})</span>
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [consented, setConsented] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  function load() {
    api.get('/clients').then(({ data }) => setClients(data.data))
  }

  useEffect(() => { load() }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/clients', { name, phone, email: email || undefined, consented })
      setName(''); setPhone(''); setEmail(''); setConsented(false)
      setShowForm(false)
      load()
      showToast('Cliente criado com sucesso')
    } catch {
      showToast('Erro ao criar cliente')
    } finally {
      setSaving(false)
    }
  }

  async function toggleVip(client: Client) {
    await api.put(`/clients/${client.id}`, { isVip: !client.isVip })
    load()
  }

  async function deleteClient(client: Client) {
    if (!confirm(`Remover todos os dados de ${client.name}? Esta ação não pode ser desfeita.`)) return
    try {
      await api.delete(`/clients/${client.id}`)
      load()
      showToast('Dados do cliente removidos')
    } catch {
      showToast('Sem permissão para remover cliente')
    }
  }

  return (
    <Layout>
      <div className="p-8">
        {toast && (
          <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
            {toast}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {showForm ? 'Cancelar' : '+ Novo cliente'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-gray-800 mb-4">Novo cliente</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  minLength={2}
                  placeholder="Maria Silva"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Telefone *</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  minLength={10}
                  placeholder="11999990001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="col-span-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consented}
                    onChange={e => setConsented(e.target.checked)}
                    required
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  O cliente consentiu com o uso dos seus dados conforme a LGPD *
                </label>
              </div>
              <div className="col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !consented}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Salvando...' : 'Salvar cliente'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">Telefone</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Risco</th>
                <th className="px-6 py-3">VIP</th>
                <th className="px-6 py-3">LGPD</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Nenhum cliente cadastrado</td>
                </tr>
              )}
              {clients.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-3 text-gray-600">{c.phone}</td>
                  <td className="px-6 py-3 text-gray-500">{c.email ?? '—'}</td>
                  <td className="px-6 py-3"><RiskBadge score={c.riskScore} /></td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => toggleVip(c)}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                        c.isVip
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {c.isVip ? '⭐ VIP' : 'Normal'}
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    {c.consentedAt
                      ? <span className="text-xs text-green-600 font-medium">Sim</span>
                      : <span className="text-xs text-red-500 font-medium">Não</span>}
                  </td>
                  <td className="px-6 py-3">
                    <button onClick={() => deleteClient(c)} className="text-xs font-medium px-2.5 py-1 rounded-md cursor-pointer border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
