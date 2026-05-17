import { useState, useEffect, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import AdminLayout from './AdminLayout'

const API = import.meta.env.VITE_API_URL

interface AuditEntry {
  id: string
  tenantId: string
  tenantName: string
  userId: string | null
  userName: string
  action: string
  entity: string
  entityId: string
  ip: string | null
  createdAt: string
}

interface AuditResponse {
  total: number
  page: number
  limit: number
  totalPages: number
  logs: AuditEntry[]
}

interface TenantOption {
  id: string
  name: string
}

const ACTION_LABELS: Record<string, string> = {
  create:    'Criação',
  cancel:    'Cancelamento',
  confirm:   'Confirmação',
  complete:  'Realizado',
  no_show:   'No-show',
  delete:    'Exclusão',
  reschedule:'Reagendamento',
}

const ENTITY_LABELS: Record<string, string> = {
  appointment: 'Agendamento',
  client:      'Cliente',
}

const ACTION_COLORS: Record<string, string> = {
  create:     'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  cancel:     'bg-red-500/10 text-red-400 border border-red-500/20',
  confirm:    'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  complete:   'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  no_show:    'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  delete:     'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  reschedule: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
}

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {ACTION_LABELS[action] ?? action}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminAuditPage() {
  const [logs, setLogs]         = useState<AuditEntry[]>([])
  const [total, setTotal]       = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)

  const [tenants, setTenants]   = useState<TenantOption[]>([])
  const [filterTenant, setFilterTenant] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterFrom, setFilterFrom]     = useState('')
  const [filterTo, setFilterTo]         = useState('')

  const limit = 50

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/tenants`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) setTenants(data.data.tenants.map((t: any) => ({ id: t.id, name: t.name })))
    } catch { /* ignore */ }
  }, [])

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(p))
      params.set('limit', String(limit))
      if (filterTenant) params.set('tenantId', filterTenant)
      if (filterAction) params.set('action',   filterAction)
      if (filterEntity) params.set('entity',   filterEntity)
      if (filterFrom)   params.set('dateFrom', new Date(filterFrom).toISOString())
      if (filterTo)     params.set('dateTo',   new Date(filterTo + 'T23:59:59').toISOString())

      const res = await fetch(`${API}/api/admin/audit?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        const r = data.data as AuditResponse
        setLogs(r.logs)
        setTotal(r.total)
        setTotalPages(r.totalPages)
        setPage(r.page)
      }
    } finally {
      setLoading(false)
    }
  }, [filterTenant, filterAction, filterEntity, filterFrom, filterTo])

  useEffect(() => { fetchTenants() }, [fetchTenants])
  useEffect(() => { fetchLogs(1) }, [fetchLogs])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    fetchLogs(1)
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Auditoria</h1>
            <p className="text-sm text-slate-400 mt-0.5">Log de ações realizadas no sistema</p>
          </div>
          <button
            onClick={() => fetchLogs(page)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* Filters */}
        <form onSubmit={handleSearch} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <select
              value={filterTenant}
              onChange={e => setFilterTenant(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Todas as empresas</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Todas as ações</option>
              {Object.entries(ACTION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            <select
              value={filterEntity}
              onChange={e => setFilterEntity(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Todas as entidades</option>
              {Object.entries(ENTITY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            <input
              type="date"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              placeholder="Data inicial"
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
            />

            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              placeholder="Data final"
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-slate-500">
              {total > 0 ? `${total} registro${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}` : 'Nenhum registro'}
            </p>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Search size={14} />
              Filtrar
            </button>
          </div>
        </form>

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Data/Hora</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuário</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ação</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Entidade</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">IP</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin" />
                        Carregando...
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">Nenhum registro encontrado</td>
                  </tr>
                )}
                {!loading && logs.map((log, i) => (
                  <tr key={log.id} className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-800/10'}`}>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap font-mono text-xs">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-200 max-w-[140px] truncate">
                      {log.tenantName}
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-[120px] truncate">
                      {log.userName}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {ENTITY_LABELS[log.entity] ?? log.entity}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs max-w-[100px] truncate" title={log.entityId}>
                      {log.entityId.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">
                      {log.ip ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
              <p className="text-xs text-slate-500">
                Página {page} de {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchLogs(page - 1)}
                  disabled={page <= 1 || loading}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages <= 7
                    ? i + 1
                    : page <= 4 ? i + 1
                    : page >= totalPages - 3 ? totalPages - 6 + i
                    : page - 3 + i
                  return (
                    <button
                      key={p}
                      onClick={() => fetchLogs(p)}
                      disabled={loading}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors
                        ${p === page
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                      {p}
                    </button>
                  )
                })}

                <button
                  onClick={() => fetchLogs(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
