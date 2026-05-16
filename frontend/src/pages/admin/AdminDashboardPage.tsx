import { useEffect, useState } from 'react'
import { Building2, CheckCircle2, XCircle, TrendingUp } from 'lucide-react'
import AdminLayout from './AdminLayout'
import adminApi from '../../services/adminApi'

interface AdminStats {
  totalTenants: number
  activeTenants: number
  inactiveTenants: number
  newThisMonth: number
}

interface RecentTenant {
  id: string
  name: string
  slug: string
  status: 'active' | 'inactive' | 'blocked'
  createdAt: string
}

function KpiCard({ label, value, icon: Icon, color }: {
  label: string
  value: number
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-400">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  )
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

function DashboardSkeleton() {
  return (
    <div className="p-8 space-y-8 animate-pulse">
      <div className="h-8 w-48 bg-slate-800 rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-24" />
        ))}
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl h-64" />
    </div>
  )
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [recents, setRecents] = useState<RecentTenant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      adminApi.get('/admin/stats'),
      adminApi.get('/admin/tenants?limit=5&sort=createdAt'),
    ])
      .then(([statsRes, tenantsRes]) => {
        setStats(statsRes.data.data)
        setRecents(tenantsRes.data.data.tenants ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <AdminLayout><DashboardSkeleton /></AdminLayout>

  return (
    <AdminLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Visão geral da plataforma</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total de empresas"
            value={stats?.totalTenants ?? 0}
            icon={Building2}
            color="bg-indigo-600/20 text-indigo-400"
          />
          <KpiCard
            label="Ativas"
            value={stats?.activeTenants ?? 0}
            icon={CheckCircle2}
            color="bg-green-600/20 text-green-400"
          />
          <KpiCard
            label="Inativas"
            value={stats?.inactiveTenants ?? 0}
            icon={XCircle}
            color="bg-slate-600/20 text-slate-400"
          />
          <KpiCard
            label="Novas este mês"
            value={stats?.newThisMonth ?? 0}
            icon={TrendingUp}
            color="bg-amber-600/20 text-amber-400"
          />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-white">Empresas recentes</h2>
          </div>

          {recents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Building2 size={36} className="mb-3 opacity-40" />
              <p className="text-sm">Nenhuma empresa cadastrada ainda</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Empresa</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Slug</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cadastrada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recents.map(t => (
                  <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{t.name}</td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">{t.slug}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[t.status] ?? STATUS_CLASS.inactive}`}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
