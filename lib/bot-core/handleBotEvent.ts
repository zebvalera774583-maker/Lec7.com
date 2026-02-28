import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'
import { getNextRequestNumber } from '@/lib/request-number'

/** Парсинг "яблоки 10 кг" → { name, quantity, unit } */
function parseNeedText(text: string): { name: string; quantity: string; unit: string } {
  const trimmed = text.trim()
  if (!trimmed) return { name: trimmed, quantity: '1', unit: 'шт' }
  const match = trimmed.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([\p{L}]+)?$/u)
  if (match) {
    const [, name, qty, unit] = match
    const quantity = (qty ?? '1').replace(',', '.')
    return { name: (name ?? trimmed).trim(), quantity, unit: (unit ?? 'шт').trim() }
  }
  return { name: trimmed, quantity: '1', unit: 'шт' }
}

export interface BotEvent {
  channel: 'telegram' | 'max'
  chatId: string
  userId?: string
  username?: string
  text: string
  raw?: unknown
  /** Выбор из InlineKeyboard (callback): "YES" | "NO" */
  choice?: 'YES' | 'NO'
}

export interface HandleBotEventResult {
  messages: string[]
  replyInlineKeyboard?: { buttons: { text: string; callback_data: string }[] }
  removeKeyboard?: boolean
}

const COMPANY_NAME = process.env.BOT_COMPANY_NAME || 'Блины Юга'

export async function handleBotEvent(event: BotEvent): Promise<HandleBotEventResult> {
  const { channel, chatId } = event
  const text = event.text.trim().toLowerCase()
  const choice = event.choice
  const isYes = choice === 'YES' || text === 'да'
  const isNo = choice === 'NO' || text === 'нет'

  const state = await prisma.botChatState.findUnique({
    where: { channel_chatId: { channel, chatId } },
  })

  const stateData = state?.stateJson as { type?: string } | null

  // Ожидание подтверждения компании
  if (stateData?.type === 'awaiting_company_confirm') {
    if (isYes) {
      await prisma.botChatState.update({
        where: { channel_chatId: { channel, chatId } },
        data: { stateJson: { type: 'confirmed' } },
      })
      return {
        messages: ['Принято. Напишите потребность одним сообщением.'],
        removeKeyboard: true,
      }
    }
    if (isNo) {
      return {
        messages: ['Обратитесь к администратору для смены компании.'],
        removeKeyboard: true,
      }
    }
    return {
      messages: ['Нажмите Да или Нет'],
    }
  }

  // Уже подтвердил — принимаем текст как потребность
  if (stateData?.type === 'confirmed') {
    const needText = event.text.trim()
    const businessId = process.env.BOT_BUSINESS_ID?.trim()

    if (businessId && needText) {
      try {
        const { number } = await prisma.$transaction(async (tx) => {
          const num = await getNextRequestNumber(tx)
          const request = await tx.request.create({
            data: {
              businessId,
              number: num,
              title: `Заявка из MAX: ${needText.slice(0, 80) || 'Новое сообщение'}`,
              description: needText,
              source: 'max_integration',
              status: 'NEW',
            },
          })

          const parsed = parseNeedText(needText)
          await tx.incomingRequest.create({
            data: {
              senderBusinessId: businessId,
              recipientBusinessId: businessId,
              requestId: request.id,
              status: 'NEW',
              updatedAt: new Date(),
              items: {
                create: {
                  name: parsed.name,
                  quantity: parsed.quantity,
                  unit: parsed.unit,
                  price: new Decimal(0),
                  sum: new Decimal(0),
                  sortOrder: 0,
                },
              },
            },
          })

          return { number: num }
        })
        return {
          messages: [`Номер заявки: ${number}`],
        }
      } catch (e) {
        console.error('[handleBotEvent] create request error:', e)
      }
    }

    return {
      messages: [`Принял: "${needText}" ✅`],
    }
  }

  // Первое сообщение — показать подтверждение компании
  const companyMessage = `Вы делаете заявки в компании ${COMPANY_NAME}`
  await prisma.botChatState.upsert({
    where: { channel_chatId: { channel, chatId } },
    create: {
      channel,
      chatId,
      stateJson: { type: 'awaiting_company_confirm' },
    },
    update: {
      stateJson: { type: 'awaiting_company_confirm' },
    },
  })

  return {
    messages: [companyMessage],
    replyInlineKeyboard: {
      buttons: [
        { text: 'Да', callback_data: 'YES' },
        { text: 'Нет', callback_data: 'NO' },
      ],
    },
  }
}
