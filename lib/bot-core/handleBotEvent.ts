import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'
import { getNextRequestNumber } from '@/lib/request-number'
import { getCatalogNormMap, matchToCatalogSyncWithNorm } from '@/lib/catalog-match'
import { recognizeNeedsForChat } from '@/lib/orchestrator/recognizeNeedsForChat'
import { notifyAdminAboutRequest } from '@/lib/notify-admin'

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
  /** Источник текста — OCR (фото заявки) */
  source?: 'ocr'
}

export interface HandleBotEventResult {
  messages: string[]
  /** Плоский массив кнопок (1 ряд) или rows для нескольких рядов */
  replyInlineKeyboard?: { buttons?: { text: string; callback_data: string }[]; rows?: { text: string; callback_data: string }[][] }
  removeKeyboard?: boolean
}

const DEPARTMENTS = [
  { slug: 'voikovo_kitchen', label: 'Войково кухня' },
  { slug: 'voikovo_bar', label: 'Войково бар' },
  { slug: 'navaginskaya_kitchen', label: 'Навагин кухня' },
  { slug: 'navaginskaya_bar', label: 'Навагин бар' },
  { slug: 'moremall_kitchen', label: 'ММ кухня' },
  { slug: 'moremall_bar', label: 'ММ бар' },
  { slug: 'konditerka', label: 'Кондитерка' },
  { slug: 'zagotovitelny', label: 'Заготовительный' },
  { slug: 'pekarnya', label: 'Пекарня' },
] as const

function departmentKeyboardRows() {
  const buttons = DEPARTMENTS.map((d) => ({ text: d.label, callback_data: `set_department|${d.slug}` }))
  const rows: { text: string; callback_data: string }[][] = []
  for (let i = 0; i < buttons.length; i += 3) {
    rows.push(buttons.slice(i, i + 3))
  }
  return rows
}

/** Парсинг "2 кг" или "1" → { quantity, unit }. Unit не подставляется по умолчанию.
 * Если item нуждается в unit (has quantity but no unit) и пользователь ввёл без unit — возвращает null. */
function parseQtyInput(
  text: string,
  itemNeedsUnit?: boolean
): { quantity: string; unit: string } | null {
  const t = (text || '').trim()
  if (!t) return null
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*([a-zа-яё]+)?$/i)
  if (!m) return null
  const quantity = m[1].replace(',', '.')
  const unit = (m[2] ?? '').toLowerCase().trim()
  if (itemNeedsUnit && !unit) return null
  return { quantity, unit }
}

/** Сообщение для уточнения item: что не хватает (qty, unit или оба) */
function clarificationMessage(
  item: { name: string; quantity: string; unit: string }
): string {
  const hasQty = !!(item.quantity ?? '').trim()
  const hasUnit = !!(item.unit ?? '').trim()
  if (!hasQty && !hasUnit) {
    return `Уточните количество и единицу для: ${item.name} (пример: 2 кг)`
  }
  if (!hasQty) {
    return `Уточните количество для: ${item.name} (пример: 2 кг)`
  }
  return `Уточните единицу для: ${item.name} (пример: 2 кг или 2 шт)`
}

/** Найти индекс первого item с пустым qty или unit */
function findNextIncompleteIndex(items: { quantity: string; unit: string }[]): number {
  for (let i = 0; i < items.length; i++) {
    const p = items[i]
    if (!(p.quantity ?? '').trim() || !(p.unit ?? '').trim()) return i
  }
  return -1
}

