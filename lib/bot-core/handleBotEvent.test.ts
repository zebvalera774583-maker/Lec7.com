import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleBotEvent, splitIntoItems, parseOneItem } from './handleBotEvent'

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
vi.mock('@/lib/catalog-match', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog-match')>()
  return {
    getCatalogNormMap: () => mockGetCatalogNormMap(),
    matchToCatalogSyncWithNorm: actual.matchToCatalogSyncWithNorm,
  }
})

const mockRecognizeNeedsForChat = vi.fn()
vi.mock('@/lib/orchestrator/recognizeNeedsForChat', () => ({
  recognizeNeedsForChat: (...args: unknown[]) => mockRecognizeNeedsForChat(...args),
}))

describe('handleBotEvent', () => {
  const baseEvent = {
    channel: 'telegram' as const,
    chatId: '123',
    text: '',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRecognizeNeedsForChat.mockResolvedValue(undefined)
  })

  it('first message (no state): привет → подсказка формата, без Да/Нет', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await handleBotEvent({
      ...baseEvent,
      text: 'привет',
    })

    expect(result.messages).toEqual(['Напишите потребность в формате, например: яблоки 10 кг'])
    expect(result.replyInlineKeyboard).toBeUndefined()
  })

  it('awaiting_company_confirm migrated to confirmed: "да" → подсказка формата', async () => {
    mockFindUnique.mockResolvedValue({
      stateJson: { type: 'awaiting_company_confirm' },
    })

    const result = await handleBotEvent({
      ...baseEvent,
      text: 'да',
    })

    expect(result.messages).toEqual(['Напишите потребность в формате, например: яблоки 10 кг'])
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('awaiting_company_confirm migrated: choice YES → подсказка формата', async () => {
    mockFindUnique.mockResolvedValue({
      stateJson: { type: 'awaiting_company_confirm' },
    })

    const result = await handleBotEvent({
      ...baseEvent,
      text: '',
      choice: 'YES',
    })

    expect(result.messages).toEqual(['Напишите потребность в формате, например: яблоки 10 кг'])
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('awaiting_company_confirm migrated: "нет" → подсказка формата', async () => {
    mockFindUnique.mockResolvedValue({
      stateJson: { type: 'awaiting_company_confirm' },
    })

    const result = await handleBotEvent({
      ...baseEvent,
      text: 'нет',
    })

    expect(result.messages).toEqual(['Напишите потребность в формате, например: яблоки 10 кг'])
    expect(mockUpdate).toHaveBeenCalled()
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

  it('"Айсберг салат 3 шт" stays one item (not split into "салат 3 шт"); with айсберг in catalog → match, no clarification', async () => {
    mockFindUnique.mockResolvedValue({ stateJson: { type: 'confirmed' } })
    mockGetCatalogNormMap.mockResolvedValue(new Map([['айсберг', 'id1']]))

    const result = await handleBotEvent({
      ...baseEvent,
      text: 'Айсберг салат 3 шт',
    })

    expect(result.messages.some((m) => m.includes('Укажите'))).toBe(false)
    expect(result.messages[0]).toContain('Принял')
  })

  it('splitIntoItems: continuous "шампиньоны 1 кг перец красный 1 кг" keeps number+unit with each item', () => {
    const items = splitIntoItems('шампиньоны 1 кг перец красный 1 кг помидоры розовые 2 кг')
    expect(items).toContain('шампиньоны 1 кг')
    expect(items).toContain('перец красный 1 кг')
    expect(items).toContain('помидоры розовые 2 кг')
    const p1 = parseOneItem('шампиньоны 1 кг')
    expect(p1.hasUnit).toBe(true)
    expect(p1.unit).toBe('кг')
  })

  it('splitIntoItems: "Голубика 0,5 кг" stays one item (comma in 0,5 is decimal, not delimiter)', () => {
    const items = splitIntoItems('Голубика 0,5 кг\nМиндаль 1 кг')
    expect(items).toContain('Голубика 0,5 кг')
    expect(items).toContain('Миндаль 1 кг')
    const parsed = parseOneItem('Голубика 0,5 кг')
    expect(parsed.name).toBe('Голубика')
    expect(parsed.quantity).toBe('0.5')
    expect(parsed.unit).toBe('кг')
    expect(parsed.hasUnit).toBe(true)
  })

  it('splitIntoItems: "Айсберг салат 3 шт" stays one item (not split by "г" in Айсберг)', () => {
    const items = splitIntoItems('Айсберг салат 3 шт')
    expect(items).toEqual(['Айсберг салат 3 шт'])
    expect(items[0]).toContain('Айсберг')
  })

  it('"Айсберг  салат  3  шт" (double spaces) parses as one item', () => {
    const items = splitIntoItems('Айсберг  салат  3  шт')
    expect(items).toHaveLength(1)
    expect(items[0]).toContain('Айсберг')
    const parsed = parseOneItem(items[0])
    expect(parsed.name).toBe('Айсберг салат')
    expect(parsed.quantity).toBe('3')
    expect(parsed.unit).toBe('шт')
  })

  it('"Айсберг салат 3 шт" with only "салат" in catalog → unmapped, no "салат" item', async () => {
    mockFindUnique.mockResolvedValue({ stateJson: { type: 'confirmed' } })
    mockGetCatalogNormMap.mockResolvedValue(new Map([['салат', 'id1']]))

    const result = await handleBotEvent({
      ...baseEvent,
      text: 'Айсберг салат 3 шт',
    })

    expect(result.messages.some((m) => m.includes('Укажите'))).toBe(false)
    expect(result.messages[0]).toContain('Принял')
  })

  it('orchestrator: item with empty qty (Морковь-) asks for qty+unit clarification (text-only)', async () => {
    const origEnv = process.env.BOT_BUSINESS_ID
    process.env.BOT_BUSINESS_ID = 'test-business-id'
    mockFindUnique.mockResolvedValue({ stateJson: { type: 'confirmed' } })
    mockRecognizeNeedsForChat.mockResolvedValue({
      intent: 'create_needs',
      items: [{ canonicalName: 'Морковь', quantity: '', unit: '' }],
    })

    const result = await handleBotEvent({
      ...baseEvent,
      text: 'Лук 2кг\nМорковь-\nЧеснок 0,500',
    })

    expect(result.messages[0]).toContain('Уточните количество и единицу для:')
    expect(result.messages[0]).toContain('Морковь')
    expect(result.replyInlineKeyboard).toBeUndefined()
    process.env.BOT_BUSINESS_ID = origEnv
  })

  it('orchestrator: Морковь- + "2" (без unit) → просит "Уточните единицу"', async () => {
    process.env.BOT_BUSINESS_ID = 'test-business-id'
    mockFindUnique.mockResolvedValue({
      stateJson: {
        type: 'awaiting_item_clarification',
        pendingItems: {
          needText: 'Лук 2кг\nМорковь-\nЧеснок 0,500',
          parsedItems: [
            { name: 'Лук', quantity: '2', unit: 'кг' },
            { name: 'Морковь', quantity: '', unit: 'кг' },
            { name: 'Чеснок', quantity: '0.5', unit: 'кг' },
          ],
          commentsText: null,
        },
        pendingIndex: 1,
      },
    })

    const result = await handleBotEvent({
      ...baseEvent,
      text: '2',
    })

    expect(result.messages[0]).toContain('Уточните единицу')
    expect(result.messages[0]).not.toContain('Выберите подразделение')
  })

  it('orchestrator: Морковь- + "2 кг" → then "Выберите подразделение"', async () => {
    const origEnv = process.env.BOT_BUSINESS_ID
    process.env.BOT_BUSINESS_ID = 'test-business-id'
    mockFindUnique
      .mockResolvedValueOnce({ stateJson: { type: 'confirmed' } })
      .mockResolvedValueOnce({
        stateJson: {
          type: 'awaiting_item_clarification',
          pendingItems: {
            needText: 'Лук 2кг\nМорковь-\nЧеснок 0,500',
            parsedItems: [
              { name: 'Лук', quantity: '2', unit: 'кг' },
              { name: 'Морковь', quantity: '', unit: '' },
              { name: 'Чеснок', quantity: '0.5', unit: 'кг' },
            ],
            commentsText: null,
          },
          pendingIndex: 1,
        },
      })

    mockRecognizeNeedsForChat.mockResolvedValue({
      intent: 'create_needs',
      items: [
        { canonicalName: 'Лук', quantity: '2', unit: 'кг' },
        { canonicalName: 'Морковь', quantity: '', unit: '' },
        { canonicalName: 'Чеснок', quantity: '0.5', unit: 'кг' },
      ],
    })

    const askResult = await handleBotEvent({
      ...baseEvent,
      text: 'Лук 2кг\nМорковь-\nЧеснок 0,500',
    })
    expect(askResult.messages[0]).toContain('Уточните количество и единицу для: Морковь')

    mockFindUnique.mockResolvedValue({
      stateJson: {
        type: 'awaiting_item_clarification',
        pendingItems: {
          needText: 'Лук 2кг\nМорковь-\nЧеснок 0,500',
          parsedItems: [
            { name: 'Лук', quantity: '2', unit: 'кг' },
            { name: 'Морковь', quantity: '', unit: '' },
            { name: 'Чеснок', quantity: '0.5', unit: 'кг' },
          ],
          commentsText: null,
        },
        pendingIndex: 1,
      },
    })

    const replyResult = await handleBotEvent({
      ...baseEvent,
      text: '2 кг',
    })
    expect(replyResult.messages[0]).toContain('Выберите подразделение')
    process.env.BOT_BUSINESS_ID = origEnv
  })

  it('clarification: "Айсберг салат 3 шт, груши 5" asks for unit, then "кг" yields full list', async () => {
    delete process.env.BOT_BUSINESS_ID
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
