import { Routes, Route, Navigate } from 'react-router-dom'
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
  const token = localStorage.getItem('noshow_token')
  const adminToken = localStorage.getItem('noshow_admin_token')

  return (
    <Routes>
      {/* ── Tenant ─────────────────────────────────────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={token ? <DashboardPage /> : <LandingPage />} />
      <Route path="/appointments" element={token ? <AppointmentsPage /> : <Navigate to="/login" />} />
      <Route path="/clients" element={token ? <ClientsPage /> : <Navigate to="/login" />} />
      <Route path="/professionals" element={token ? <ProfessionalsPage /> : <Navigate to="/login" />} />
      <Route path="/services" element={token ? <ServicesPage /> : <Navigate to="/login" />} />
      <Route path="/settings" element={token ? <SettingsPage /> : <Navigate to="/login" />} />
      <Route path="/agendar/:slug" element={<BookingPage />} />
      <Route path="/agendar/:slug/minha-conta" element={<ClientPortalPage />} />

      {/* ── Admin ──────────────────────────────────────────────────────────── */}
      <Route path="/admin" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={adminToken ? <AdminDashboardPage /> : <Navigate to="/admin" />} />
      <Route path="/admin/tenants" element={adminToken ? <AdminTenantsPage /> : <Navigate to="/admin" />} />
    </Routes>
  )
}
