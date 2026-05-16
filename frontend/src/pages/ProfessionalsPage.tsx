import { useEffect, useState, FormEvent } from 'react'
import { X, Mail, Calendar, UsersRound, Search, ShieldCheck, Pencil } from 'lucide-react'
import Layout from '../components/Layout'
import api from '../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string; name: string; email: string; role: string; createdAt: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  owner:        'Dono',
  receptionist: 'Recepcionista',
  employee:     'Profissional',
}

const ROLE_CLASS: Record<string, string> = {
  owner:        'bg-indigo-100 text-indigo-700',
  receptionist: 'bg-blue-100 text-blue-700',
  employee:     'bg-gray-100 text-gray-600',
}

// ─── Member Drawer ────────────────────────────────────────────────────────────

function MemberDrawer({
  member, onClose, onUpdated, onDeleted, showToast,
}: {
  member: TeamMember
  onClose: () => void
  onUpdated: (updated: TeamMember) => void
  onDeleted: () => void
  showToast: (msg: string) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [removing,   setRemoving]   = useState(false)
  const [editing,    setEditing]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [editName,   setEditName]   = useState(member.name)
  const [editEmail,  setEditEmail]  = useState(member.email)
  const [editRole,   setEditRole]   = useState(member.role as 'receptionist' | 'employee')
  const [editPass,   setEditPass]   = useState('')

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

  const initials = member.name
    .split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const createdAt = new Date(member.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  async function handleSave(e: FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const body: Record<string, string> = { name: editName, email: editEmail, role: editRole }
      if (editPass) body.password = editPass
      const { data } = await api.put(`/users/${member.id}`, body)
      showToast('Membro atualizado')
      setEditing(false); setEditPass('')
      onUpdated(data.data)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      showToast(status === 409 ? 'Email já em uso' : 'Erro ao atualizar')
    } finally { setSaving(false) }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await api.delete(`/users/${member.id}`)
      showToast('Membro removido da equipe')
      onDeleted()
    } catch {
      showToast('Erro ao remover membro')
      setRemoving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[400px] bg-white z-50 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 shrink-0">
              {initials}
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 leading-tight">{member.name}</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${ROLE_CLASS[member.role] ?? 'bg-gray-100 text-gray-600'}`}>
                {ROLE_LABEL[member.role] ?? member.role}
              </span>
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
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Perfil</label>
                  <select value={editRole} onChange={e => setEditRole(e.target.value as 'receptionist' | 'employee')} className={inputCls}>
                    <option value="employee">Profissional</option>
                    <option value="receptionist">Recepcionista</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nova senha <span className="text-gray-400 font-normal">(deixe em branco para manter)</span></label>
                  <input type="password" value={editPass} onChange={e => setEditPass(e.target.value)} minLength={6} placeholder="Mín. 6 caracteres" className={inputCls} />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => { setEditing(false); setEditPass('') }} className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
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
                  <Mail size={15} className="text-gray-400 shrink-0" />
                  <span>{member.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Calendar size={15} className="text-gray-400 shrink-0" />
                  <span>Membro desde {createdAt}</span>
                </div>
                {member.role !== 'owner' && (
                  <button
                    onClick={() => setEditing(true)}
                    className="mt-1 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    <Pencil size={12} />
                    Editar informações
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Permissions */}
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Permissões</p>
            <div className="space-y-2 text-sm text-gray-600">
              {member.role === 'owner' && (
                <>
                  <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-indigo-500" /><span>Acesso total ao painel</span></div>
                  <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-indigo-500" /><span>Gerencia equipe e configurações</span></div>
                  <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-indigo-500" /><span>Conecta WhatsApp</span></div>
                </>
              )}
              {member.role === 'receptionist' && (
                <>
                  <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-blue-500" /><span>Vê agenda completa</span></div>
                  <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-blue-500" /><span>Cria e edita clientes</span></div>
                  <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-blue-500" /><span>Cria e edita agendamentos</span></div>
                </>
              )}
              {member.role === 'employee' && (
                <>
                  <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-gray-400" /><span>Vê apenas a própria agenda</span></div>
                  <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-gray-400" /><span>Confirma presença de clientes</span></div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          {member.role !== 'owner' && (
            <div className="px-6 py-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Ações</p>
              {!confirming ? (
                <button
                  onClick={() => setConfirming(true)}
                  className="w-full py-2.5 bg-white hover:bg-red-50 text-red-600 text-sm font-semibold rounded-lg border border-red-200 transition-colors cursor-pointer"
                >
                  Remover da equipe
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 text-center">Confirmar remoção de <strong>{member.name}</strong>?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirming(false)}
                      className="flex-1 py-2.5 bg-white hover:bg-gray-50 text-gray-600 text-sm font-semibold rounded-lg border border-gray-200 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleRemove}
                      disabled={removing}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      {removing ? 'Removendo...' : 'Remover'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── New Member Modal ─────────────────────────────────────────────────────────

function NewMemberModal({
  onClose, onCreated, showToast,
}: {
  onClose: () => void
  onCreated: () => void
  showToast: (msg: string) => void
}) {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState<'receptionist' | 'employee'>('employee')
  const [saving,   setSaving]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post('/users', { name, email, password, role })
      showToast('Membro adicionado à equipe')
      onCreated()
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      showToast(status === 409 ? 'Email já em uso' : 'Erro ao criar usuário')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Adicionar membro</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome *</label>
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  required minLength={2} placeholder="Nome completo"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email *</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required placeholder="email@empresa.com"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Senha *</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={6} placeholder="Mín. 6 caracteres"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Perfil *</label>
                <select value={role} onChange={e => setRole(e.target.value as 'receptionist' | 'employee')} className={inputCls}>
                  <option value="employee">Profissional</option>
                  <option value="receptionist">Recepcionista</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {role === 'employee'
                ? 'Profissional vê apenas a própria agenda e confirma presenças.'
                : 'Recepcionista acessa agenda completa e gerencia clientes.'}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 cursor-pointer">
                Cancelar
              </button>
              <button
                type="submit" disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                {saving ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfessionalsPage() {
  const [team,     setTeam]     = useState<TeamMember[]>([])
  const [selected, setSelected] = useState<TeamMember | null>(null)
  const [showNew,  setShowNew]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [toast,    setToast]    = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function load() {
    api.get('/users').then(({ data }) => setTeam(data.data))
  }

  useEffect(() => { load() }, [])

  const filtered = team.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  )

  function handleDeleted() {
    setSelected(null)
    load()
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
            <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {search ? `${filtered.length} de ${team.length}` : team.length} membro{team.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome ou email"
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
              + Adicionar membro
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Membro</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Perfil</th>
                <th className="px-5 py-3">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        {search
                          ? <Search size={22} className="text-gray-300" />
                          : <UsersRound size={22} className="text-gray-300" />
                        }
                      </div>
                      {search ? (
                        <>
                          <p className="text-sm text-gray-400">Nenhum resultado para "{search}"</p>
                          <button
                            onClick={() => setSearch('')}
                            className="text-xs text-indigo-600 hover:underline cursor-pointer"
                          >
                            Limpar busca
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">Nenhum membro cadastrado</p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map(m => (
                <tr
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">
                        {m.name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{m.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_CLASS[m.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABEL[m.role] ?? m.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">
                    {new Date(m.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <MemberDrawer
          member={selected}
          onClose={() => setSelected(null)}
          onUpdated={updated => { setSelected(updated); load() }}
          onDeleted={handleDeleted}
          showToast={showToast}
        />
      )}

      {showNew && (
        <NewMemberModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load() }}
          showToast={showToast}
        />
      )}
    </Layout>
  )
}
