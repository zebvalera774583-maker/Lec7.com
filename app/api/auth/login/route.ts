import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, verifyPassword, createToken, isUserRole, normalizeEmail } from '@/lib/auth'
import type { UserRole } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const rawEmail =
      typeof body.email === 'string'
        ? body.email
        : ''
    const email = normalizeEmail(rawEmail)

    const password =
      typeof body.password === 'string'
        ? body.password.trim()
        : ''

    if (!email || !password) {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 })
    }

    const user = await getUserByEmail(email)
    if (!user) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }

    const isValid = await verifyPassword(password, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }

    // Валидация роли
    if (!isUserRole(user.role)) {
      console.error('Invalid user role:', user.role)
      return NextResponse.json({ error: 'Ошибка сервера: невалидная роль пользователя' }, { status: 500 })
    }

    const validatedRole: UserRole = user.role

    const businessId =
      user.role === 'RECEIVER' ? user.receiverBusinessId : user.businesses[0]?.id

    const token = createToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: validatedRole,
      businessId: businessId ?? undefined,
    })

    const response = NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: validatedRole } })
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
