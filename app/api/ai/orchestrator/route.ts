import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/middleware'
import { parseMaxRequestToRows } from '@/lib/parseMaxRequest'

/**
 * POST /api/ai/orchestrator
 * AI Orchestrator MVP
 *
 * - Требует авторизацию (auth_token)
 * - businessId из сессии (user.businessId), не из body
 * - Принимает { message: string }
 * - Если message содержит числа + единицы (кг, шт, л, упак и т.д.) — парсит через parseMaxRequestToRows
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
    return NextResponse.json({
      intent: 'create_needs',
      items,
    })
  }

  return NextResponse.json({
    intent: 'unknown',
    message: 'AI Orchestrator MVP active',
    echo: message,
  })
}
