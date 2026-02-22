import { NextRequest, NextResponse } from 'next/server'
import { createUser, createToken, getUserByEmail, isUserRole } from '@/lib/auth'
import type { UserRole } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      email: string
      password: string
      name?: string
    }
    const { email, password, name } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 })
    }

    // Проверяем, существует ли пользователь
    const existingUser = await getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json({ error: 'EMAIL_ALREADY_EXISTS' }, { status: 409 })
    }

    const user = await createUser(email, password, name)

    // Валидация роли после создания
    if (!isUserRole(user.role)) {
      console.error('Invalid user role after creation:', user.role)
      return NextResponse.json({ error: 'Ошибка сервера: невалидная роль пользователя' }, { status: 500 })
    }

    const validatedRole: UserRole = user.role

    const token = createToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: validatedRole,
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
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
