import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

export const DELETE = requireRole(['LEC7_ADMIN'], async (req: NextRequest) => {
  try {
    const pathParts = new URL(req.url).pathname.split('/')
    const id = pathParts[pathParts.indexOf('clarification-questions') + 1]

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await prisma.clarificationQuestion.delete({
      where: { id },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Clarification question delete error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
