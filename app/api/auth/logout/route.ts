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
  // Получаем правильный хост из заголовка Host или используем относительный путь
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host')
  const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https') ? 'https' : 'http')
  
  // Используем относительный путь, если хост недоступен
  const redirectUrl = host ? `${protocol}://${host}/login` : '/login'
  
  const response = NextResponse.redirect(redirectUrl)
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
