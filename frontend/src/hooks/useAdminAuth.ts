import { useState, useEffect } from 'react'
import adminApi from '../services/adminApi'

type AdminUser = { name: string; role: string }
type AdminState = { status: 'loading' | 'authenticated' | 'unauthenticated'; user: AdminUser | null }

const SESSION_KEY = 'noshow_admin_session'

let globalState: AdminState = (() => {
  try {
    const cached = sessionStorage.getItem(SESSION_KEY)
    if (cached) return { status: 'authenticated', user: JSON.parse(cached) }
  } catch { /* ignore */ }
  return { status: 'loading', user: null }
})()

const listeners = new Set<() => void>()
let initialized = false

function setGlobal(state: AdminState) {
  globalState = state
  listeners.forEach(fn => fn())
}

function initAdminAuth() {
  if (initialized) return
  initialized = true

  if (!sessionStorage.getItem(SESSION_KEY)) {
    setGlobal({ status: 'unauthenticated', user: null })
    return
  }

  adminApi.get('/admin/auth/me')
    .then(({ data }) => {
      const user = data.data as AdminUser
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
      setGlobal({ status: 'authenticated', user })
    })
    .catch(() => {
      sessionStorage.removeItem(SESSION_KEY)
      setGlobal({ status: 'unauthenticated', user: null })
    })
}

export function useAdminAuth() {
  const [, forceRender] = useState(0)

  useEffect(() => {
    const fn = () => forceRender(n => n + 1)
    listeners.add(fn)
    initAdminAuth()
    return () => { listeners.delete(fn) }
  }, [])

  async function login(email: string, password: string) {
    const { data } = await adminApi.post('/admin/auth/login', { email, password })
    const user = data.data as AdminUser
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
    setGlobal({ status: 'authenticated', user })
  }

  async function logout() {
    await adminApi.post('/admin/auth/logout').catch(() => null)
    sessionStorage.removeItem(SESSION_KEY)
    setGlobal({ status: 'unauthenticated', user: null })
    window.location.href = '/admin'
  }

  return {
    isLoading:       globalState.status === 'loading',
    isAuthenticated: globalState.status === 'authenticated',
    user:            globalState.user,
    name:            globalState.user?.name ?? '',
    role:            globalState.user?.role ?? '',
    login,
    logout,
  }
}
