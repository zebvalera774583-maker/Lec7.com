import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateSlug, isLatinOnly } from '@/lib/slug'
import { createUser, createToken, getUserByEmail, isUserRole } from '@/lib/auth'
import type { UserRole } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email: string
      password: string
      name: string
      city?: string
      category?: string
    }

    const { email, password, name, city, category } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'EMAIL_PASSWORD_NAME_REQUIRED' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'PASSWORD_TOO_SHORT', message: 'Пароль должен быть не менее 6 символов' },
        { status: 400 }
      )
    }

    // Валидация названия бизнеса
    if (!isLatinOnly(name)) {
      return NextResponse.json(
        {
          error: 'INVALID_NAME_LATIN_ONLY',
          message: 'Название бизнеса должно содержать только латинские буквы, цифры, пробелы и дефисы',
        },
        { status: 400 }
      )
    }

    // Проверяем существующего пользователя
    const existingUser = await getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'USER_ALREADY_EXISTS' },
        { status: 409 }
      )
    }

    // Создаём пользователя-резидента
    const user = await createUser(email, password, undefined, 'BUSINESS_OWNER')

    if (!isUserRole(user.role)) {
      console.error('Invalid user role after resident signup:', user.role)
      return NextResponse.json(
        { error: 'INVALID_USER_ROLE' },
        { status: 500 }
      )
    }

    const validatedRole: UserRole = user.role

    // Генерируем уникальный slug для бизнеса
    let baseSlug = generateSlug(name)
    let slug = baseSlug
    let counter = 1

    while (await prisma.business.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Создаём бизнес, привязанный к пользователю
    const business = await prisma.business.create({
      data: {
        name,
        slug,
        city: city || null,
        category: category || null,
        ownerId: user.id,
        lifecycleStatus: 'DRAFT',
        billingStatus: 'UNPAID',
      },
      select: {
        id: true,
        slug: true,
        name: true,
        city: true,
        category: true,
      },
    })

    // Создаём auth_token cookie как в /api/auth/login
    const token = createToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: validatedRole,
      businessId: business.id,
    })

    const response = NextResponse.json(
      {
        success: true,
        user: { id: user.id, email: user.email, name: user.name, role: validatedRole },
        business,
      },
      { status: 201 }
    )

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
    })

    return response
  } catch (error) {
    console.error('Resident signup error:', error)
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 })
  }
}
