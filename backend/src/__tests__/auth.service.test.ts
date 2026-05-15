import { registerTenant, login } from '../modules/auth/auth.service'

jest.mock('../shared/utils/prisma', () => ({
  __esModule: true,
  default: {
    tenant: { findUnique: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}))

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mocked_token'),
}))

import prisma from '../shared/utils/prisma'
import bcrypt from 'bcryptjs'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>

// ─── registerTenant ───────────────────────────────────────────────────────────

describe('registerTenant', () => {
  beforeEach(() => jest.clearAllMocks())

  it('cria tenant e owner com sucesso', async () => {
    ;(mockPrisma.tenant.findUnique as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.tenant.create as jest.Mock).mockResolvedValue({
      id: 'tenant-1',
      slug: 'clinica-teste',
      users: [{ id: 'user-1', email: 'dono@teste.com', role: 'owner' }],
    })

    const result = await registerTenant('Clínica Teste', 'clinica-teste', 'Dono', 'dono@teste.com', '123456')

    expect(mockPrisma.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'clinica-teste' }),
      })
    )
    expect(result.slug).toBe('clinica-teste')
  })

  it('lança erro se slug já estiver em uso', async () => {
    ;(mockPrisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' })

    await expect(
      registerTenant('Clínica Teste', 'clinica-teste', 'Dono', 'dono@teste.com', '123456')
    ).rejects.toThrow('Slug já em uso')

    expect(mockPrisma.tenant.create).not.toHaveBeenCalled()
  })
})

// ─── login ────────────────────────────────────────────────────────────────────

describe('login', () => {
  beforeEach(() => jest.clearAllMocks())

  const tenant = { id: 'tenant-1', slug: 'clinica-teste' }
  const user = {
    id: 'user-1',
    email: 'dono@teste.com',
    name: 'Dono',
    role: 'owner',
    passwordHash: 'hashed_password',
  }

  it('retorna token com credenciais válidas', async () => {
    ;(mockPrisma.tenant.findUnique as jest.Mock).mockResolvedValue(tenant)
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user)
    ;(mockBcrypt.compare as jest.Mock).mockResolvedValue(true)

    const result = await login('dono@teste.com', '123456', 'clinica-teste')

    expect(result.token).toBe('mocked_token')
    expect(result.user.email).toBe('dono@teste.com')
  })

  it('lança erro para empresa inexistente', async () => {
    ;(mockPrisma.tenant.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(login('x@x.com', '123', 'slug-invalido')).rejects.toThrow('Empresa não encontrada')
  })

  it('lança erro para usuário inexistente', async () => {
    ;(mockPrisma.tenant.findUnique as jest.Mock).mockResolvedValue(tenant)
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    await expect(login('naoexiste@teste.com', '123', 'clinica-teste')).rejects.toThrow('Credenciais inválidas')
  })

  it('lança erro para senha incorreta', async () => {
    ;(mockPrisma.tenant.findUnique as jest.Mock).mockResolvedValue(tenant)
    ;(mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user)
    ;(mockBcrypt.compare as jest.Mock).mockResolvedValue(false)

    await expect(login('dono@teste.com', 'senha_errada', 'clinica-teste')).rejects.toThrow('Credenciais inválidas')
  })
})
