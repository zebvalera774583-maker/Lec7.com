import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/middleware'
import { parseMaxRequestToRows } from '@/lib/parseMaxRequest'
import { resolveCatalogItems } from '@/lib/orchestrator/resolveCatalogItems'

/**
 * POST /api/ai/orchestrator
 * AI Orchestrator MVP
 *
 * - Требует авторизацию (auth_token)
 * - businessId из сессии (user.businessId), не из body
 * - Принимает { message: string }
 * - create_needs: parseMaxRequestToRows → resolveCatalogItems (BotCatalogItem + synonyms, только чтение)
 */
export async function POST(request: NextRequest) {
  const user = getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const message = typeof body.message === 'string' ? body.message : ''

  const items = parseMaxRequestToRows(message, '')
  const isFallback =
    items.length === 1 &&
    items[0].name === message.trim() &&
    items[0].quantity === '1' &&
    items[0].unit === 'шт'

  if (items.length > 0 && !isFallback) {
    const businessId = user.businessId ?? ''
    const resolved = await resolveCatalogItems(items, businessId)

    return NextResponse.json({
      intent: 'create_needs',
      items: resolved.map((r) => ({
        catalogItemId: r.catalogItemId,
        canonicalName: r.canonicalName,
        confidence: r.confidence,
        needsUserChoice: r.needsUserChoice,
        name: r.name,
        quantity: r.quantity,
        unit: r.unit,
      })),
    })
  }

  return NextResponse.json({
    intent: 'unknown',
    message: 'AI Orchestrator MVP active',
    echo: message,
  })
}
