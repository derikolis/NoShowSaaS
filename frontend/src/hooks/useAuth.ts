import { useState, useEffect } from 'react'
import api from '../services/api'

const TOKEN_KEY = 'noshow_token'

function decodePayload(token: string): { role: string; name: string } {
  try {
    const p = JSON.parse(atob(token.split('.')[1]))
    return { role: p.role ?? '', name: p.name ?? '' }
  } catch {
    return { role: '', name: '' }
  }
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [name, setName] = useState(() => token ? decodePayload(token).name : '')

  const role = token ? decodePayload(token).role : ''

  // Se o token não tiver o nome (token antigo), busca do servidor
  useEffect(() => {
    if (!token) return
    if (decodePayload(token).name) return
    api.get('/users/me').then(({ data }) => setName(data.data.name)).catch(() => null)
  }, [token])

  async function login(email: string, password: string, tenantSlug: string) {
    const { data } = await api.post('/auth/login', { email, password, tenantSlug })
    const t = data.data.token
    localStorage.setItem(TOKEN_KEY, t)
    setToken(t)
    setName(decodePayload(t).name)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setName('')
  }

  return { token, role, name, login, logout }
}
