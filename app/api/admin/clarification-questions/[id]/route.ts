import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

export const DELETE = requireRole(['LEC7_ADMIN'], async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    await prisma.clarificationQuestion.delete({
      where: { id },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Clarification question delete error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
