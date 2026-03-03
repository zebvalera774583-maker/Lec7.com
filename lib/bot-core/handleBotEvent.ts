import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'
import { getNextRequestNumber } from '@/lib/request-number'
import { getCatalogNormMap, matchToCatalogSyncWithNorm } from '@/lib/catalog-match'

const NON_NEED_PATTERNS = /^(привет|старт|ок|hello|hi|здравствуй|хай|да|нет|пока|bye|спасибо|благодарю)$/i
const UNIT_ONLY_PATTERN = /^(кг|г|гр|т|шт\.?|л|мл|уп|упак|кор|меш|ящ|пак|бан|мешок|короб|ящик|бутыл|бутылка|kg)$/iu

/** Split at space after "number unit" when followed by letter (next item). Keeps "1 кг" with preceding name. */
const UNIT_FOR_SPLIT =
  /(?<=\d+(?:[.,]\d+)?\s*(?:шт\.?|кг|гр|г|л|мл|т|уп|упак|кор|меш|ящ|пак|бан|мешок|короб|ящик|бутыл|бутылка|kg))\s+(?=[\p{L}])/iu

/** Является ли текст "не-потребностью" (приветствие и т.п.) — не создаём заявку */
function isNonNeed(text: string): boolean {
  const t = text.trim().toLowerCase()
  return !t || NON_NEED_PATTERNS.test(t)
}

/** name + number + optional unit. Unit can include period (шт.) */
const NEED_FORMAT_REGEX = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([\p{L}.]+)?$/u
const UNIT_PATTERN = /(?:^|\s)(\d+(?:[.,]\d+)?)\s*([\p{L}.]{1,10})$/u

/**
 * Split text into items. Delimiters: newline, ";", " и ", comma (but NOT comma between digits, e.g. "0,5").
 * Within a segment: split by "number unit + space + start of next product" (e.g. "5 кг груши")
 * so "Айсберг салат 3 шт" stays as one item (unit must follow number; "г" in "Айсберг" is not a unit).
 */
export function splitIntoItems(text: string): string[] {
  const byDelim = text.split(/[\n;]|\s+и\s+|(?<!\d),(?!\d)/i).map((s) => s.trim()).filter(Boolean)
  const result: string[] = []
  for (const part of byDelim) {
    const items = part.split(UNIT_FOR_SPLIT).map((s) => s.trim()).filter(Boolean)
    result.push(...items)
  }
  return result.length > 0 ? result : [text.trim()].filter(Boolean)
}

