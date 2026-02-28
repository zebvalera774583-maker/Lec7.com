import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'
import { getNextRequestNumber } from '@/lib/request-number'

const NON_NEED_PATTERNS = /^(привет|старт|ок|hello|hi|здравствуй|хай|да|нет|пока|bye|спасибо|благодарю)$/i

/** Является ли текст "не-потребностью" (приветствие и т.п.) — не создаём заявку */
function isNonNeed(text: string): boolean {
  const t = text.trim().toLowerCase()
  return !t || NON_NEED_PATTERNS.test(t)
}

const NEED_FORMAT_REGEX = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([\p{L}]+)?$/u
const UNIT_PATTERN = /(?:^|\s)(\d+(?:[.,]\d+)?)\s*([\p{L}]{1,10})$/u

/** Разбивает текст на позиции: по переносу, запятой, " и "; или по границе "наименование число" (новая позиция) */
function splitIntoItems(text: string): string[] {
  const byDelim = text.split(/[\n,;]|\s+и\s+/i).map((s) => s.trim()).filter(Boolean)
  const result: string[] = []
  for (const part of byDelim) {
    const items = part.split(/\s+(?=[\p{L}]+\s+\d)/u).map((s) => s.trim()).filter(Boolean)
    result.push(...items)
  }
  return result.length > 0 ? result : [text.trim()].filter(Boolean)
}

/** Парсинг одной позиции "яблоки 10 кг" → { name, quantity, unit, hasUnit } */
function parseOneItem(text: string): { name: string; quantity: string; unit: string; hasUnit: boolean } {
  const trimmed = text.trim()
  if (!trimmed) return { name: '', quantity: '1', unit: 'шт', hasUnit: false }
  const match = trimmed.match(NEED_FORMAT_REGEX)
  if (match) {
    const [, name, qty, unit] = match
    const quantity = (qty ?? '1').replace(',', '.')
    const unitVal = (unit ?? '').trim()
    return {
      name: (name ?? trimmed).trim(),
      quantity,
      unit: unitVal || 'шт',
      hasUnit: unitVal.length > 0,
    }
  }
  return { name: trimmed, quantity: '1', unit: 'шт', hasUnit: false }
}

/** Проверка одной позиции: есть ли вес и ед. изм. */
function isItemComplete(item: { hasUnit: boolean }): boolean {
  return item.hasUnit
}

/** Позиции с недостающими полями: onlyUnit = true если есть вес, но нет ед.изм. */
function getIncompleteItems(text: string): { displayName: string; onlyUnitMissing: boolean }[] {
  const items = splitIntoItems(text)
  const result: { displayName: string; onlyUnitMissing: boolean }[] = []
  for (const raw of items) {
    const parsed = parseOneItem(raw)
    if (!parsed.name || isItemComplete(parsed)) continue
    const displayName = parsed.name.charAt(0).toUpperCase() + parsed.name.slice(1).toLowerCase()
    const hasWeight = /\d/.test(raw)
    result.push({ displayName, onlyUnitMissing: hasWeight })
  }
  return result
}

/** Проверка: все ли позиции имеют вес и ед. изм. */
function areAllItemsValid(text: string): boolean {
  const items = splitIntoItems(text)
  if (items.length === 0) return false
  for (const raw of items) {
    const parsed = parseOneItem(raw)
    if (!parsed.name || !isItemComplete(parsed)) return false
  }
  return true
}

/** Возвращает список недостающих полей для одной позиции (если одна) */
function getMissingNeedFields(text: string): string[] {
  const t = text.trim()
  if (!t) return ['наименование', 'количество', 'единица измерения'];
  if (NEED_FORMAT_REGEX.test(t)) return [];
  const hasNumber = /\d/.test(t);
  const hasUnit = UNIT_PATTERN.test(t);
  const hasName = !/^\d/.test(t) && /[\p{L}]/u.test(t);
  const missing: string[] = [];
  if (!hasName) missing.push('наименование');
  if (!hasNumber) missing.push('количество');
  if (!hasUnit) missing.push('единица измерения');
  return missing;
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

    if (isNonNeed(needText)) {
      return {
        messages: ['Напишите потребность в формате, например: яблоки 10 кг'],
      }
    }

    const items = splitIntoItems(needText)
    const incomplete = getIncompleteItems(needText)

    if (incomplete.length > 0) {
      const onlyUnit = incomplete.filter((i) => i.onlyUnitMissing).map((i) => i.displayName)
      const needBoth = incomplete.filter((i) => !i.onlyUnitMissing).map((i) => i.displayName)
      const parts: string[] = []
      if (onlyUnit.length > 0) parts.push(`Укажите ед. изм. для: ${onlyUnit.join(', ')}`)
      if (needBoth.length > 0) parts.push(`Укажите вес и ед. изм. для: ${needBoth.join(', ')}`)
      return {
        messages: [parts.join('. ')],
      }
    }

    if (!areAllItemsValid(needText)) {
      const missing = getMissingNeedFields(needText)
      const missingStr = missing.length > 0 ? `Не указано: ${missing.join(', ')}. ` : ''
      return {
        messages: [
          `${missingStr}Формат: наименование количество ед.изм. Например: яблоки 10 кг`,
        ],
      }
    }

    if (businessId && needText) {
      try {
        const parsedItems = items.map((raw) => parseOneItem(raw))
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

          const incoming = await tx.incomingRequest.create({
            data: {
              senderBusinessId: businessId,
              recipientBusinessId: businessId,
              requestId: request.id,
              status: 'NEW',
              items: {
                create: parsedItems.map((p, i) => ({
                  name: p.name,
                  quantity: p.quantity,
                  unit: p.unit,
                  price: new Decimal(0),
                  sum: new Decimal(0),
                  sortOrder: i,
                })),
              },
            },
            include: { items: true },
          })
          console.log(
            `[handleBotEvent] Request+IncomingRequest+Items created: requestId=${request.id} incomingId=${incoming.id} items=${incoming.items.length}`
          )
          return { number: num }
        })
        return {
          messages: [`Заявка принята. Номер заявки: ${number}`],
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
