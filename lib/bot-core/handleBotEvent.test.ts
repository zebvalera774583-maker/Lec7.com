import { describe, it, expect } from 'vitest'
import { handleBotEvent } from './handleBotEvent'

describe('handleBotEvent', () => {
  const baseEvent = {
    channel: 'telegram' as const,
    chatId: '123',
    text: '',
  }

  it('returns greeting for /start', async () => {
    const { messages } = await handleBotEvent({
      ...baseEvent,
      text: '/start',
    })
    expect(messages).toEqual([
      'Привет! Напиши потребность одним сообщением, я передам в Lec7 ✅',
    ])
  })

  it('returns greeting for /start with args', async () => {
    const { messages } = await handleBotEvent({
      ...baseEvent,
      text: '/start token123',
    })
    expect(messages).toEqual([
      'Привет! Напиши потребность одним сообщением, я передам в Lec7 ✅',
    ])
  })

  it('returns accepted for ordinary text', async () => {
    const { messages } = await handleBotEvent({
      ...baseEvent,
      text: 'яблоки 10 кг',
    })
    expect(messages).toEqual(['Принял: "яблоки 10 кг" ✅'])
  })
})
