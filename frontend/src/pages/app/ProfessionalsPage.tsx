import { useEffect, useState, useCallback, useRef, FormEvent, ChangeEvent } from 'react'
import { X, Mail, Calendar, UsersRound, Search, ShieldCheck, Pencil, Plus, Trash2, Camera } from 'lucide-react'
import Layout from '../../components/Layout'
import api from '../../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeSlot = { start: string; end: string }
type WeekSchedule = Record<string, TimeSlot[]>

interface TeamMember {
  id: string; name: string; email: string; role: string; createdAt: string
  weekSchedule?: WeekSchedule | null
  photoUrl?: string | null
}

interface UserMetrics {
  userId: string; total: number; today: number; noShows: number; attendanceRate: number | null
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

const DAYS = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça'   },
  { key: 'wed', label: 'Quarta'  },
  { key: 'thu', label: 'Quinta'  },
  { key: 'fri', label: 'Sexta'   },
  { key: 'sat', label: 'Sábado'  },
  { key: 'sun', label: 'Domingo' },
]

const DEFAULT_SLOT = [{ start: '08:00', end: '18:00' }]
const EMPTY_SCHEDULE: WeekSchedule = {
  mon: DEFAULT_SLOT, tue: DEFAULT_SLOT, wed: DEFAULT_SLOT,
  thu: DEFAULT_SLOT, fri: DEFAULT_SLOT, sat: DEFAULT_SLOT,
  sun: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resizeImage(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = ev => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale  = Math.min(size / img.width, size / img.height, 1)
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = ev.target!.result as string
    }
    reader.readAsDataURL(file)
  })
}

// ─── Schedule Editor ──────────────────────────────────────────────────────────

