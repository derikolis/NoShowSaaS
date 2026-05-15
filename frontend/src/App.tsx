import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import AppointmentsPage from './pages/AppointmentsPage'
import ClientsPage from './pages/ClientsPage'
import ProfessionalsPage from './pages/ProfessionalsPage'
import SettingsPage from './pages/SettingsPage'
import { useAuth } from './hooks/useAuth'

export default function App() {
  const { token } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={token ? <DashboardPage /> : <Navigate to="/login" />} />
      <Route path="/appointments" element={token ? <AppointmentsPage /> : <Navigate to="/login" />} />
      <Route path="/clients" element={token ? <ClientsPage /> : <Navigate to="/login" />} />
      <Route path="/professionals" element={token ? <ProfessionalsPage /> : <Navigate to="/login" />} />
      <Route path="/settings" element={token ? <SettingsPage /> : <Navigate to="/login" />} />
    </Routes>
  )
}
