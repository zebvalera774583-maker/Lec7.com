import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseLineItemsFromText, normalizeUnitInput } from '@/lib/max/parser'
import { getNextRequestNumber } from '@/lib/request-number'
import { createHash } from 'crypto'
import { Decimal } from '@prisma/client/runtime/library'
import type { PrismaClient } from '@prisma/client'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

/** GUARD: only call when status is READY (all items have unit). Creates IncomingRequest for "Поступившие заявки". */
async function ensureIncomingRequestForMax(
  tx: Tx,
  requestId: string,
  businessId: string,
  items: { title: string; qty: string; unit?: string }[]
): Promise<void> {
  const zero = new Decimal(0)
  const itemsWithUnit = items.map((i) => ({ ...i, unit: i.unit || 'шт' }))
  await tx.incomingRequest.upsert({
    where: { requestId },
    create: {
      requestId,
      senderBusinessId: businessId,
      recipientBusinessId: businessId,
      status: 'NEW',
      items: {
        create: itemsWithUnit.map((it, idx) => ({
          name: it.title,
          quantity: it.qty,
          unit: it.unit,
          price: zero,
          sum: zero,
          sortOrder: idx,
        })),
      },
    },
    update: { updatedAt: new Date() },
  })
}

function formatReadyReply(number: number): string {
  return `Спасибо, заявка принята. Номер вашей заявки: №${number}.`
}

const SECRET_HEADER = 'x-lec7-max-secret'
const BRANCH_COMMANDS = ['/branch', 'branch', 'сменить']

const RESET_COMMANDS = ['/reset', 'reset', 'сброс', 'отмена', 'очистить']
const RESET_WITH_BRANCH = ['/reset branch', 'reset branch', 'сброс подразделение', 'сброс branch', 'отмена подразделение', 'очистить подразделение']

function buildBranchMenu(businesses: { slug: string }[]): string {
  if (businesses.length === 0) return 'Нет доступных подразделений.'
  return `Выберите подразделение (ответьте slug):\n${businesses.map((b) => `- ${b.slug}`).join('\n')}`
}

function computeIdempotencyKey(eventId: string | null, chatId: string, text: string): string {
  if (eventId) return eventId
  const timeBucket = Math.floor(Date.now() / 60000)
  const hash = createHash('sha256').update(`${chatId}|${text}|${timeBucket}`).digest('hex')
  return hash.slice(0, 32)
}

