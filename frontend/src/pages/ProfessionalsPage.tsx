import { useEffect, useState, FormEvent } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'

interface TeamMember { id: string; name: string; email: string; role: string; createdAt: string }

const ROLE_LABEL: Record<string, string> = {
  owner: 'Dono',
  receptionist: 'Recepcionista',
  employee: 'Profissional',
}

const ROLE_CLASS: Record<string, string> = {
  owner: 'bg-indigo-100 text-indigo-700',
  receptionist: 'bg-blue-100 text-blue-700',
  employee: 'bg-gray-100 text-gray-600',
}

export default function ProfessionalsPage() {
  const { role: currentRole } = useAuth()
  const isOwner = currentRole === 'owner'

  const [team, setTeam] = useState<TeamMember[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'receptionist' | 'employee'>('employee')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  function load() {
    const endpoint = isOwner ? '/users' : '/professionals'
    api.get(endpoint).then(({ data }) => setTeam(data.data))
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
      await api.post('/users', { name, email, password, role })
      setName(''); setEmail(''); setPassword(''); setRole('employee')
      setShowForm(false)
      load()
      showToast('Membro da equipe adicionado')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      showToast(status === 409 ? 'Email já em uso' : 'Erro ao criar usuário')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, memberName: string) {
    if (!confirm(`Remover "${memberName}" da equipe?`)) return
    try {
      await api.delete(`/users/${id}`)
      load()
      showToast('Membro removido')
    } catch {
      showToast('Erro ao remover membro')
    }
  }

  return (
    <Layout>
      <div className="p-8">
        {toast && (
          <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">{toast}</div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
            <p className="text-sm text-gray-500 mt-1">Profissionais e colaboradores com acesso ao painel</p>
          </div>
          {isOwner && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {showForm ? 'Cancelar' : '+ Adicionar membro'}
            </button>
          )}
        </div>

        {isOwner && showForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-gray-800 mb-4">Novo membro</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required minLength={2}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="email@empresa.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Senha *</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Perfil *</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as 'receptionist' | 'employee')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="employee">Profissional — aparece na agenda, vê só a própria</option>
                  <option value="receptionist">Recepcionista — acessa agenda completa, não atende</option>
                </select>
              </div>
              <div className="col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Salvando...' : 'Adicionar'}
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
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Perfil</th>
                {isOwner && <th className="px-6 py-3">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {team.length === 0 && (
                <tr>
                  <td colSpan={isOwner ? 4 : 3} className="px-6 py-8 text-center text-gray-400">
                    Nenhum membro cadastrado
                  </td>
                </tr>
              )}
              {team.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-6 py-3 text-gray-500">{m.email}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_CLASS[m.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABEL[m.role] ?? m.role}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-6 py-3">
                      {m.role !== 'owner' ? (
                        <button
                          onClick={() => handleDelete(m.id, m.name)}
                          className="text-xs font-medium px-2.5 py-1 rounded-md cursor-pointer border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        >
                          Remover
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
