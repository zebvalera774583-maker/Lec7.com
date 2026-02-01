import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/categories?type=PRICE|BUSINESS
 * Список категорий из справочника. type — PRICE (категории прайсов) или BUSINESS (категории бизнеса на витрине).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')?.toUpperCase() || 'PRICE'

    if (type !== 'PRICE' && type !== 'BUSINESS') {
      return NextResponse.json({ error: 'Invalid type. Use PRICE or BUSINESS.' }, { status: 400 })
    }

    const categories = await prisma.category.findMany({
      where: { type },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, sortOrder: true },
    })

    return NextResponse.json(categories)
  } catch (e) {
    console.error('Categories GET error:', e)
    return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 })
  }
}
