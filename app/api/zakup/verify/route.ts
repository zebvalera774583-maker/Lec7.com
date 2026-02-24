import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const ZAKUP_PASSWORD = process.env.ZAKUP_PASSWORD ?? ''
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const password = typeof body.password === 'string' ? body.password.trim() : ''

    if (!ZAKUP_PASSWORD) {
      return NextResponse.json({ error: 'Zakup не настроен' }, { status: 500 })
    }

    if (password === ZAKUP_PASSWORD) {
      const token = jwt.sign({ zakup: true }, JWT_SECRET, { expiresIn: '24h' })
      return NextResponse.json({ success: true, token })
    }

    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
