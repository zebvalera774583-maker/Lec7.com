import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/middleware'
import { requireBusinessAccess } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import {
  classifyIntentStub,
  INTENT_CHAINS,
  UNKNOWN_RESPONSE,
} from '@/lib/orchestrator/router'

/**
 * POST /api/orchestrator/chat
 * AI Orchestrator — единый entrypoint для Web (пока без Telegram/MAX)
 *
 * Pipeline: Auth → Scope → LLM classify → Action dispatch → Audit → Response
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Auth: пользователь обязателен
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const businessId = typeof body.businessId === 'string' ? body.businessId : null

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    // 2. Scope: businessId обязателен для Web, берётся из контекста (клиент передаёт с текущей страницы)
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const hasAccess = await requireBusinessAccess(businessId, user.id, user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. LLM classification stub
    const { intent, entities } = classifyIntentStub(message)

    // 4. Action dispatch: intent -> chain
    const chain = INTENT_CHAINS[intent] ?? INTENT_CHAINS.unknown
    let responseText = UNKNOWN_RESPONSE
    let status: 'ok' | 'error' = 'ok'

    if (chain.length > 0) {
      // TODO: выполнить цепочку actions
      responseText = UNKNOWN_RESPONSE
    }

    // 5. Audit: логировать попытку без секретов
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: `orchestrator:${intent}`,
        metadata: {
          businessId,
          status,
          intent,
          entitiesKeys: Object.keys(entities),
        },
      },
    })

    return NextResponse.json({
      response: responseText,
      intent,
    })
  } catch (error) {
    console.error('Orchestrator error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
