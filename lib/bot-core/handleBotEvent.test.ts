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

const mockGetCatalogNormMap = vi.fn()
vi.mock('@/lib/catalog-match', () => ({
  getCatalogNormMap: () => mockGetCatalogNormMap(),
  matchToCatalogSync: (map: Map<string, string>, name: string) => {
    const norm = (name || '').trim().toLowerCase().replace(/\s+/g, ' ')
    if (!norm) return false
    if (map.has(norm)) return true
    const first = norm.split(/\s+/)[0]
    return first ? map.has(first) : false
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
    mockFindUnique.mockResolvedValue({ stateJson: { type: 'confirmed' } })
    mockGetCatalogNormMap.mockResolvedValue(new Map([['яблоки', 'id1']]))

    const result = await handleBotEvent({
      ...baseEvent,
      text: 'яблоки 10 кг',
    })

    expect(result.messages).toEqual(['Принял: "яблоки 10 кг" ✅'])
  })

  it('"Айсберг салат 3 шт" does NOT ask for clarification (qty+unit present)', async () => {
    mockFindUnique.mockResolvedValue({ stateJson: { type: 'confirmed' } })
    mockGetCatalogNormMap.mockResolvedValue(new Map([['айсберг', 'id1']]))

    const result = await handleBotEvent({
      ...baseEvent,
      text: 'Айсберг салат 3 шт',
    })

    expect(result.messages.some((m) => m.includes('Укажите') || m.includes('ед. изм'))).toBe(false)
    expect(result.messages[0]).toContain('Принял')
  })

  it('multi-item "Айсберг салат 3 шт, груши 5 кг" parses as two items without asking', async () => {
    mockFindUnique.mockResolvedValue({ stateJson: { type: 'confirmed' } })
    mockGetCatalogNormMap.mockResolvedValue(
      new Map([
        ['айсберг', 'id1'],
        ['груши', 'id2'],
      ])
    )

    const result = await handleBotEvent({
      ...baseEvent,
      text: 'Айсберг салат 3 шт, груши 5 кг',
    })

    expect(result.messages.some((m) => m.includes('Укажите'))).toBe(false)
    expect(result.messages[0]).toContain('Принял')
  })

  it('clarification: "Айсберг салат 3 шт, груши 5" asks for unit, then "кг" yields full list', async () => {
    mockGetCatalogNormMap.mockResolvedValue(
      new Map([
        ['айсберг', 'id1'],
        ['груши', 'id2'],
      ])
    )

    mockFindUnique
      .mockResolvedValueOnce({ stateJson: { type: 'confirmed' } })
      .mockResolvedValueOnce({
        stateJson: {
          type: 'confirmed',
          pendingUnit: {
            needText: 'Айсберг салат 3 шт, груши 5',
            incompleteRaw: ['груши 5'],
          },
        },
      })

    const askResult = await handleBotEvent({
      ...baseEvent,
      text: 'Айсберг салат 3 шт, груши 5',
    })
    expect(askResult.messages.some((m) => m.includes('Укажите'))).toBe(true)

    const replyResult = await handleBotEvent({
      ...baseEvent,
      text: 'кг',
    })
    expect(replyResult.messages.some((m) => m.includes('Укажите'))).toBe(false)
    expect(replyResult.messages[0]).toContain('Принял')
  })
})
