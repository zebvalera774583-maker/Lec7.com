import { NextRequest, NextResponse } from 'next/server'

/**
 * Очистка auth_token cookie
 */
function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.delete('auth_token')
  return response
}

/**
 * GET /api/auth/logout
 * Очищает сессию и редиректит на /login
 */
export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin
  const response = NextResponse.redirect(new URL('/login', baseUrl))
  return clearAuthCookie(response)
}

/**
 * POST /api/auth/logout
 * Очищает сессию и возвращает JSON ответ
 */
export async function POST() {
  const response = NextResponse.json({ success: true })
  return clearAuthCookie(response)
}