export async function handleBotEvent(event: BotEvent): Promise<HandleBotEventResult> {
  const { channel, chatId } = event
  const text = event.text.trim().toLowerCase()
  const choice = event.choice

  const state = await prisma.botChatState.findUnique({
    where: { channel_chatId: { channel, chatId } },
  })

  let stateData = state?.stateJson as {
    type?: string
    pendingUnit?: { needText: string; incompleteRaw: string[] }
    pendingItems?: { needText: string; parsedItems: { name: string; quantity: string; unit: string }[]; commentsText: string | null }
    pendingIndex?: number
  } | null

  // awaiting_ocr_confirm + YES → awaiting_department (выбор подразделения)
  if (choice === 'YES' && stateData?.type === 'awaiting_ocr_confirm' && stateData?.pendingItems) {
    await prisma.botChatState.update({
      where: { channel_chatId: { channel, chatId } },
      data: {
        stateJson: {
          type: 'awaiting_department',
          pendingItems: stateData.pendingItems,
        },
      },
    })
    return {
      messages: ['Выберите подразделение:'],
      replyInlineKeyboard: { rows: departmentKeyboardRows() },
    }
  }

  // awaiting_ocr_confirm + NO → сброс
  if (choice === 'NO' && stateData?.type === 'awaiting_ocr_confirm') {
    await prisma.botChatState.update({
      where: { channel_chatId: { channel, chatId } },
      data: { stateJson: { type: 'confirmed' } },
    })
    return { messages: ['Напишите заявку заново.'], removeKeyboard: true }
  }

  // awaiting_ocr_confirm + новое текстовое сообщение (не YES/NO) → сброс и обработка как новая заявка
  if (
    stateData?.type === 'awaiting_ocr_confirm' &&
    event.text.trim() &&
    choice !== 'YES' &&
    choice !== 'NO'
  ) {
    await prisma.botChatState.update({
      where: { channel_chatId: { channel, chatId } },
      data: { stateJson: { type: 'confirmed' } },
    })
    stateData = { type: 'confirmed' } as typeof stateData
  }

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
        await tx.incomingRequest.create({
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
      console.log('[handleBotEvent] request created, calling notifyAdmin', { channel, department: dept.label, number, itemsCount: parsedItems.length })
      notifyAdminAboutRequest(channel, dept.label, number, parsedItems.length).catch((e) =>
        console.warn('[handleBotEvent] notifyAdmin error:', e)
      )
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

  // Миграция: бывший awaiting_company_confirm — сразу в confirmed, обрабатываем текст как потребность
  if (stateData?.type === 'awaiting_company_confirm') {
    await prisma.botChatState.update({
      where: { channel_chatId: { channel, chatId } },
      data: { stateJson: { type: 'confirmed' } },
    })
    stateData = { type: 'confirmed' } as typeof stateData
  }

  // Миграция: awaiting_qty / awaiting_qty_other / awaiting_unit → awaiting_item_clarification
  const oldState = stateData as {
    type?: string
    pendingItems?: { needText: string; parsedItems: { name: string; quantity: string; unit: string }[]; commentsText: string | null }
    pendingIndex?: number
    pendingClarificationIndex?: number
    indicesNeedingQty?: number[]
    indicesNeedingUnit?: number[]
  }
  if (
    (oldState?.type === 'awaiting_qty' || oldState?.type === 'awaiting_qty_other' || oldState?.type === 'awaiting_unit') &&
    oldState?.pendingItems
  ) {
    const parsedItems = oldState.pendingItems.parsedItems
    const pendingIndex =
      oldState.pendingIndex ??
      oldState.pendingClarificationIndex ??
      oldState.indicesNeedingQty?.[0] ??
      oldState.indicesNeedingUnit?.[0] ??
      findNextIncompleteIndex(parsedItems)
    if (pendingIndex >= 0) {
      const migrated = {
        type: 'awaiting_item_clarification' as const,
        pendingItems: oldState.pendingItems,
        pendingIndex,
      }
      await prisma.botChatState.update({
        where: { channel_chatId: { channel, chatId } },
        data: { stateJson: migrated },
      })
      stateData = migrated as typeof stateData
    }
  }

  // Нет состояния — создаём confirmed, чтобы сразу принять потребность (без "Вы делаете заявки в компании X" Да/Нет)
  if (!state) {
    await prisma.botChatState.upsert({
      where: { channel_chatId: { channel, chatId } },
      create: { channel, chatId, stateJson: { type: 'confirmed' } },
      update: {},
    })
    stateData = { type: 'confirmed' } as typeof stateData
  }

  // awaiting_item_clarification: пользователь вводит текстом количество/единицу (например "2 кг")
  if (
    !choice &&
    event.text.trim() &&
    stateData?.type === 'awaiting_item_clarification' &&
    stateData?.pendingItems &&
    stateData?.pendingIndex != null
  ) {
    const idx = stateData.pendingIndex
    const item = stateData.pendingItems.parsedItems[idx]
    if (!item) {
      return { messages: ['Ошибка состояния. Напишите потребность заново.'] }
    }
    const itemNeedsUnit = !!(item.quantity ?? '').trim() && !(item.unit ?? '').trim()
    let parsed = parseQtyInput(event.text, itemNeedsUnit)
    if (!parsed && itemNeedsUnit && UNIT_ONLY_PATTERN.test(event.text.trim())) {
      parsed = { quantity: item.quantity, unit: event.text.trim().toLowerCase() }
    }
    if (parsed) {
      // Требуем unit от пользователя, если: 1) item.unit пуст, ИЛИ 2) item.quantity пуст
      // (эвристика могла подставить unit для "Морковь", но пользователь не указывал — нужен явный "2 кг")
      const itemNeedsUnitFromUser = !(item.unit ?? '').trim() || !(item.quantity ?? '').trim()
      if (itemNeedsUnitFromUser && !(parsed.unit ?? '').trim()) {
        return { messages: ['Уточните единицу (кг/шт/л/уп...)'] }
      }
      const { needText, parsedItems, commentsText } = stateData.pendingItems
      parsedItems[idx].quantity = parsed.quantity
      parsedItems[idx].unit = (parsed.unit ?? '').trim() || (item.unit ?? '').trim() || 'шт'
      const nextIdx = findNextIncompleteIndex(parsedItems)
      if (nextIdx < 0) {
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
          replyInlineKeyboard: { rows: departmentKeyboardRows() },
        }
      }
      const nextItem = parsedItems[nextIdx]
      await prisma.botChatState.update({
        where: { channel_chatId: { channel, chatId } },
        data: {
          stateJson: {
            type: 'awaiting_item_clarification',
            pendingItems: { needText, parsedItems, commentsText },
            pendingIndex: nextIdx,
          },
        },
      })
      return {
        messages: [clarificationMessage(nextItem)],
      }
    }
    if (itemNeedsUnit) {
      return {
        messages: ['Уточните единицу (кг/шт/л/уп...)'],
      }
    }
    return {
      messages: ['Не удалось распознать. Напишите, например: 2 кг или 1 шт'],
    }
  }

  // Уже подтвердил (или только что создали) — принимаем текст как потребность
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

    // Orchestrator: read-only распознавание (единственный источник items)
    const orchestratorSource = event.source === 'ocr' && event.channel === 'max' ? 'max_photo' : 'max_text'
    let orchestratorResult: Awaited<ReturnType<typeof recognizeNeedsForChat>> | null = null
    try {
      orchestratorResult = await recognizeNeedsForChat(chatId, needText, orchestratorSource)
    } catch (e) {
      console.warn('[handleBotEvent] Orchestrator fallback (error):', e)
    }

    if (orchestratorResult?.intent === 'create_needs' && orchestratorResult.items?.length && businessId) {
      const needsUnit = new Set(orchestratorResult.needsUnitClarification ?? [])
      const needsQty = new Set(orchestratorResult.needsQtyClarification ?? [])
      const userTypedNoDigit = !/\d/.test(needText)
      const parsedItems = orchestratorResult.items.map((r, i) => {
        let qty = r.quantity ?? ''
        let unit = r.unit || ''
        if (userTypedNoDigit || needsQty.has(i)) qty = ''
        if (userTypedNoDigit || needsUnit.has(i)) unit = ''
        return { name: r.canonicalName, quantity: qty, unit }
      })
      const commentsText = orchestratorResult.comments?.join('\n') ?? null

      // OCR: подтверждение перед созданием заявки
      if (event.source === 'ocr') {
        const itemsDisplay = parsedItems.map((p) => `${p.name} — ${p.quantity} ${p.unit}`.trim()).filter(Boolean)
        const msg = `Я распознал заявку так:\n\n${itemsDisplay.join('\n')}\n\nПодтвердить?`
        await prisma.botChatState.update({
          where: { channel_chatId: { channel, chatId } },
          data: {
            stateJson: {
              type: 'awaiting_ocr_confirm',
              pendingItems: { needText, parsedItems, commentsText },
            },
          },
        })
        return {
          messages: [msg],
          replyInlineKeyboard: {
            buttons: [
              { text: 'Да', callback_data: 'YES' },
              { text: 'Нет', callback_data: 'NO' },
            ],
          },
        }
      }

      const firstIdx = findNextIncompleteIndex(parsedItems)
      if (firstIdx >= 0) {
        const firstItem = parsedItems[firstIdx]
        await prisma.botChatState.update({
          where: { channel_chatId: { channel, chatId } },
          data: {
            stateJson: {
              type: 'awaiting_item_clarification',
              pendingItems: { needText, parsedItems, commentsText },
              pendingIndex: firstIdx,
            },
          },
        })
        return {
          messages: [clarificationMessage(firstItem)],
        }
      }

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
        replyInlineKeyboard: { rows: departmentKeyboardRows() },
      }
    }

    if (orchestratorResult?.intent === 'unknown') {
      return {
        messages: ['Напишите потребность в формате, например: яблоки 10 кг'],
      }
    }

    // Fallback: старый парсер (при сбое Orchestrator)
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
        replyInlineKeyboard: { rows: departmentKeyboardRows() },
      }
    }

    return {
      messages: [`Принял: "${needText}" ✅`],
    }
  }

  // awaiting_item_clarification + текст — напомнить уточнить позицию
  if (stateData?.type === 'awaiting_item_clarification' && stateData?.pendingItems && stateData?.pendingIndex != null) {
    const idx = stateData.pendingIndex
    const item = stateData.pendingItems.parsedItems[idx]
    if (item) {
      return {
        messages: [clarificationMessage(item)],
      }
    }
  }

  // awaiting_department + текст вместо callback — напомнить выбрать подразделение
  if (stateData?.type === 'awaiting_department') {
    return {
      messages: ['Выберите подразделение из кнопок выше.'],
      replyInlineKeyboard: { rows: departmentKeyboardRows() },
    }
  }

  return {
    messages: ['Напишите потребность, например: яблоки 10 кг, огурцы 5 кг'],
  }
}
