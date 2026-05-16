import { useEffect, useState, useCallback, FormEvent } from 'react'
import { X, Search, Clock, Banknote, Package, Pencil, ToggleLeft, ToggleRight, CalendarDays } from 'lucide-react'
import Layout from '../../components/Layout'
import { useAuth } from '../../hooks/useAuth'
import api from '../../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Service {
  id: string; name: string; description: string | null
  duration: number; price: number | null; active: boolean; createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

function fmtPrice(price: number | null) {
  if (price === null || price === undefined) return '—'
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function colorIndex(id: string) {
  return id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % CARD_COLORS.length
}

const CARD_COLORS = [
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  { bg: 'bg-teal-100',   text: 'text-teal-700'   },
  { bg: 'bg-emerald-100',text: 'text-emerald-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700'  },
]

// ─── Service Drawer ───────────────────────────────────────────────────────────

function ServiceDrawer({
  service, onClose, onUpdated, showToast,
}: {
  service: Service
  onClose: () => void
  onUpdated: (updated: Service) => void
  showToast: (msg: string) => void
}) {
  const [editing,   setEditing]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [editName,  setEditName]  = useState(service.name)
  const [editDesc,  setEditDesc]  = useState(service.description ?? '')
  const [editDur,   setEditDur]   = useState(service.duration)
  const [editPrice, setEditPrice] = useState(service.price !== null ? String(service.price) : '')

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const color = CARD_COLORS[colorIndex(service.id)]

  async function handleSave(e: FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const { data } = await api.put(`/services/${service.id}`, {
        name:        editName,
        description: editDesc || null,
        duration:    editDur,
        price:       editPrice !== '' ? parseFloat(editPrice) : null,
      })
      showToast('Serviço atualizado')
      setEditing(false)
      onUpdated(data.data)
    } catch { showToast('Erro ao atualizar serviço') }
    finally { setSaving(false) }
  }

  async function toggleActive() {
    try {
      const { data } = await api.put(`/services/${service.id}`, { active: !service.active })
      showToast(service.active ? 'Serviço desativado' : 'Serviço reativado')
      onUpdated(data.data)
    } catch { showToast('Erro ao atualizar') }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-100 bg-white z-50 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${color.bg} ${color.text}`}>
              {service.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 leading-tight">{service.name}</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${service.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {service.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 border-b border-gray-100">
          <div className="text-center py-4">
            <p className="text-xl font-bold text-gray-900">{fmtDuration(service.duration)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Duração</p>
          </div>
          <div className="text-center py-4 border-l border-gray-100">
            <p className="text-xl font-bold text-gray-900">{fmtPrice(service.price)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Valor</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Details / Edit */}
          <div className="px-6 py-5 border-b border-gray-100">
            {editing ? (
              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nome</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} required minLength={2} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Descrição</label>
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} placeholder="Opcional" className={`${inputCls} resize-none`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Duração (min)</label>
                    <input type="number" min={5} max={480} value={editDur} onChange={e => setEditDur(Number(e.target.value))} required className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Preço (R$)</label>
                    <input type="number" min={0} step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder="Opcional" className={inputCls} />
                  </div>
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
                {service.description && (
                  <p className="text-sm text-gray-600 leading-relaxed">{service.description}</p>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Clock size={15} className="text-gray-400 shrink-0" />
                  <span>Duração: {fmtDuration(service.duration)}</span>
                </div>
                {service.price !== null && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Banknote size={15} className="text-gray-400 shrink-0" />
                    <span>Valor: {fmtPrice(service.price)}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <CalendarDays size={15} className="text-gray-400 shrink-0" />
                  <span>Criado em {new Date(service.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                </div>
                <button onClick={() => setEditing(true)} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer">
                  <Pencil size={12} /> Editar informações
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Ações</p>
            <button
              onClick={toggleActive}
              className={`w-full py-2.5 text-sm font-semibold rounded-lg border transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                service.active
                  ? 'bg-white border-gray-200 text-gray-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                  : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
              }`}
            >
              {service.active
                ? <><ToggleLeft size={16} /> Desativar serviço</>
                : <><ToggleRight size={16} /> Reativar serviço</>
              }
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── New Service Modal ────────────────────────────────────────────────────────

function NewServiceModal({
  onClose, onCreated, showToast,
}: {
  onClose: () => void; onCreated: () => void; showToast: (msg: string) => void
}) {
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [duration,    setDuration]    = useState(60)
  const [price,       setPrice]       = useState('')
  const [saving,      setSaving]      = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post('/services', {
        name,
        description: description || undefined,
        duration,
        price: price !== '' ? parseFloat(price) : undefined,
      })
      showToast('Serviço criado com sucesso')
      onCreated()
    } catch { showToast('Erro ao criar serviço') }
    finally { setSaving(false) }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white'

  const DURATION_PRESETS = [30, 45, 60, 90, 120]

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Novo serviço</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome *</label>
              <input value={name} onChange={e => setName(e.target.value)} required minLength={2} placeholder="Ex: Consulta inicial" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Descrição</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Descrição breve (opcional)" className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Duração *</label>
              <div className="flex gap-2 mb-2">
                {DURATION_PRESETS.map(p => (
                  <button
                    key={p} type="button" onClick={() => setDuration(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${duration === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  >
                    {fmtDuration(p)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={5} max={480} value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  required className={`${inputCls} w-28`}
                />
                <span className="text-sm text-gray-400">minutos</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Preço (R$)</label>
              <input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="Opcional — deixe em branco se não cobrado" className={inputCls} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 cursor-pointer">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer">
                {saving ? 'Salvando...' : 'Criar serviço'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({
  service, onClick,
}: {
  service: Service; onClick: () => void
}) {
  const color    = CARD_COLORS[colorIndex(service.id)]
  const initials = service.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-xl border shadow-sm p-5 text-left hover:shadow-md transition-all cursor-pointer w-full group ${
        service.active ? 'border-gray-100 hover:border-gray-200' : 'border-gray-100 opacity-60'
      }`}
    >
      {/* Top */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${color.bg} ${color.text}`}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
              {service.name}
            </p>
            {service.description ? (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{service.description}</p>
            ) : (
              <p className="text-xs text-gray-300 mt-0.5">Sem descrição</p>
            )}
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${service.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {service.active ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-2 gap-2 pt-4 border-t border-gray-50">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-gray-300 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{fmtDuration(service.duration)}</p>
            <p className="text-xs text-gray-400">Duração</p>
          </div>
        </div>
        <div className="flex items-center gap-2 pl-3 border-l border-gray-100">
          <Banknote size={13} className="text-gray-300 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{fmtPrice(service.price)}</p>
            <p className="text-xs text-gray-400">Valor</p>
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'active' | 'inactive'

export default function ServicesPage() {
  const { role } = useAuth()
  const isOwner = role === 'owner'

  const [services, setServices] = useState<Service[]>([])
  const [selected, setSelected] = useState<Service | null>(null)
  const [showNew,  setShowNew]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState<FilterType>('all')
  const [toast,    setToast]    = useState('')

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 3000)
  }

  const load = useCallback(() => {
    api.get('/services').then(({ data }) => setServices(data.data))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = services.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                        (s.description ?? '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'active' ? s.active : !s.active)
    return matchSearch && matchFilter
  })

  const activeCount = services.filter(s => s.active).length
  const avgDuration = services.length
    ? Math.round(services.reduce((sum, s) => sum + s.duration, 0) / services.length)
    : 0
  const pricedServices = services.filter(s => s.price !== null)
  const avgPrice = pricedServices.length
    ? pricedServices.reduce((sum, s) => sum + (s.price ?? 0), 0) / pricedServices.length
    : null

  const FILTER_OPTIONS: [FilterType, string][] = [['all', 'Todos'], ['active', 'Ativos'], ['inactive', 'Inativos']]

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
            <h1 className="text-2xl font-bold text-gray-900">Serviços</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {search || filter !== 'all' ? `${filtered.length} de ${services.length}` : services.length}{' '}
              serviço{services.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Filter tabs */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
              {FILTER_OPTIONS.map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilter(val)}
                  className={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                    filter === val ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar serviço"
                className="pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X size={14} />
                </button>
              )}
            </div>

            {isOwner && (
              <button
                onClick={() => setShowNew(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                + Novo serviço
              </button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total',          value: String(services.length), color: 'text-gray-900'  },
            { label: 'Ativos',         value: String(activeCount),     color: 'text-green-600' },
            { label: 'Duração média',  value: services.length ? fmtDuration(avgDuration) : '—', color: 'text-gray-900' },
            { label: 'Preço médio',    value: fmtPrice(avgPrice),      color: 'text-gray-900'  },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{card.label}</p>
              <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Cards grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              {search ? <Search size={22} className="text-gray-300" /> : <Package size={22} className="text-gray-300" />}
            </div>
            <p className="text-sm text-gray-400">
              {search
                ? `Nenhum resultado para "${search}"`
                : filter !== 'all'
                ? `Nenhum serviço ${filter === 'active' ? 'ativo' : 'inativo'}`
                : 'Nenhum serviço cadastrado'}
            </p>
            {(search || filter !== 'all') && (
              <button
                onClick={() => { setSearch(''); setFilter('all') }}
                className="text-xs text-indigo-600 hover:underline cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map(s => (
              <ServiceCard key={s.id} service={s} onClick={() => setSelected(s)} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <ServiceDrawer
          service={selected}
          onClose={() => setSelected(null)}
          onUpdated={updated => { setSelected(updated); load() }}
          showToast={showToast}
        />
      )}

      {showNew && isOwner && (
        <NewServiceModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load() }}
          showToast={showToast}
        />
      )}
    </Layout>
  )
}
