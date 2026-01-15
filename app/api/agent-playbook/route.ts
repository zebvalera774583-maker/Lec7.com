import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

// Доступ только для владельца Lec7 (LEC7_ADMIN)
const withOwnerAuth = (handler: any) => requireRole(['LEC7_ADMIN'], handler)

export const GET = withOwnerAuth(async (req: NextRequest, _user: any) => {
  try {
    const { searchParams } = new URL(req.url)
    const scope = searchParams.get('scope')
    const businessId = searchParams.get('businessId')
    const q = searchParams.get('q')
    const tag = searchParams.get('tag')

    const where: any = {}

    if (scope) {
      where.scope = scope
    }

    if (businessId) {
      where.businessId = businessId
    }

    if (tag) {
      where.tags = {
        has: tag,
      }
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { move: { contains: q, mode: 'insensitive' } },
        { context: { contains: q, mode: 'insensitive' } },
        { outcome: { contains: q, mode: 'insensitive' } },
      ]
    }

    const items = await prisma.agentPlaybookItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('Agent playbook GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

export const POST = withOwnerAuth(async (req: NextRequest, user: any) => {
  try {
    const body = (await req.json()) as {
      scope: string
      businessId?: string | null
      title: string
      move: string
      context?: string | null
      outcome?: string | null
      confidence: string
      tags?: string[]
    }

    // Валидация обязательных полей
    if (!body.scope || !body.title || !body.move || !body.confidence) {
      return NextResponse.json(
        { error: 'Missing required fields: scope, title, move, confidence' },
        { status: 400 }
      )
    }

    // Проверка значений enum
    if (!['PLATFORM', 'BUSINESS'].includes(body.scope)) {
      return NextResponse.json(
        { error: 'Invalid scope. Must be PLATFORM or BUSINESS' },
        { status: 400 }
      )
    }

    if (!['LOW', 'MEDIUM', 'HIGH'].includes(body.confidence)) {
      return NextResponse.json(
        { error: 'Invalid confidence. Must be LOW, MEDIUM, or HIGH' },
        { status: 400 }
      )
    }

    // Если scope=BUSINESS, businessId должен быть указан
    if (body.scope === 'BUSINESS' && !body.businessId) {
      return NextResponse.json(
        { error: 'businessId is required when scope is BUSINESS' },
        { status: 400 }
      )
    }

    // Если scope=PLATFORM, businessId должен быть null
    if (body.scope === 'PLATFORM' && body.businessId) {
      return NextResponse.json(
        { error: 'businessId must be null when scope is PLATFORM' },
        { status: 400 }
      )
    }

    const item = await prisma.agentPlaybookItem.create({
      data: {
        scope: body.scope,
        businessId: body.scope === 'PLATFORM' ? null : body.businessId || null,
        title: body.title.trim(),
        move: body.move.trim(),
        context: body.context?.trim() || null,
        outcome: body.outcome?.trim() || null,
        confidence: body.confidence,
        tags: body.tags || [],
      },
    })

    // AuditLog
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'AGENT_PLAYBOOK_ITEM_CREATED',
        metadata: {
          itemId: item.id,
          scope: item.scope,
          title: item.title,
        },
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Agent playbook POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
