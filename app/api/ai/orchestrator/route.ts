import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/middleware'

/**
 * POST /api/ai/orchestrator
 * AI Orchestrator MVP — заглушка
 *
 * - Требует авторизацию (auth_token)
 * - businessId из сессии (user.businessId), не из body
 * - Принимает { message: string }
 */
export async function POST(request: NextRequest) {
  const user = getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const message = typeof body.message === 'string' ? body.message : ''

  return NextResponse.json({
    intent: 'unknown',
    message: 'AI Orchestrator MVP active',
    echo: message,
  })
}
