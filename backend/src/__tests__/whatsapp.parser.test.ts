import {
  extractPhone,
  isGroup,
  extractText,
  isConfirm,
  isCancel,
  isReschedule,
} from '../webhooks/whatsapp.webhook'

// Mock do Prisma e notificações (o arquivo importa esses módulos mesmo sem usá-los nos exports puros)
jest.mock('../shared/utils/prisma', () => ({ __esModule: true, default: {} }))
jest.mock('../modules/waitlist/waitlist.service', () => ({}))
jest.mock('../modules/notifications/notification.service', () => ({}))
jest.mock('../modules/risk-engine/risk.service', () => ({}))
jest.mock('../shared/types/api', () => ({ ok: jest.fn() }))

// ─── extractPhone ─────────────────────────────────────────────────────────────

describe('extractPhone', () => {
  it('remove sufixo @s.whatsapp.net', () => {
    expect(extractPhone('5511999990000@s.whatsapp.net')).toBe('5511999990000')
  })
  it('remove sufixo @g.us em grupos', () => {
    expect(extractPhone('120363000000@g.us')).toBe('120363000000')
  })
})

// ─── isGroup ──────────────────────────────────────────────────────────────────

describe('isGroup', () => {
  it('retorna true para JID de grupo', () => {
    expect(isGroup('120363000000@g.us')).toBe(true)
  })
  it('retorna false para JID de pessoa', () => {
    expect(isGroup('5511999990000@s.whatsapp.net')).toBe(false)
  })
})

// ─── extractText ──────────────────────────────────────────────────────────────

describe('extractText', () => {
  it('extrai conversation simples', () => {
    expect(extractText({ conversation: 'sim' })).toBe('sim')
  })

  it('extrai extendedTextMessage', () => {
    expect(extractText({ extendedTextMessage: { text: 'não' } })).toBe('não')
  })

  it('extrai selectedButtonId de buttonsResponseMessage', () => {
    expect(extractText({ buttonsResponseMessage: { selectedButtonId: 'btn_confirm' } })).toBe('btn_confirm')
  })

  it('extrai selectedDisplayText de buttonsResponseMessage como fallback', () => {
    expect(extractText({ buttonsResponseMessage: { selectedDisplayText: 'Confirmar' } })).toBe('Confirmar')
  })

  it('extrai selectedId de templateButtonReplyMessage', () => {
    expect(extractText({ templateButtonReplyMessage: { selectedId: '1' } })).toBe('1')
  })

  it('extrai listResponseMessage', () => {
    expect(extractText({
      listResponseMessage: { singleSelectReply: { selectedRowId: 'btn_reschedule' } },
    })).toBe('btn_reschedule')
  })

  it('retorna string vazia para mensagem desconhecida', () => {
    expect(extractText({ imageMessage: {} })).toBe('')
  })

  it('retorna string vazia para objeto vazio', () => {
    expect(extractText({})).toBe('')
  })
})

// ─── isConfirm / isCancel / isReschedule ─────────────────────────────────────

describe('isConfirm', () => {
  it.each(['sim', 'SIM', '1', 'btn_confirm', 'confirmar', 'confirm'])(
    'reconhece "%s"', (text) => expect(isConfirm(text)).toBe(true)
  )
  it.each(['não', 'cancelar', '2', 'reagendar', 'nao'])(
    'rejeita "%s"', (text) => expect(isConfirm(text)).toBe(false)
  )
})

describe('isCancel', () => {
  it.each(['não', 'nao', 'não', '2', 'btn_cancel', 'cancelar', 'cancel'])(
    'reconhece "%s"', (text) => expect(isCancel(text)).toBe(true)
  )
  it.each(['sim', '1', 'reagendar', '3'])(
    'rejeita "%s"', (text) => expect(isCancel(text)).toBe(false)
  )
})

describe('isReschedule', () => {
  it.each(['3', 'btn_reschedule', 'reagendar', 'reschedule'])(
    'reconhece "%s"', (text) => expect(isReschedule(text)).toBe(true)
  )
  it.each(['sim', '1', 'cancelar', '2'])(
    'rejeita "%s"', (text) => expect(isReschedule(text)).toBe(false)
  )
})
