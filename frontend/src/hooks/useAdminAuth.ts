import { useState } from 'react'
import adminApi from '../services/adminApi'

const TOKEN_KEY = 'noshow_admin_token'

function decodePayload(token: string): { role: string; name: string } {
  try {
    const p = JSON.parse(atob(token.split('.')[1]))
    return { role: p.role ?? '', name: p.name ?? '' }
  } catch {
    return { role: '', name: '' }
  }
}

export function useAdminAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))

  const role = token ? decodePayload(token).role : ''
  const name = token ? decodePayload(token).name : ''

  async function login(email: string, password: string) {
    const { data } = await adminApi.post('/admin/auth/login', { email, password })
    const t = data.data.token
    localStorage.setItem(TOKEN_KEY, t)
    setToken(t)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
  }

  return { token, role, name, login, logout }
}