/** Find active (non-ARCHIVED) link for conversation, most recent first. */
async function findActiveLink(tx: Tx, conversationId: string) {
  return tx.maxRequestLink.findFirst({
    where: {
      maxConversationId: conversationId,
      status: { not: 'ARCHIVED' },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.LEC7_MAX_SECRET
  if (expectedSecret) {
    const incoming = req.headers.get(SECRET_HEADER)
    if (incoming !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: { chatId?: unknown; userId?: unknown; text?: string; messageId?: unknown; ts?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const chatId = body?.chatId != null ? String(body.chatId) : null
  const text = typeof body?.text === 'string' ? body.text : ''
  const eventId = body?.messageId != null ? String(body.messageId) : null

  if (!chatId) {
    return NextResponse.json({ replyText: 'Ошибка: chatId отсутствует' })
  }

  const textTrim = text.trim().toLowerCase()

  if (BRANCH_COMMANDS.includes(textTrim)) {
    await prisma.maxChatContext.deleteMany({ where: { chatId } })
    const businesses = await prisma.business.findMany({
      select: { slug: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return NextResponse.json({ replyText: buildBranchMenu(businesses) })
  }

  const context = await prisma.maxChatContext.findUnique({
    where: { chatId },
    select: { businessId: true },
  })

  if (!context) {
    const businessBySlug = await prisma.business.findFirst({
      where: { slug: textTrim },
      select: { id: true, slug: true },
    })
    if (businessBySlug) {
      await prisma.maxChatContext.create({
        data: { chatId, businessId: businessBySlug.id },
      })
      return NextResponse.json({
        replyText: `Ок. Подразделение выбрано: ${businessBySlug.slug}. Теперь напишите заявку.`,
      })
    }
    const businesses = await prisma.business.findMany({
      select: { slug: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return NextResponse.json({
      replyText: textTrim
        ? `Не найдено. Ответьте одним из slug:\n${businesses.map((b) => `- ${b.slug}`).join('\n')}`
        : buildBranchMenu(businesses),
    })
  }

  const businessId = context.businessId
  const idempotencyKey = computeIdempotencyKey(eventId, chatId, text)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const conversation = await tx.maxConversation.upsert({
        where: {
          businessId_externalChatId: { businessId, externalChatId: chatId },
        },
        create: { businessId, externalChatId: chatId },
        update: {},
      })

      // Idempotency: must be first. On P2002 return immediately, no business logic.
      try {
        await tx.maxMessage.create({
          data: {
            conversationId: conversation.id,
            direction: 'IN',
            idempotencyKey,
            text,
          },
        })
      } catch (e: unknown) {
        if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
          return { replyText: null, skipReply: true }
        }
        throw e
      }

      let replyText: string
      const link = await findActiveLink(tx, conversation.id)

      const isResetWithBranch = RESET_WITH_BRANCH.includes(textTrim)
      const isResetCommand = RESET_COMMANDS.includes(textTrim) || isResetWithBranch

      if (isResetCommand) {
        if (link) {
          await tx.maxRequestLink.updateMany({
            where: {
              maxConversationId: conversation.id,
              status: { not: 'ARCHIVED' },
            },
            data: { status: 'ARCHIVED' },
          })
        }
        if (isResetWithBranch) {
          await tx.maxChatContext.deleteMany({ where: { chatId } })
          replyText = link
            ? 'Черновик и подразделение сброшены. Выберите slug.'
            : 'Подразделение сброшено. Выберите slug.'
        } else {
          replyText = link
            ? 'Черновик заявки сброшен. Напишите заявку заново.'
            : 'Черновик заявки отсутствует. Напишите заявку.'
        }
        await tx.maxMessage.create({
          data: {
            conversationId: conversation.id,
            direction: 'OUT',
            idempotencyKey: `out-${idempotencyKey}`,
            text: replyText,
          },
        })
        return { replyText }
      }

      if (!link) {
        // First message: no active link
        const items = parseLineItemsFromText(text)
        if (items.length === 0) {
          replyText = 'Напишите товар и количество. Пример: яблоки 10 кг.'
          await tx.maxMessage.create({
            data: {
              conversationId: conversation.id,
              direction: 'OUT',
              idempotencyKey: `out-${idempotencyKey}`,
              text: replyText,
            },
          })
          return { replyText }
        }

        const hasMissingUnit = items.some((i) => !i.unit)
        // GUARD: NEED_DETAILS — never create Request, number, or IncomingRequest
        if (hasMissingUnit) {
          const missingItems = items.filter((i) => !i.unit)
          const list = missingItems.map((i) => `${i.title} — ${i.qty}`).join('\n')
          replyText = `Напишите единицу измерения для позиций:\n${list}\n\nНапример: кг, шт, л, мл, г, уп.`
          await tx.maxRequestLink.create({
            data: {
              maxConversationId: conversation.id,
              requestId: null,
              status: 'NEED_DETAILS',
              itemsJson: JSON.parse(JSON.stringify(items)),
            },
          })
          await tx.maxMessage.create({
            data: {
              conversationId: conversation.id,
              direction: 'OUT',
              idempotencyKey: `out-${idempotencyKey}`,
              text: replyText,
            },
          })
          return { replyText }
        }

        // READY: all units present — create Request + number + IncomingRequest atomically
        const title = items.map((i) => `${i.title} ${i.qty} ${i.unit || '?'}`).join(', ')
        const description = items.map((i) => `${i.title} ${i.qty}${i.unit ? ` ${i.unit}` : ''}`.trim()).join(' ')
        const requestNumber = await getNextRequestNumber(tx)
        const request = await tx.request.create({
          data: {
            businessId,
            number: requestNumber,
            title: `Заявка из MAX: ${title.slice(0, 80)}`,
            description,
            source: 'max_integration',
            status: 'NEW',
          },
        })
        await tx.maxRequestLink.create({
          data: {
            maxConversationId: conversation.id,
            requestId: request.id,
            status: 'READY',
            itemsJson: JSON.parse(JSON.stringify(items)),
          },
        })
        await ensureIncomingRequestForMax(tx, request.id, businessId, items)
        replyText = formatReadyReply(requestNumber)
        await tx.maxMessage.create({
          data: {
            conversationId: conversation.id,
            direction: 'OUT',
            idempotencyKey: `out-${idempotencyKey}`,
            text: replyText,
          },
        })
        return { replyText }
      }

      if (link.status === 'NEED_DETAILS') {
        const unit = normalizeUnitInput(text)
        const newItems = parseLineItemsFromText(text)

        // New list (overwrites draft) vs unit
        if (newItems.length > 0 && newItems.some((i) => i.title && i.qty)) {
          // Text parsed as line items — new draft, archive old link
          await tx.maxRequestLink.update({
            where: { id: link.id },
            data: { status: 'ARCHIVED' },
          })
          const hasMissingUnit = newItems.some((i) => !i.unit)
          if (hasMissingUnit) {
            const missingItems = newItems.filter((i) => !i.unit)
            const list = missingItems.map((i) => `${i.title} — ${i.qty}`).join('\n')
            replyText = `Напишите единицу измерения для позиций:\n${list}\n\nНапример: кг, шт, л, мл, г, уп.`
            await tx.maxRequestLink.create({
              data: {
                maxConversationId: conversation.id,
                requestId: null,
                status: 'NEED_DETAILS',
                itemsJson: JSON.parse(JSON.stringify(newItems)),
              },
            })
          } else {
            const requestNumber = await getNextRequestNumber(tx)
            const title = newItems.map((i) => `${i.title} ${i.qty} ${i.unit || '?'}`).join(', ')
            const description = newItems.map((i) => `${i.title} ${i.qty}${i.unit ? ` ${i.unit}` : ''}`.trim()).join(' ')
            const request = await tx.request.create({
              data: {
                businessId,
                number: requestNumber,
                title: `Заявка из MAX: ${title.slice(0, 80)}`,
                description,
                source: 'max_integration',
                status: 'NEW',
              },
            })
            await tx.maxRequestLink.create({
              data: {
                maxConversationId: conversation.id,
                requestId: request.id,
                status: 'READY',
                itemsJson: JSON.parse(JSON.stringify(newItems)),
              },
            })
            await ensureIncomingRequestForMax(tx, request.id, businessId, newItems)
            replyText = formatReadyReply(requestNumber)
          }
        } else if (unit) {
          // Unit provided — apply to current items
          const items = (link.itemsJson as { title: string; qty: string; unit?: string }[]) || []
          const updated = items.map((i) => ({
            ...i,
            unit: i.unit || unit,
          }))
          const allFilled = updated.every((i) => i.unit)
          await tx.maxRequestLink.update({
            where: { id: link.id },
            data: {
              itemsJson: JSON.parse(JSON.stringify(updated)),
              status: allFilled ? 'READY' : 'NEED_DETAILS',
            },
          })
          if (allFilled) {
            // NEED_DETAILS → READY: create Request + number + IncomingRequest atomically
            const requestNumber = await getNextRequestNumber(tx)
            const title = updated.map((i) => `${i.title} ${i.qty} ${i.unit || '?'}`).join(', ')
            const description = updated.map((i) => `${i.title} ${i.qty}${i.unit ? ` ${i.unit}` : ''}`.trim()).join(' ')
            const request = await tx.request.create({
              data: {
                businessId,
                number: requestNumber,
                title: `Заявка из MAX: ${title.slice(0, 80)}`,
                description,
                source: 'max_integration',
                status: 'NEW',
              },
            })
            await tx.maxRequestLink.update({
              where: { id: link.id },
              data: { requestId: request.id },
            })
            await ensureIncomingRequestForMax(tx, request.id, businessId, updated)
            replyText = formatReadyReply(requestNumber)
          } else {
            const missingItems = updated.filter((i) => !i.unit)
            const list = missingItems.map((i) => `${i.title} — ${i.qty}`).join('\n')
            replyText = `Напишите единицу измерения для позиций:\n${list}\n\nНапример: кг, шт, л, мл, г, уп.`
          }
        } else {
          replyText = 'Напишите единицу измерения. Например: кг, шт, л, мл, г, уп.'
        }
      } else {
        // READY or DRAFT: new message = new request. Archive old link, create new.
        await tx.maxRequestLink.update({
          where: { id: link.id },
          data: { status: 'ARCHIVED' },
        })
        const items = parseLineItemsFromText(text)
        if (items.length === 0) {
          replyText = 'Напишите товар и количество. Пример: яблоки 10 кг.'
        } else {
          const hasMissingUnit = items.some((i) => !i.unit)
          if (hasMissingUnit) {
            const missingItems = items.filter((i) => !i.unit)
            const list = missingItems.map((i) => `${i.title} — ${i.qty}`).join('\n')
            replyText = `Напишите единицу измерения для позиций:\n${list}\n\nНапример: кг, шт, л, мл, г, уп.`
            await tx.maxRequestLink.create({
              data: {
                maxConversationId: conversation.id,
                requestId: null,
                status: 'NEED_DETAILS',
                itemsJson: JSON.parse(JSON.stringify(items)),
              },
            })
          } else {
            const requestNumber = await getNextRequestNumber(tx)
            const title = items.map((i) => `${i.title} ${i.qty} ${i.unit || '?'}`).join(', ')
            const description = items.map((i) => `${i.title} ${i.qty}${i.unit ? ` ${i.unit}` : ''}`.trim()).join(' ')
            const request = await tx.request.create({
              data: {
                businessId,
                number: requestNumber,
                title: `Заявка из MAX: ${title.slice(0, 80)}`,
                description,
                source: 'max_integration',
                status: 'NEW',
              },
            })
            await tx.maxRequestLink.create({
              data: {
                maxConversationId: conversation.id,
                requestId: request.id,
                status: 'READY',
                itemsJson: JSON.parse(JSON.stringify(items)),
              },
            })
            await ensureIncomingRequestForMax(tx, request.id, businessId, items)
            replyText = formatReadyReply(requestNumber)
          }
        }
      }

      await tx.maxMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'OUT',
          idempotencyKey: `out-${idempotencyKey}`,
          text: replyText,
        },
      })
      return { replyText }
    })

    if (result.skipReply) {
      return NextResponse.json({ replyText: '' }, { status: 200 })
    }
    return NextResponse.json({ replyText: result.replyText ?? 'Спасибо, заявка принята' })
  } catch (e) {
    console.error('[MAX webhook error]', e)
    return NextResponse.json({
      replyText: 'Произошла ошибка. Попробуйте позже.',
    })
  }
}
