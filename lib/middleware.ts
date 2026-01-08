import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, AuthUser } from './auth'

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
