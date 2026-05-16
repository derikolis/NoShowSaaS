import { useState, FormEvent, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import api from '../../services/api'

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function getPasswordStrength(pwd: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pwd.length === 0) return { level: 0, label: '', color: '' }
  const hasUpper   = /[A-Z]/.test(pwd)
  const hasNumber  = /[0-9]/.test(pwd)
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd)
  const long       = pwd.length >= 8

  const score = [pwd.length >= 6, hasUpper, hasNumber, hasSpecial && long].filter(Boolean).length

  if (score <= 1) return { level: 1, label: 'Fraca',  color: 'bg-red-500' }
  if (score <= 2) return { level: 2, label: 'Média',  color: 'bg-yellow-400' }
  return             { level: 3, label: 'Forte',  color: 'bg-green-500' }
}

export default function RegisterPage() {
  const navigate = useNavigate()

  const [tenantName, setTenantName] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [ownerName,  setOwnerName]  = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    if (!slugManual) setTenantSlug(slugify(tenantName))
  }, [tenantName, slugManual])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/register', { tenantName, tenantSlug, ownerName, email, password })
      navigate('/login', { state: { registered: true } })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError(status === 409 ? 'Esse slug já está em uso. Escolha outro.' : 'Erro ao criar conta. Verifique os dados e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const strength = getPasswordStrength(password)
  const rules = [
    { label: 'Mínimo 6 caracteres', ok: password.length >= 6 },
    { label: 'Letra maiúscula',     ok: /[A-Z]/.test(password) },
    { label: 'Número',             ok: /[0-9]/.test(password) },
  ]

  const inputCls = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-900">No-Show Protection</h1>
          <p className="text-gray-500 mt-2">Crie a conta da sua empresa</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa</label>
              <input
                value={tenantName}
                onChange={e => setTenantName(e.target.value)}
                placeholder="Clínica Exemplo"
                required
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slug da empresa
                <span className="text-gray-400 font-normal ml-1">(usado no login)</span>
              </label>
              <input
                value={tenantSlug}
                onChange={e => { setSlugManual(true); setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')) }}
                placeholder="clinica-exemplo"
                required
                pattern="^[a-z0-9-]+$"
                title="Apenas letras minúsculas, números e hífens"
                className={`${inputCls} font-mono`}
              />
              <p className="text-xs text-gray-400 mt-1">Apenas letras minúsculas, números e hífens</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seu nome</label>
              <input
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                placeholder="Dr. João Silva"
                required
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                required
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  className={`${inputCls} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength bar */}
              {password.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden flex gap-0.5">
                      {[1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={`flex-1 h-full rounded-full transition-colors ${i <= strength.level ? strength.color : 'bg-gray-100'}`}
                        />
                      ))}
                    </div>
                    <span className={`text-xs font-medium ${
                      strength.level === 1 ? 'text-red-500'
                      : strength.level === 2 ? 'text-yellow-600'
                      : 'text-green-600'
                    }`}>{strength.label}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {rules.map(r => (
                      <div key={r.label} className={`flex items-center gap-1 text-xs ${r.ok ? 'text-green-600' : 'text-gray-400'}`}>
                        {r.ok ? <Check size={11} /> : <X size={11} />}
                        <span>{r.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Já tem conta?{' '}
            <Link to="/login" className="text-indigo-600 hover:underline font-medium">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
