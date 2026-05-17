import { useEffect, useState, FormEvent } from 'react'
import { Plus, Search, Building2, CheckCircle2, XCircle, ShieldOff, X, Trash2, AlertTriangle } from 'lucide-react'
import AdminLayout from './AdminLayout'
import adminApi from '../../services/adminApi'

interface Tenant {
  id: string
  name: string
  slug: string
  status: 'active' | 'inactive' | 'blocked'
  ownerEmail: string
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  active:   'Ativa',
  inactive: 'Inativa',
  blocked:  'Bloqueada',
}

const STATUS_CLASS: Record<string, string> = {
  active:   'bg-green-900/40 text-green-400 border border-green-800',
  inactive: 'bg-slate-800 text-slate-400 border border-slate-700',
  blocked:  'bg-red-900/40 text-red-400 border border-red-800',
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-3
      ${type === 'success' ? 'bg-green-900 border border-green-700 text-green-200' : 'bg-red-900 border border-red-700 text-red-200'}`}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      {message}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-slate-800">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-6 py-4 flex gap-4">
          <div className="h-4 w-48 bg-slate-800 rounded" />
          <div className="h-4 w-32 bg-slate-800 rounded" />
          <div className="h-4 w-20 bg-slate-800 rounded" />
          <div className="h-4 w-24 bg-slate-800 rounded" />
        </div>
      ))}
    </div>
  )
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  // form state
  const [form, setForm] = useState({
    companyName: '',
    slug: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
  })

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
  }

  function loadTenants() {
    setLoading(true)
    adminApi.get('/admin/tenants')
      .then(({ data }) => setTenants(data.data.tenants ?? []))
      .catch(() => showToast('Erro ao carregar empresas', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadTenants() }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await adminApi.post('/admin/tenants', form)
      showToast('Empresa criada com sucesso', 'success')
      setDrawerOpen(false)
      setForm({ companyName: '', slug: '', ownerName: '', ownerEmail: '', ownerPassword: '' })
      loadTenants()
    } catch {
      showToast('Erro ao criar empresa', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await adminApi.delete(`/admin/tenants/${deleteTarget.id}`)
      showToast('Empresa excluída com sucesso', 'success')
      setDeleteTarget(null)
      loadTenants()
    } catch {
      showToast('Erro ao excluir empresa', 'error')
    } finally {
      setDeleting(false)
    }
  }

  async function handleStatusChange(id: string, status: 'active' | 'blocked') {
    try {
      await adminApi.patch(`/admin/tenants/${id}/status`, { status })
      showToast(
        status === 'active' ? 'Empresa ativada' : 'Empresa bloqueada',
        'success'
      )
      loadTenants()
    } catch {
      showToast('Erro ao alterar status', 'error')
    }
  }

  // auto-gera slug a partir do nome da empresa
  function handleCompanyNameChange(value: string) {
    const slug = value
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    setForm(f => ({ ...f, companyName: value, slug }))
  }

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase()) ||
    t.ownerEmail.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Empresas</h1>
            <p className="text-slate-400 text-sm mt-1">{tenants.length} empresa{tenants.length !== 1 ? 's' : ''} cadastrada{tenants.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Nova empresa
          </button>
        </div>

        {/* ── Search ─────────────────────────────────────────────────────────── */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, slug ou email..."
            className="w-full max-w-sm pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Empresa</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Slug</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Email do dono</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cadastrada em</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr><td colSpan={6}><TableSkeleton /></td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                      <Building2 size={36} className="mb-3 opacity-40" />
                      <p className="text-sm">{search ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada ainda'}</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{t.name}</td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-xs">{t.slug}</td>
                  <td className="px-6 py-4 text-slate-400">{t.ownerEmail}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[t.status] ?? STATUS_CLASS.inactive}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      {t.status !== 'active' && (
                        <button
                          onClick={() => handleStatusChange(t.id, 'active')}
                          title="Ativar empresa"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-green-400 hover:bg-green-900/30 transition-colors"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                      {t.status !== 'blocked' && (
                        <button
                          onClick={() => handleStatusChange(t.id, 'blocked')}
                          title="Bloquear empresa"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                        >
                          <ShieldOff size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(t)}
                        title="Excluir empresa"
                        className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Drawer: Nova Empresa ──────────────────────────────────────────────── */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">Nova empresa</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex-1 overflow-auto p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nome da empresa</label>
                <input
                  value={form.companyName}
                  onChange={e => handleCompanyNameChange(e.target.value)}
                  placeholder="Clínica Exemplo"
                  required
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Slug</label>
                <input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder="clinica-exemplo"
                  required
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-500 mt-1">Usado no login. Gerado automaticamente pelo nome.</p>
              </div>

              <hr className="border-slate-800" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuário dono (owner)</p>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nome</label>
                <input
                  value={form.ownerName}
                  onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
                  placeholder="João Silva"
                  required
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={form.ownerEmail}
                  onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))}
                  placeholder="joao@clinicaexemplo.com"
                  required
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Senha inicial</label>
                <input
                  type="password"
                  value={form.ownerPassword}
                  onChange={e => setForm(f => ({ ...f, ownerPassword: e.target.value }))}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-500 mt-1">Mínimo 6 caracteres. O cliente pode alterar depois.</p>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
                >
                  {saving ? 'Criando...' : 'Criar empresa'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Modal de exclusão ──────────────────────────────────────────────── */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-black/70 z-50" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-900/40 border border-red-800 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Excluir empresa</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Esta ação não pode ser desfeita</p>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mb-5">
                <p className="text-sm font-semibold text-white">{deleteTarget.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">/{deleteTarget.slug} · {deleteTarget.ownerEmail}</p>
              </div>

              <p className="text-sm text-slate-300 mb-6">
                Todos os dados serão apagados permanentemente: agendamentos, clientes, notificações, pagamentos e usuários desta empresa.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm font-semibold rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {deleting ? 'Excluindo...' : 'Sim, excluir'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </AdminLayout>
  )
}
