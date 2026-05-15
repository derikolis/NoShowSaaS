import { classifyRisk, calculateScore } from '../modules/risk-engine/risk.service'

// Mock do Prisma — testes não tocam o banco
jest.mock('../shared/utils/prisma', () => ({
  __esModule: true,
  default: {
    client: { findFirst: jest.fn() },
    appointment: { findMany: jest.fn() },
  },
}))

import prisma from '../shared/utils/prisma'
const mockPrisma = prisma as jest.Mocked<typeof prisma>

// ─── classifyRisk ────────────────────────────────────────────────────────────

describe('classifyRisk', () => {
  it('retorna low para score 0', () => expect(classifyRisk(0)).toBe('low'))
  it('retorna low para score 30', () => expect(classifyRisk(30)).toBe('low'))
  it('retorna medium para score 31', () => expect(classifyRisk(31)).toBe('medium'))
  it('retorna medium para score 60', () => expect(classifyRisk(60)).toBe('medium'))
  it('retorna high para score 61', () => expect(classifyRisk(61)).toBe('high'))
  it('retorna high para score 100', () => expect(classifyRisk(100)).toBe('high'))
})

// ─── calculateScore ──────────────────────────────────────────────────────────

function makeDate(hour: number, minutesFromNow = 180): Date {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  // garante que está no futuro (> 2h) por padrão
  d.setTime(d.getTime() + minutesFromNow * 60 * 1000)
  return d
}

function mockClient(overrides = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(mockPrisma.client.findFirst as jest.Mock).mockResolvedValue({
    id: 'client-1',
    tenantId: 'tenant-1',
    isVip: false,
    riskScore: 0,
    ...overrides,
  })
}

function mockHistory(records: { status: string }[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(mockPrisma.appointment.findMany as jest.Mock).mockResolvedValue(records)
}

describe('calculateScore', () => {
  const tenantId = 'tenant-1'
  const clientId = 'client-1'
  // Horário fora do pico (10h) e mais de 2h no futuro
  const safeDate = new Date(Date.now() + 3 * 60 * 60 * 1000)

  beforeEach(() => jest.clearAllMocks())

  it('cliente novo sem histórico recebe +15', async () => {
    mockClient()
    mockHistory([])
    const { score } = await calculateScore(tenantId, clientId, safeDate)
    expect(score).toBe(15)
  })

  it('cliente com 1 no-show recebe +20', async () => {
    mockClient()
    mockHistory([{ status: 'no_show' }])
    const { score } = await calculateScore(tenantId, clientId, safeDate)
    expect(score).toBe(20)
  })

  it('cliente com 2+ no-shows recebe +40', async () => {
    mockClient()
    mockHistory([{ status: 'no_show' }, { status: 'no_show' }])
    const { score } = await calculateScore(tenantId, clientId, safeDate)
    expect(score).toBe(40)
  })

  it('confirmação prévia reduz -30', async () => {
    mockClient()
    mockHistory([{ status: 'confirmed' }])
    // tem histórico: não é novo (+0), confirmou (-30) → score mínimo 0
    const { score } = await calculateScore(tenantId, clientId, safeDate)
    expect(score).toBe(0)
  })

  it('horário de pico (12h–14h) adiciona +20', async () => {
    mockClient()
    mockHistory([])
    // horário no pico: 12h, > 2h no futuro
    const peakDate = new Date()
    peakDate.setHours(12, 30, 0, 0)
    peakDate.setDate(peakDate.getDate() + 1)
    const { score } = await calculateScore(tenantId, clientId, peakDate)
    expect(score).toBe(15 + 20) // novo + pico
  })

  it('agendamento de última hora (< 2h) adiciona +25', async () => {
    mockClient()
    mockHistory([])
    const lastMinute = new Date(Date.now() + 60 * 60 * 1000) // 1h no futuro
    const { score } = await calculateScore(tenantId, clientId, lastMinute)
    expect(score).toBe(15 + 25) // novo + última hora
  })

  it('cliente VIP reduz -20', async () => {
    mockClient({ isVip: true })
    mockHistory([])
    const { score } = await calculateScore(tenantId, clientId, safeDate)
    expect(score).toBe(15 - 20 < 0 ? 0 : 15 - 20) // mínimo 0
  })

  it('score nunca fica negativo', async () => {
    mockClient({ isVip: true })
    mockHistory([{ status: 'confirmed' }, { status: 'confirmed' }])
    const { score } = await calculateScore(tenantId, clientId, safeDate)
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('lança erro se cliente não existir', async () => {
    ;(mockPrisma.client.findFirst as jest.Mock).mockResolvedValue(null)
    await expect(calculateScore(tenantId, clientId, safeDate)).rejects.toThrow('Cliente não encontrado')
  })
})
