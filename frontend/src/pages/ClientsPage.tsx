import { useEffect, useState, FormEvent } from 'react'
import { X, Phone, Mail, ShieldCheck, ShieldOff, Star, Users, Search, Pencil } from 'lucide-react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string; name: string; phone: string
  email: string | null; riskScore: number
  isVip: boolean; consentedAt: string | null
}

// ─── Small components ─────────────────────────────────────────────────────────

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
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-6 text-right">{score}</span>
    </div>
  )
}

// ─── Client Drawer ────────────────────────────────────────────────────────────

function ClientDrawer({
  client, isOwner, onClose, onRefresh, showToast,
}: {
  client: Client
  isOwner: boolean
  onClose: () => void
  onRefresh: () => void
  showToast: (msg: string) => void
}) {
  const [deleting,   setDeleting]   = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [editing,    setEditing]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [editName,   setEditName]   = useState(client.name)
  const [editPhone,  setEditPhone]  = useState(client.phone)
  const [editEmail,  setEditEmail]  = useState(client.email ?? '')

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  async function handleSave(e: FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.put(`/clients/${client.id}`, {
        name:  editName,
        phone: editPhone,
        email: editEmail || undefined,
      })
      showToast('Cliente atualizado')
      setEditing(false)
      onRefresh()
    } catch { showToast('Erro ao atualizar cliente') }
    finally { setSaving(false) }
  }

  async function toggleVip() {
    try {
      await api.put(`/clients/${client.id}`, { isVip: !client.isVip })
      showToast(client.isVip ? 'VIP removido' : 'Cliente marcado como VIP')
      onRefresh()
    } catch { showToast('Erro ao atualizar') }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.delete(`/clients/${client.id}`)
      showToast('Cliente removido')
      onClose()
      onRefresh()
    } catch {
      showToast('Erro ao remover cliente')
    } finally { setDeleting(false) }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[400px] bg-white z-50 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-700 shrink-0">
              {client.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">{client.name}</h2>
                {client.isVip && <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">VIP</span>}
              </div>
              <p className="text-sm text-gray-400 mt-0.5">{client.phone}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Info / Edit */}
          <div className="px-6 py-5 border-b border-gray-100">
            {editing ? (
              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nome</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} required minLength={2} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Telefone</label>
                  <input value={editPhone} onChange={e => setEditPhone(e.target.value)} required minLength={10} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Opcional" className={inputCls} />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setEditing(false)} className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="flex-1 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg cursor-pointer">
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Phone size={15} className="text-gray-400 shrink-0" />
                  <span>{client.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Mail size={15} className="text-gray-400 shrink-0" />
                  <span>{client.email ?? <span className="text-gray-400">Não informado</span>}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  {client.consentedAt
                    ? <><ShieldCheck size={15} className="text-green-500 shrink-0" /><span className="text-green-700">LGPD — consentiu em {new Date(client.consentedAt).toLocaleDateString('pt-BR')}</span></>
                    : <><ShieldOff size={15} className="text-red-400 shrink-0" /><span className="text-red-600">LGPD — sem consentimento</span></>
                  }
                </div>
                <button
                  onClick={() => setEditing(true)}
                  className="mt-1 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  <Pencil size={12} />
                  Editar informações
                </button>
              </div>
            )}
          </div>

          {/* Risk */}
          <div className="px-6 py-5 border-b border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Risco de no-show</span>
              <RiskBadge score={client.riskScore} />
            </div>
            <RiskBar score={client.riskScore} />
          </div>

          {/* Actions */}
          <div className="px-6 py-5 space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ações</p>

            <button
              onClick={toggleVip}
              className={`w-full py-2.5 text-sm font-semibold rounded-lg border transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                client.isVip
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Star size={15} className={client.isVip ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'} />
              {client.isVip ? 'Remover status VIP' : 'Marcar como VIP'}
            </button>

            {isOwner && (
              !confirming ? (
                <button
                  onClick={() => setConfirming(true)}
                  className="w-full py-2.5 bg-white hover:bg-red-50 text-red-600 text-sm font-semibold rounded-lg border border-red-200 transition-colors cursor-pointer"
                >
                  Remover cliente
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 text-center">Remover todos os dados de <strong>{client.name}</strong>? Esta ação não pode ser desfeita.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirming(false)}
                      className="flex-1 py-2.5 bg-white hover:bg-gray-50 text-gray-600 text-sm font-semibold rounded-lg border border-gray-200 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      {deleting ? 'Removendo...' : 'Remover'}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── New Client Modal ─────────────────────────────────────────────────────────

function NewClientModal({
  onClose, onCreated, showToast,
}: {
  onClose: () => void; onCreated: () => void; showToast: (msg: string) => void
}) {
  const [name,      setName]      = useState('')
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')
  const [consented, setConsented] = useState(false)
  const [saving,    setSaving]    = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post('/clients', { name, phone, email: email || undefined, consented })
      showToast('Cliente criado com sucesso')
      onCreated()
    } catch { showToast('Erro ao criar cliente') }
    finally { setSaving(false) }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Novo cliente</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome *</label>
              <input value={name} onChange={e => setName(e.target.value)} required minLength={2} placeholder="Maria Silva" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Telefone *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} required minLength={10} placeholder="11999990001" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@email.com" className={inputCls} />
              </div>
            </div>
            <label className="flex items-start gap-3 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox" checked={consented} onChange={e => setConsented(e.target.checked)}
                required className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>O cliente consentiu com o uso dos seus dados conforme a LGPD *</span>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 cursor-pointer">
                Cancelar
              </button>
              <button
                type="submit" disabled={saving || !consented}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                {saving ? 'Salvando...' : 'Criar cliente'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const { role } = useAuth()
  const isOwner = role === 'owner'

  const [clients,  setClients]  = useState<Client[]>([])
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<Client | null>(null)
  const [showNew,  setShowNew]  = useState(false)
  const [toast,    setToast]    = useState('')

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 3000)
  }

  function load() {
    api.get('/clients').then(({ data }) => setClients(data.data))
  }

  useEffect(() => { load() }, [])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  function handleRefresh() {
    load()
    if (selected) {
      api.get('/clients').then(({ data }) => {
        const updated = (data.data as Client[]).find(c => c.id === selected.id)
        setSelected(updated ?? null)
      })
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

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {search ? `${filtered.length} de ${clients.length}` : `${clients.length}`} cliente{clients.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome ou telefone"
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
              + Novo cliente
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Risco</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        {search ? <Search size={22} className="text-gray-300" /> : <Users size={22} className="text-gray-300" />}
                      </div>
                      <p className="text-sm text-gray-400">
                        {search ? `Nenhum cliente encontrado para "${search}"` : 'Nenhum cliente cadastrado'}
                      </p>
                      {search && (
                        <button onClick={() => setSearch('')} className="text-xs text-indigo-500 hover:text-indigo-700 cursor-pointer">
                          Limpar busca
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.phone}</p>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{c.email ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-5 py-3.5 w-36"><RiskBar score={c.riskScore} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {c.isVip && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">VIP</span>
                      )}
                      {c.consentedAt
                        ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">LGPD ✓</span>
                        : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">Sem LGPD</span>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <ClientDrawer
          client={selected}
          isOwner={isOwner}
          onClose={() => setSelected(null)}
          onRefresh={handleRefresh}
          showToast={showToast}
        />
      )}

      {showNew && (
        <NewClientModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load() }}
          showToast={showToast}
        />
      )}
    </Layout>
  )
}
