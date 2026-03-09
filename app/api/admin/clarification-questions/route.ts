import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

export const GET = requireRole(['LEC7_ADMIN'], async () => {
  try {
    const rows = await prisma.clarificationQuestion.findMany({
      orderBy: { word: 'asc' },
    })
    return NextResponse.json(rows)
  } catch (err) {
    console.error('Clarification questions list error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

export const POST = requireRole(['LEC7_ADMIN'], async (req: NextRequest) => {
  try {
    const body = await req.json()
    const word = String(body.word ?? '').trim().toLowerCase()
    const question = String(body.question ?? '').trim()

    if (!word || !question) {
      return NextResponse.json({ error: 'word и question обязательны' }, { status: 400 })
    }

    const row = await prisma.clarificationQuestion.create({
      data: { word, question },
    })
    return NextResponse.json(row)
  } catch (err: unknown) {
    console.error('Clarification question create error:', err)
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: 'Слово уже есть в справочнике' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