/** Parse one item "яблоки 10 кг" or "Айсберг салат 3 шт" → { name, quantity, unit, hasUnit } */
export function parseOneItem(text: string): { name: string; quantity: string; unit: string; hasUnit: boolean } {
  const trimmed = text.trim()
  if (!trimmed) return { name: '', quantity: '1', unit: 'шт', hasUnit: false }
  const match = trimmed.match(NEED_FORMAT_REGEX)
  if (match) {
    const [, name, qty, unit] = match
    const quantity = (qty ?? '1').replace(',', '.')
    const unitVal = (unit ?? '').trim().replace(/\.$/, '') || ''
    return {
      name: (name ?? trimmed).trim().replace(/\s+/g, ' '),
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
  /** Выбор из InlineKeyboard (callback): "YES" | "NO" | "set_department|<slug>" */
  choice?: string
}

export interface HandleBotEventResult {
  messages: string[]
  /** Плоский массив кнопок (1 ряд) или rows для нескольких рядов */
  replyInlineKeyboard?: { buttons?: { text: string; callback_data: string }[]; rows?: { text: string; callback_data: string }[][] }
  removeKeyboard?: boolean
}

const COMPANY_NAME = process.env.BOT_COMPANY_NAME || 'Блины Юга'

const DEPARTMENTS = [
  { slug: 'voikovo_kitchen', label: 'Войково кухня' },
  { slug: 'voikovo_bar', label: 'Войково бар' },
  { slug: 'navaginskaya_kitchen', label: 'Навагинская кухня' },
  { slug: 'navaginskaya_bar', label: 'Навагинская бар' },
  { slug: 'moremall_kitchen', label: 'МореМолл кухня' },
  { slug: 'moremall_bar', label: 'МореМолл бар' },
] as const

export async function handleBotEvent(event: BotEvent): Promise<HandleBotEventResult> {
  const { channel, chatId } = event
  const text = event.text.trim().toLowerCase()
  const choice = event.choice
  const isYes = choice === 'YES' || text === 'да'
  const isNo = choice === 'NO' || text === 'нет'

  const state = await prisma.botChatState.findUnique({
    where: { channel_chatId: { channel, chatId } },
  })

  const stateData = state?.stateJson as {
    type?: string
    pendingUnit?: { needText: string; incompleteRaw: string[] }
    pendingItems?: { needText: string; parsedItems: { name: string; quantity: string; unit: string }[]; commentsText: string | null }
  } | null

  // Обработка выбора подразделения (callback set_department|<slug>)
  const setDeptMatch = typeof choice === 'string' ? choice.match(/^set_department\|([a-z_]+)$/) : null
  if (setDeptMatch && stateData?.type === 'awaiting_department' && stateData?.pendingItems) {
    const slug = setDeptMatch[1]
    const dept = DEPARTMENTS.find((d) => d.slug === slug)
    if (!dept) {
      return { messages: ['Неизвестное подразделение. Выберите из списка.'] }
    }
    const { needText, parsedItems, commentsText } = stateData.pendingItems
    const businessId = process.env.BOT_BUSINESS_ID?.trim()
    if (!businessId) {
      await prisma.botChatState.update({
        where: { channel_chatId: { channel, chatId } },
        data: { stateJson: { type: 'confirmed' } },
      })
      return { messages: ['Ошибка: BOT_BUSINESS_ID не настроен'], removeKeyboard: true }
    }
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
        const incoming = await tx.incomingRequest.create({
          data: {
            senderBusinessId: businessId,
            recipientBusinessId: businessId,
            requestId: request.id,
            status: 'NEW',
            commentsText,
            department: slug,
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
        return { number: num }
      })
      await prisma.botChatState.update({
        where: { channel_chatId: { channel, chatId } },
        data: { stateJson: { type: 'confirmed' } },
      })
      return {
        messages: [`Ок, подразделение: ${dept.label}. Заявка принята. Номер заявки: ${number}`],
        removeKeyboard: true,
      }
    } catch (e) {
      console.error('[handleBotEvent] create request (department) error:', e)
      return { messages: ['Ошибка при создании заявки. Попробуйте ещё раз.'], removeKeyboard: true }
    }
  }

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
    let needText = event.text.trim()
    const businessId = process.env.BOT_BUSINESS_ID?.trim()

    const pendingUnit = stateData?.pendingUnit
    const unitInput = needText.toLowerCase().trim()

    if (pendingUnit?.needText && pendingUnit?.incompleteRaw?.length && UNIT_ONLY_PATTERN.test(unitInput)) {
      const unit = unitInput.trim()
      let combined = pendingUnit.needText
      for (const raw of pendingUnit.incompleteRaw) {
        combined = combined.replace(raw, `${raw} ${unit}`)
      }
      needText = combined
      await prisma.botChatState.update({
        where: { channel_chatId: { channel, chatId } },
        data: { stateJson: { type: 'confirmed' } },
      })
      console.log('[handleBotEvent] pendingUnit applied:', { unit, combined: combined.slice(0, 80) })
    }

    if (isNonNeed(needText)) {
      return {
        messages: ['Напишите потребность в формате, например: яблоки 10 кг'],
      }
    }

    const rawItems = splitIntoItems(needText)
    let normToId: Map<string, string>
    try {
      normToId = await getCatalogNormMap()
    } catch (e) {
      console.warn('[handleBotEvent] catalog load failed, treating all as items:', e)
      normToId = new Map()
    }

    const mappedItems: { raw: string; canonical: string }[] = []
    const unmappedRaw: string[] = []
    for (const raw of rawItems) {
      const parsed = parseOneItem(raw)
      if (!parsed.name) continue
      const canonical = matchToCatalogSyncWithNorm(normToId, parsed.name)
      if (canonical) {
        mappedItems.push({ raw, canonical })
      } else {
        unmappedRaw.push(raw)
      }
    }

    const mappedNeedText = mappedItems.map((m) => m.raw).join(', ')
    const incomplete = mappedItems.length > 0 ? getIncompleteItems(mappedNeedText) : []

    if (incomplete.length > 0) {
      const onlyUnit = incomplete.filter((i) => i.onlyUnitMissing).map((i) => i.displayName)
      const needBoth = incomplete.filter((i) => !i.onlyUnitMissing).map((i) => i.displayName)
      const parts: string[] = []
      if (onlyUnit.length > 0) parts.push(`Укажите ед. изм. для: ${onlyUnit.join(', ')}`)
      if (needBoth.length > 0) parts.push(`Укажите вес и ед. изм. для: ${needBoth.join(', ')}`)

      const incompleteRaw = onlyUnit.length > 0
        ? mappedItems
            .filter((m) => {
              const p = parseOneItem(m.raw)
              return p.name && !isItemComplete(p) && /\d/.test(m.raw)
            })
            .map((m) => m.raw)
        : []
      await prisma.botChatState.update({
        where: { channel_chatId: { channel, chatId } },
        data: {
          stateJson:
            incompleteRaw.length > 0
              ? { type: 'confirmed', pendingUnit: { needText, incompleteRaw } }
              : { type: 'confirmed' },
        },
      })

      return {
        messages: [parts.join('. ')],
      }
    }

    if (mappedItems.length > 0 && !areAllItemsValid(mappedNeedText)) {
      const missing = getMissingNeedFields(mappedNeedText)
      const missingStr = missing.length > 0 ? `Не указано: ${missing.join(', ')}. ` : ''
      return {
        messages: [
          `${missingStr}Формат: наименование количество ед.изм. Например: яблоки 10 кг`,
        ],
      }
    }

    if (businessId && needText) {
      const parsedItems = mappedItems.map(({ raw, canonical }) => {
        const p = parseOneItem(raw)
        return { ...p, name: canonical }
      })
      const commentsText =
        unmappedRaw.length > 0 ? unmappedRaw.map((s) => s.trim()).filter(Boolean).join('\n') : null

      await prisma.botChatState.update({
        where: { channel_chatId: { channel, chatId } },
        data: {
          stateJson: {
            type: 'awaiting_department',
            pendingItems: { needText, parsedItems, commentsText },
          },
        },
      })
      return {
        messages: ['Выберите подразделение:'],
        replyInlineKeyboard: {
          rows: [
            [
              { text: 'Войково кухня', callback_data: 'set_department|voikovo_kitchen' },
              { text: 'Войково бар', callback_data: 'set_department|voikovo_bar' },
            ],
            [
              { text: 'Навагинская кухня', callback_data: 'set_department|navaginskaya_kitchen' },
              { text: 'Навагинская бар', callback_data: 'set_department|navaginskaya_bar' },
            ],
            [
              { text: 'МореМолл кухня', callback_data: 'set_department|moremall_kitchen' },
              { text: 'МореМолл бар', callback_data: 'set_department|moremall_bar' },
            ],
          ],
        },
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
