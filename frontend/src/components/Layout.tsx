import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, Users, UsersRound,
  Settings, LogOut, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const ROLE_LABEL: Record<string, string> = {
  owner:        'Dono',
  receptionist: 'Recepcionista',
  employee:     'Profissional',
}

const ALL_LINKS = [
  { to: '/',              label: 'Dashboard',     icon: LayoutDashboard, roles: ['owner', 'receptionist', 'employee'] },
  { to: '/appointments',  label: 'Agendamentos',  icon: CalendarDays,    roles: ['owner', 'receptionist', 'employee'] },
  { to: '/clients',       label: 'Clientes',      icon: Users,           roles: ['owner', 'receptionist']             },
  { to: '/professionals', label: 'Equipe',        icon: UsersRound,      roles: ['owner']                             },
  { to: '/settings',      label: 'Configurações', icon: Settings,        roles: ['owner']                             },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { role, name, logout } = useAuth()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true') // padrão: expandido

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar_collapsed', String(next))
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const links = ALL_LINKS.filter(l => l.roles.includes(role))

  const initials = name
    ? name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className={`${collapsed ? 'w-16' : 'w-56'} shrink-0 transition-all duration-200 bg-indigo-900 text-white flex flex-col`}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className={`flex items-center border-b border-indigo-800 h-14 px-3 ${collapsed ? 'justify-center' : 'justify-between px-4'}`}>
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-[10px] font-semibold text-indigo-300 uppercase tracking-widest">No-Show</p>
              <p className="text-base font-bold">Protection</p>
            </div>
          )}
          <button
            onClick={toggle}
            className="text-indigo-300 hover:text-white transition-colors cursor-pointer p-1 rounded"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* ── Nav ────────────────────────────────────────────────────────────── */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-hidden">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group
                ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-indigo-700 text-white'
                  : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
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
        <div className="border-t border-indigo-800 px-2 py-3 space-y-0.5">

          {/* User info */}
          <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-indigo-600 border border-indigo-500 flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate leading-tight">{name || 'Usuário'}</p>
                <p className="text-xs text-indigo-300 leading-tight">{ROLE_LABEL[role] ?? role}</p>
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-200 hover:bg-indigo-800 hover:text-white transition-colors cursor-pointer group
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

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
