import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseLineItemsFromText, normalizeUnitInput } from '@/lib/max/parser'
import { createHash } from 'crypto'

const SECRET_HEADER = 'x-lec7-max-secret'
const BRANCH_COMMANDS = ['/branch', 'branch', 'сменить']

function buildBranchMenu(businesses: { slug: string }[]): string {
  if (businesses.length === 0) return 'Нет доступных подразделений.'
  return `Выберите подразделение (ответьте slug):\n${businesses.map((b) => `- ${b.slug}`).join('\n')}`
}

function computeIdempotencyKey(eventId: string | null, chatId: string, text: string): string {
  if (eventId) return eventId
  const timeBucket = Math.floor(Date.now() / 60000) // 1 min bucket
  const hash = createHash('sha256').update(`${chatId}|${text}|${timeBucket}`).digest('hex')
  return hash.slice(0, 32)
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

  // Branch selection command
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
      const link = await tx.maxRequestLink.findUnique({
        where: { maxConversationId: conversation.id },
      })

      if (!link) {
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
        const status = hasMissingUnit ? 'NEED_DETAILS' : 'READY'
        const title = items.map((i) => `${i.title} ${i.qty} ${i.unit || '?'}`).join(', ')
        const description = items.map((i) => `${i.title} ${i.qty}${i.unit ? ` ${i.unit}` : ''}`.trim()).join(' ')

        const request = await tx.request.create({
          data: {
            businessId,
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
            status,
            itemsJson: JSON.parse(JSON.stringify(items)),
          },
        })

        if (hasMissingUnit) {
          replyText = 'кг или шт?'
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

        replyText = 'Спасибо, заявка принята'
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
        if (unit) {
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
          replyText = allFilled ? 'Спасибо, заявка принята' : 'кг или шт?'
        } else {
          replyText = 'Не понял единицу. Напишите: кг или шт.'
        }
      } else {
        // READY or DRAFT: new message = new request
        const items = parseLineItemsFromText(text)
        if (items.length === 0) {
          replyText = 'Напишите товар и количество. Пример: яблоки 10 кг.'
        } else {
          const hasMissingUnit = items.some((i) => !i.unit)
          const status = hasMissingUnit ? 'NEED_DETAILS' : 'READY'
          const title = items.map((i) => `${i.title} ${i.qty} ${i.unit || '?'}`).join(', ')
          const description = items.map((i) => `${i.title} ${i.qty}${i.unit ? ` ${i.unit}` : ''}`.trim()).join(' ')
          const request = await tx.request.create({
            data: {
              businessId,
              title: `Заявка из MAX: ${title.slice(0, 80)}`,
              description,
              source: 'max_integration',
              status: 'NEW',
            },
          })
          await tx.maxRequestLink.update({
            where: { maxConversationId: conversation.id },
            data: {
              requestId: request.id,
              status,
              itemsJson: JSON.parse(JSON.stringify(items)),
            },
          })
          replyText = hasMissingUnit ? 'кг или шт?' : 'Спасибо, заявка принята'
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
