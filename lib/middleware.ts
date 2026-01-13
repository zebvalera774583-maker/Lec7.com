import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './auth'
import type { AuthUser } from '@/types'

export interface RequestWithAuth extends NextRequest {
  user?: AuthUser
}

/**
 * Получение пользователя из токена в cookie или заголовке
 */
export function getAuthUser(request: NextRequest): AuthUser | null {
  // Проверяем cookie
  const token = request.cookies.get('auth_token')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return null
  }

  return verifyToken(token)
}

/**
 * Middleware для проверки аутентификации
 */
export function requireAuth(handler: (req: RequestWithAuth, user: AuthUser) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const user = getAuthUser(req)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reqWithAuth = req as RequestWithAuth
    reqWithAuth.user = user
    
    return handler(reqWithAuth, user)
  }
}

/**
 * Middleware для проверки роли
 */
export function requireRole(
  allowedRoles: string[],
  handler: (req: RequestWithAuth, user: AuthUser) => Promise<NextResponse>
) {
  return requireAuth(async (req, user) => {
    if (!allowedRoles.includes(user.role) && !allowedRoles.includes('visitor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    return handler(req, user)
  })
}

/**
 * Получение пользователя в Server Components (App Router),
 * где у нас есть cookies() и headers() вместо NextRequest
 */
export function getAuthUserFromContext(ctx: {
  cookies: { get: (name: string) => { value: string } | undefined }
  headers: { get: (name: string) => string | null }
}): AuthUser | null {
  const token =
    ctx.cookies.get('auth_token')?.value ||
    ctx.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) return null
  return verifyToken(token)
}
