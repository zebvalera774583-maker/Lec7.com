import { NextRequest, NextResponse } from 'next/server'

const ZAKUP_PASSWORD = process.env.ZAKUP_PASSWORD ?? ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const password = typeof body.password === 'string' ? body.password.trim() : ''

    if (!ZAKUP_PASSWORD) {
      return NextResponse.json({ error: 'Zakup не настроен' }, { status: 500 })
    }

    if (password === ZAKUP_PASSWORD) {
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
