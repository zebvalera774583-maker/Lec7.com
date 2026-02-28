import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleBotEvent } from './handleBotEvent'

const mockFindUnique = vi.fn()
const mockUpsert = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    botChatState: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

describe('handleBotEvent', () => {
  const baseEvent = {
    channel: 'telegram' as const,
    chatId: '123',
    text: '',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('first message shows company confirmation with Да/Нет', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await handleBotEvent({
      ...baseEvent,
      text: 'привет',
    })

    expect(result.messages).toEqual(['Вы делаете заявки в компании Блины Юга'])
    expect(result.replyInlineKeyboard).toEqual({
      buttons: [
        { text: 'Да', callback_data: 'YES' },
        { text: 'Нет', callback_data: 'NO' },
      ],
    })
  })

  it('"да" when awaiting confirm returns accepted', async () => {
    mockFindUnique.mockResolvedValue({
      stateJson: { type: 'awaiting_company_confirm' },
    })

    const result = await handleBotEvent({
      ...baseEvent,
      text: 'да',
    })

    expect(result.messages).toEqual(['Принято. Напишите потребность одним сообщением.'])
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('choice YES (callback) when awaiting confirm returns accepted', async () => {
    mockFindUnique.mockResolvedValue({
      stateJson: { type: 'awaiting_company_confirm' },
    })

    const result = await handleBotEvent({
      ...baseEvent,
      text: '',
      choice: 'YES',
    })

    expect(result.messages).toEqual(['Принято. Напишите потребность одним сообщением.'])
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('"нет" when awaiting confirm returns admin message', async () => {
    mockFindUnique.mockResolvedValue({
      stateJson: { type: 'awaiting_company_confirm' },
    })

    const result = await handleBotEvent({
      ...baseEvent,
      text: 'нет',
    })

    expect(result.messages).toEqual(['Обратитесь к администратору для смены компании.'])
  })

  it('accepted text when confirmed returns принял', async () => {
    mockFindUnique.mockResolvedValue({
      stateJson: { type: 'confirmed' },
    })

    const result = await handleBotEvent({
      ...baseEvent,
      text: 'яблоки 10 кг',
    })

    expect(result.messages).toEqual(['Принял: "яблоки 10 кг" ✅'])
  })
})