function ScheduleEditor({
  schedule, onChange,
}: {
  schedule: WeekSchedule
  onChange: (s: WeekSchedule) => void
}) {
  function toggleDay(key: string) {
    const active = (schedule[key] ?? []).length > 0
    onChange({ ...schedule, [key]: active ? [] : [{ start: '08:00', end: '18:00' }] })
  }

  function addSlot(key: string) {
    const slots = schedule[key] ?? []
    onChange({ ...schedule, [key]: [...slots, { start: '08:00', end: '18:00' }] })
  }

  function removeSlot(key: string, idx: number) {
    const slots = (schedule[key] ?? []).filter((_, i) => i !== idx)
    onChange({ ...schedule, [key]: slots })
  }

  function updateSlot(key: string, idx: number, field: 'start' | 'end', value: string) {
    const slots = (schedule[key] ?? []).map((s, i) => i === idx ? { ...s, [field]: value } : s)
    onChange({ ...schedule, [key]: slots })
  }

  return (
    <div className="space-y-1">
      {DAYS.map(({ key, label }) => {
        const slots = schedule[key] ?? []
        const active = slots.length > 0
        return (
          <div key={key} className="rounded-lg border border-gray-100 overflow-hidden">
            {/* Day header */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
              <button
                type="button"
                onClick={() => toggleDay(key)}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <div className={`w-8 h-4 rounded-full transition-colors relative ${active ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className={`text-xs font-medium w-14 ${active ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
              </button>
              {active && (
                <button
                  type="button"
                  onClick={() => addSlot(key)}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  <Plus size={12} /> Período
                </button>
              )}
            </div>

            {/* Slots */}
            {active && (
              <div className="px-3 py-2 space-y-1.5">
                {slots.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={slot.start}
                      onChange={e => updateSlot(key, idx, 'start', e.target.value)}
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <span className="text-xs text-gray-400">–</span>
                    <input
                      type="time"
                      value={slot.end}
                      onChange={e => updateSlot(key, idx, 'end', e.target.value)}
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => removeSlot(key, idx)}
                      className="text-gray-300 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {slots.length > 1 && (
                  <p className="text-[10px] text-gray-400 pt-0.5">
                    Pausas entre períodos ficam indisponíveis no link público.
                  </p>
                )}
              </div>
            )}
            {!active && (
              <p className="px-3 py-1.5 text-[11px] text-gray-400">Indisponível</p>
            )}
          </div>
        )
      })}
    </div>
  )
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
  const [confirming,    setConfirming]    = useState(false)
  const [removing,      setRemoving]      = useState(false)
  const [editing,       setEditing]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [savingPhoto,   setSavingPhoto]   = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [editName,      setEditName]      = useState(member.name)
  const [editEmail,     setEditEmail]     = useState(member.email)
  const [editRole,      setEditRole]      = useState(member.role as 'receptionist' | 'employee')
  const [editPass,      setEditPass]      = useState('')
  const [schedule,      setSchedule]      = useState<WeekSchedule>(
    (member.weekSchedule as WeekSchedule) ?? { ...EMPTY_SCHEDULE }
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const inputCls  = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'
  const initials  = member.name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const createdAt = new Date(member.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

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

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSavingPhoto(true)
    try {
      const photoUrl = await resizeImage(file, 300)
      const { data } = await api.put(`/users/${member.id}`, { photoUrl })
      showToast('Foto atualizada')
      onUpdated(data.data)
    } catch {
      showToast('Erro ao salvar foto')
    } finally {
      setSavingPhoto(false)
    }
  }

  async function handleSaveSchedule() {
    setSavingSchedule(true)
    try {
      const { data } = await api.put(`/users/${member.id}`, { weekSchedule: schedule })
      showToast('Horários salvos')
      onUpdated(data.data)
    } catch {
      showToast('Erro ao salvar horários')
    } finally { setSavingSchedule(false) }
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
      <div className="fixed inset-y-0 right-0 w-100 bg-white z-50 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {/* Avatar — clicável para trocar foto */}
            <div className="relative shrink-0 group">
              {member.photoUrl ? (
                <img
                  src={member.photoUrl}
                  alt={member.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
                  {initials}
                </div>
              )}
              {member.role !== 'owner' && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={savingPhoto}
                  className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                  title="Trocar foto"
                >
                  {savingPhoto ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera size={14} className="text-white" />
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
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
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Nova senha <span className="text-gray-400 font-normal">(deixe em branco para manter)</span>
                  </label>
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
                  <button onClick={() => setEditing(true)} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer">
                    <Pencil size={12} /> Editar informações
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Weekly Schedule */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Horários da semana</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Adicione múltiplos períodos por dia. Pausas ficam indisponíveis no link público.</p>
              </div>
            </div>
            <ScheduleEditor schedule={schedule} onChange={setSchedule} />
            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              className="mt-3 w-full py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg cursor-pointer transition-colors"
            >
              {savingSchedule ? 'Salvando...' : 'Salvar horários'}
            </button>
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
                <button onClick={() => setConfirming(true)} className="w-full py-2.5 bg-white hover:bg-red-50 text-red-600 text-sm font-semibold rounded-lg border border-red-200 transition-colors cursor-pointer">
                  Remover da equipe
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 text-center">Confirmar remoção de <strong>{member.name}</strong>?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirming(false)} className="flex-1 py-2.5 bg-white hover:bg-gray-50 text-gray-600 text-sm font-semibold rounded-lg border border-gray-200 transition-colors cursor-pointer">
                      Cancelar
                    </button>
                    <button onClick={handleRemove} disabled={removing} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer">
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
  onClose: () => void; onCreated: () => void; showToast: (msg: string) => void
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
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Adicionar membro</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome *</label>
                <input value={name} onChange={e => setName(e.target.value)} required minLength={2} placeholder="Nome completo" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="email@empresa.com" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Senha *</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Mín. 6 caracteres" className={inputCls} />
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
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer">
                {saving ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── Member Card ──────────────────────────────────────────────────────────────

function MemberCard({
  member, metrics, onClick,
}: {
  member: TeamMember
  metrics: UserMetrics | undefined
  onClick: () => void
}) {
  const initials = member.name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-left hover:shadow-md hover:border-gray-200 transition-all cursor-pointer w-full group"
    >
      {/* Top: avatar + name + role */}
      <div className="flex items-start gap-3 mb-4">
        <div className="relative shrink-0">
          {member.photoUrl ? (
            <img
              src={member.photoUrl}
              alt={member.name}
              className="w-11 h-11 rounded-full object-cover"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
              {initials}
            </div>
          )}
          {metrics && metrics.today > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" title="Com agenda hoje" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">{member.name}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${ROLE_CLASS[member.role] ?? 'bg-gray-100 text-gray-600'}`}>
            {ROLE_LABEL[member.role] ?? member.role}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-50">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">{metrics?.total ?? 0}</p>
          <p className="text-xs text-gray-400 mt-0.5">Agendamentos</p>
        </div>
        <div className="text-center border-l border-gray-100">
          <p className={`text-lg font-bold ${metrics?.today ? 'text-green-600' : 'text-gray-400'}`}>
            {metrics?.today ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Hoje</p>
        </div>
        <div className="text-center border-l border-gray-100">
          <p className={`text-lg font-bold ${
            metrics?.attendanceRate == null ? 'text-gray-400'
            : metrics.attendanceRate >= 80 ? 'text-green-600'
            : metrics.attendanceRate >= 60 ? 'text-yellow-600'
            : 'text-red-600'
          }`}>
            {metrics?.attendanceRate != null ? `${metrics.attendanceRate}%` : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Comparecimento</p>
        </div>
      </div>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfessionalsPage() {
  const [team,     setTeam]     = useState<TeamMember[]>([])
  const [metrics,  setMetrics]  = useState<UserMetrics[]>([])
  const [selected, setSelected] = useState<TeamMember | null>(null)
  const [showNew,  setShowNew]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [toast,    setToast]    = useState('')

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 3000)
  }

  const load = useCallback(() => {
    Promise.all([
      api.get('/users'),
      api.get('/users/metrics'),
    ]).then(([usersRes, metricsRes]) => {
      setTeam(usersRes.data.data)
      setMetrics(metricsRes.data.data)
    })
  }, [])

  useEffect(() => { load() }, [load])

  const metricsMap = new Map(metrics.map(m => [m.userId, m]))

  const filtered = team.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  )

  const owners        = team.filter(m => m.role === 'owner').length
  const receptionists = team.filter(m => m.role === 'receptionist').length
  const employees     = team.filter(m => m.role === 'employee').length

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
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
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

        {/* Role summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Donos',          value: owners,        color: 'text-indigo-600' },
            { label: 'Recepcionistas', value: receptionists, color: 'text-blue-600'   },
            { label: 'Profissionais',  value: employees,     color: 'text-gray-700'   },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Cards grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              {search ? <Search size={22} className="text-gray-300" /> : <UsersRound size={22} className="text-gray-300" />}
            </div>
            <p className="text-sm text-gray-400">
              {search ? `Nenhum resultado para "${search}"` : 'Nenhum membro cadastrado'}
            </p>
            {search && (
              <button onClick={() => setSearch('')} className="text-xs text-indigo-600 hover:underline cursor-pointer">
                Limpar busca
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map(m => (
              <MemberCard
                key={m.id}
                member={m}
                metrics={metricsMap.get(m.id)}
                onClick={() => setSelected(m)}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <MemberDrawer
          member={selected}
          onClose={() => setSelected(null)}
          onUpdated={updated => { setSelected(updated); load() }}
          onDeleted={() => { setSelected(null); load() }}
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
