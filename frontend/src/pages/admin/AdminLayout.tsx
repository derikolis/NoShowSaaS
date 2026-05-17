import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, LogOut,
  PanelLeftClose, PanelLeftOpen, ShieldCheck, Activity,
} from 'lucide-react'
import { useAdminAuth } from '../../hooks/useAdminAuth'

const NAV_LINKS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/tenants',   label: 'Empresas',  icon: Building2       },
  { to: '/admin/status',    label: 'Status',    icon: Activity        },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { name, logout } = useAdminAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  function toggle() {
    setCollapsed(prev => !prev)
  }

  function handleLogout() {
    logout()
    navigate('/admin')
  }

  const initials = name
    ? name.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'SA'

  return (
    <div className="flex h-screen bg-slate-950">
      <aside className={`${collapsed ? 'w-16' : 'w-56'} shrink-0 transition-all duration-200 bg-slate-900 border-r border-slate-800 text-white flex flex-col`}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className={`flex items-center border-b border-slate-800 h-14 px-3 ${collapsed ? 'justify-center' : 'justify-between px-4'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-indigo-400 shrink-0" />
              <div className="leading-tight">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Admin</p>
                <p className="text-sm font-bold text-white">Painel de Controle</p>
              </div>
            </div>
          )}
          <button
            onClick={toggle}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* ── Nav ────────────────────────────────────────────────────────────── */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-hidden">
          {NAV_LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group
                ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
              {collapsed && (
                <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="border-t border-slate-800 px-2 py-3 space-y-0.5">
          <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate leading-tight">{name || 'Admin'}</p>
                <p className="text-xs text-slate-400 leading-tight">Super Admin</p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer group
              ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && 'Sair'}
            {collapsed && (
              <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                Sair
              </span>
            )}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-slate-950">
        {children}
      </main>
    </div>
  )
}
