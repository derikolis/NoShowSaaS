import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, Users, UsersRound, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/appointments', label: 'Agendamentos', icon: CalendarDays },
  { to: '/clients', label: 'Clientes', icon: Users },
  { to: '/professionals', label: 'Equipe', icon: UsersRound },
  { to: '/settings', label: 'Configurações', icon: Settings },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-indigo-900 text-white flex flex-col">
        <div className="px-6 py-5 border-b border-indigo-800">
          <p className="text-xs font-semibold text-indigo-300 uppercase tracking-widest">No-Show</p>
          <p className="text-lg font-bold leading-tight">Protection</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-700 text-white'
                    : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-indigo-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-indigo-200 hover:bg-indigo-800 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
