import { Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useAdminAuth } from './hooks/useAdminAuth'
import LoginPage from './pages/app/LoginPage'
import RegisterPage from './pages/app/RegisterPage'
import DashboardPage from './pages/app/DashboardPage'
import AppointmentsPage from './pages/app/AppointmentsPage'
import ClientsPage from './pages/app/ClientsPage'
import ProfessionalsPage from './pages/app/ProfessionalsPage'
import ServicesPage from './pages/app/ServicesPage'
import BookingPage from './pages/booking/BookingPage'
import ClientPortalPage from './pages/booking/ClientPortalPage'
import SettingsPage from './pages/app/SettingsPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminTenantsPage from './pages/admin/AdminTenantsPage'
import LandingPage from './pages/landing/LandingPage'

export default function App() {
  const { isAuthenticated, isLoading } = useAuth()
  const { isAuthenticated: isAdmin, isLoading: isAdminLoading } = useAdminAuth()

  if (isLoading || isAdminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <Routes>
      {/* ── Tenant ─────────────────────────────────────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={isAuthenticated ? <DashboardPage /> : <LandingPage />} />
      <Route path="/appointments" element={isAuthenticated ? <AppointmentsPage /> : <Navigate to="/login" />} />
      <Route path="/clients" element={isAuthenticated ? <ClientsPage /> : <Navigate to="/login" />} />
      <Route path="/professionals" element={isAuthenticated ? <ProfessionalsPage /> : <Navigate to="/login" />} />
      <Route path="/services" element={isAuthenticated ? <ServicesPage /> : <Navigate to="/login" />} />
      <Route path="/settings" element={isAuthenticated ? <SettingsPage /> : <Navigate to="/login" />} />
      <Route path="/agendar/:slug" element={<BookingPage />} />
      <Route path="/agendar/:slug/minha-conta" element={<ClientPortalPage />} />

      {/* ── Admin ──────────────────────────────────────────────────────────── */}
      <Route path="/admin" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={isAdmin ? <AdminDashboardPage /> : <Navigate to="/admin" />} />
      <Route path="/admin/tenants" element={isAdmin ? <AdminTenantsPage /> : <Navigate to="/admin" />} />
    </Routes>
  )
}
