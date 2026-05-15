import { useState } from 'react'
import api from '../services/api'

const TOKEN_KEY = 'noshow_token'

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))

  async function login(email: string, password: string, tenantSlug: string) {
    const { data } = await api.post('/auth/login', { email, password, tenantSlug })
    localStorage.setItem(TOKEN_KEY, data.data.token)
    setToken(data.data.token)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
  }

  return { token, login, logout }
}
