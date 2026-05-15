import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import api from '../services/api'

interface DashboardData {
  summary: { total: number; scheduled: number; confirmed: number; noShow: number; cancelled: number }
  attendanceRate: number | null
  recoveredSlots: number
  totalClients: number
  topNoShows: { id: string; name: string; phone: string; riskScore: number; count: number }[]
  upcoming: {
    id: string; service: string; scheduledAt: string; status: string; riskScore: number
    client: { name: string; phone: string }
  }[]
}

const RISK_BADGE: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
}

function riskLevel(score: number) {
  if (score <= 30) return { label: 'Baixo', cls: RISK_BADGE.low }
  if (score <= 60) return { label: 'Médio', cls: RISK_BADGE.medium }
  return { label: 'Alto', cls: RISK_BADGE.high }
}

function AttendanceGauge({ rate }: { rate: number | null }) {
  if (rate === null) return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <span className="text-4xl font-bold">—</span>
      <span className="text-sm mt-1">Sem dados</span>
    </div>
  )

  const color = rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-yellow-600' : 'text-red-600'
  const barColor = rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <span className={`text-5xl font-bold ${color}`}>{rate}%</span>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-xs text-gray-500">de comparecimento</span>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard').then(({ data: res }) => {
      setData(res.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">Carregando...</div>
    </Layout>
  )

  if (!data) return null

  const { summary, attendanceRate, recoveredSlots, totalClients, topNoShows, upcoming } = data

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

        {/* Linha 1: métricas principais */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 col-span-1">
            <AttendanceGauge rate={attendanceRate} />
          </div>

          <div className="col-span-3 grid grid-cols-3 gap-4">
            {[
              { label: 'Total de agendamentos', value: summary.total, color: 'text-gray-800', sub: '' },
              { label: 'Clientes cadastrados', value: totalClients, color: 'text-indigo-600', sub: '' },
              { label: 'Horários recuperados', value: recoveredSlots, color: 'text-green-600', sub: 'via lista de espera' },
              { label: 'Agendados', value: summary.scheduled, color: 'text-blue-600', sub: 'aguardando confirmação' },
              { label: 'Confirmados', value: summary.confirmed, color: 'text-green-600', sub: '' },
              { label: 'No-show', value: summary.noShow, color: 'text-red-600', sub: 'não compareceram' },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className={`text-3xl font-bold ${color}`}>{value}</div>
                <div className="text-sm text-gray-700 mt-1 font-medium">{label}</div>
                {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Linha 2: próximos agendamentos + clientes com mais faltas */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Próximos 7 dias</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-6 py-3">Cliente</th>
                  <th className="px-6 py-3">Serviço</th>
                  <th className="px-6 py-3">Data/Hora</th>
                  <th className="px-6 py-3">Risco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {upcoming.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400 text-sm">
                      Nenhum agendamento nos próximos 7 dias
                    </td>
                  </tr>
                )}
                {upcoming.map(a => {
                  const risk = riskLevel(a.riskScore)
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{a.client.name}</td>
                      <td className="px-6 py-3 text-gray-600">{a.service}</td>
                      <td className="px-6 py-3 text-gray-600">
                        {new Date(a.scheduledAt).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${risk.cls}`}>
                          {risk.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Clientes com mais faltas</h2>
            </div>
            {topNoShows.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">Nenhum no-show registrado</div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {topNoShows.map((c, i) => {
                  const risk = riskLevel(c.riskScore)
                  return (
                    <li key={c.id} className="px-6 py-3 flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-300 w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">{c.count}x</p>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${risk.cls}`}>
                          {risk.label}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
