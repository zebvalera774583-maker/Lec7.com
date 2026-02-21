import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SECRET_HEADER = 'x-lec7-max-secret'

const BRANCH_COMMANDS = ['/branch', 'branch', 'сменить']

function buildBranchMenu(businesses: { slug: string }[]): string {
  if (businesses.length === 0) {
    return 'Нет доступных подразделений.'
  }
  const lines = businesses.map((b) => `- ${b.slug}`)
  return `Выберите подразделение (ответьте slug):\n${lines.join('\n')}`
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
  const textTrim = text.trim().toLowerCase()

  if (!chatId) {
    return NextResponse.json({ replyText: 'Ошибка: chatId отсутствует' })
  }

  // Команда смены подразделения
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
    include: { business: { select: { id: true, slug: true } } },
  })

  // Контекст есть — создаём заявку
  if (context) {
    await prisma.request.create({
      data: {
        businessId: context.businessId,
        title: `Заявка из MAX: ${text.slice(0, 80) || 'Новое сообщение'}`,
        description: text || 'Сообщение из MAX',
        source: 'max_integration',
      },
    })
    return NextResponse.json({ replyText: 'Спасибо, заявка принята' })
  }

  // Контекста нет — пользователь должен выбрать slug
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

  // Не slug — показать меню выбора
  const businesses = await prisma.business.findMany({
    select: { slug: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  if (textTrim) {
    return NextResponse.json({
      replyText: `Не найдено. Ответьте одним из slug из списка:\n${businesses.map((b) => `- ${b.slug}`).join('\n')}`,
    })
  }

  return NextResponse.json({ replyText: buildBranchMenu(businesses) })
}
