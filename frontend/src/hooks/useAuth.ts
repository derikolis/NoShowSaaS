import { useState, useEffect } from 'react'
import api from '../services/api'

type AuthUser = { name: string; role: string; slug: string }
type AuthState = { status: 'loading' | 'authenticated' | 'unauthenticated'; user: AuthUser | null }

const SESSION_KEY = 'noshow_session'

let globalState: AuthState = (() => {
  try {
    const cached = sessionStorage.getItem(SESSION_KEY)
    if (cached) return { status: 'authenticated', user: JSON.parse(cached) }
  } catch { /* ignore */ }
  return { status: 'loading', user: null }
})()

const listeners = new Set<() => void>()
let initialized = false

function setGlobal(state: AuthState) {
  globalState = state
  listeners.forEach(fn => fn())
}

function initAuth() {
  if (initialized) return
  initialized = true
  api.get('/auth/me')
    .then(({ data }) => {
      const user = data.data as AuthUser
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
      setGlobal({ status: 'authenticated', user })
    })
    .catch(() => {
      sessionStorage.removeItem(SESSION_KEY)
      setGlobal({ status: 'unauthenticated', user: null })
    })
}

export function useAuth() {
  const [, forceRender] = useState(0)

  useEffect(() => {
    const fn = () => forceRender(n => n + 1)
    listeners.add(fn)
    initAuth()
    return () => { listeners.delete(fn) }
  }, [])

  async function login(email: string, password: string, tenantSlug: string) {
    const { data } = await api.post('/auth/login', { email, password, tenantSlug })
    const user = data.data as AuthUser
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
    setGlobal({ status: 'authenticated', user })
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => null)
    sessionStorage.removeItem(SESSION_KEY)
    setGlobal({ status: 'unauthenticated', user: null })
    window.location.href = '/login'
  }

  return {
    isLoading:       globalState.status === 'loading',
    isAuthenticated: globalState.status === 'authenticated',
    user:            globalState.user,
    name:            globalState.user?.name ?? '',
    role:            globalState.user?.role ?? '',
    slug:            globalState.user?.slug ?? '',
    login,
    logout,
  }
}
