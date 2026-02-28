import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

export const GET = requireRole(['LEC7_ADMIN'], async () => {
  try {
    const items = await prisma.botCatalogItem.findMany({
      where: { scope: 'GLOBAL' },
      orderBy: { canonicalName: 'asc' },
      take: 500,
    })
    return NextResponse.json(items)
  } catch (err) {
    console.error('Bot catalog list error:', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
})
