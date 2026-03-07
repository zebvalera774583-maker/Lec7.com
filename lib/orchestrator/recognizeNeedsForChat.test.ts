import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recognizeNeedsForChat, getBusinessIdByChatId } from './recognizeNeedsForChat'

const mockRecognizeOrderWithAI = vi.fn()
vi.mock('@/lib/ai/recognizeOrderWithAI', () => ({
  recognizeOrderWithAI: (...args: unknown[]) => mockRecognizeOrderWithAI(...args),
}))

const mockFindUnique = vi.fn()
const mockFindFirst = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    maxChatContext: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    businessTelegramRecipient: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    botCatalogItem: { findMany: vi.fn().mockResolvedValue([]) },
    botLearnedAlias: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

describe('recognizeNeedsForChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('BOT_BUSINESS_ID', 'biz-1')
    mockFindUnique.mockResolvedValue(null)
    mockFindFirst.mockResolvedValue(null)
  })

  it('AI success with items → create_needs', async () => {
    mockRecognizeOrderWithAI.mockResolvedValue([
      { name: 'Картофель', quantity: '10', unit: 'кг' },
      { name: 'Морковь', quantity: '2', unit: 'кг' },
    ])

    const result = await recognizeNeedsForChat('chat-1', 'картошка 10 кг морковь 2 кг')

    expect(mockRecognizeOrderWithAI).toHaveBeenCalledWith('картошка 10 кг морковь 2 кг')
    expect(result.intent).toBe('create_needs')
    expect(result.items).toBeDefined()
    expect(Array.isArray(result.items)).toBe(true)
  })

  it('AI empty items → intent unknown (no fallback)', async () => {
    mockRecognizeOrderWithAI.mockResolvedValue([])

    const result = await recognizeNeedsForChat('chat-1', 'какой-то мусор')

    expect(result.intent).toBe('unknown')
    expect(result.items).toBeUndefined()
  })

  it('AI technical error → fallback to local pipeline', async () => {
    mockRecognizeOrderWithAI.mockRejectedValue(new Error('Gateway timeout'))

    const result = await recognizeNeedsForChat('chat-1', 'Морковь 2 кг')

    expect(mockRecognizeOrderWithAI).toHaveBeenCalled()
    expect(['create_needs', 'unknown']).toContain(result.intent)
  })

  it('no businessId → unknown', async () => {
    vi.stubEnv('BOT_BUSINESS_ID', '')
    mockFindUnique.mockResolvedValue(null)
    mockFindFirst.mockResolvedValue(null)

    const result = await recognizeNeedsForChat('chat-1', 'картошка 10')

    expect(result.intent).toBe('unknown')
    expect(mockRecognizeOrderWithAI).not.toHaveBeenCalled()
  })
})

describe('getBusinessIdByChatId', () => {
  it('returns from MaxChatContext', async () => {
    mockFindUnique.mockResolvedValue({ businessId: 'max-biz' })
    mockFindFirst.mockResolvedValue(null)

    const id = await getBusinessIdByChatId('chat-1')
    expect(id).toBe('max-biz')
  })

  it('returns from BusinessTelegramRecipient', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockFindFirst.mockResolvedValue({ businessId: 'tg-biz' })

    const id = await getBusinessIdByChatId('chat-1')
    expect(id).toBe('tg-biz')
  })

  it('returns BOT_BUSINESS_ID when no context', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockFindFirst.mockResolvedValue(null)
    vi.stubEnv('BOT_BUSINESS_ID', 'fallback-biz')

    const id = await getBusinessIdByChatId('chat-1')
    expect(id).toBe('fallback-biz')
  })
})
