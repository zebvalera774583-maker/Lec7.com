import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const SCOPE_GLOBAL = 'GLOBAL'
const PAGE_SIZE = 20

function parseSynonyms(val: unknown): string[] {
  if (val == null || val === '') return []
  const s = String(val)
  return s.split(/[,\n]+/).map((p) => p.trim().toLowerCase()).filter(Boolean)
}

export const GET = requireRole(['LEC7_ADMIN'], async (req: NextRequest) => {
  try {
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim()
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const skip = (page - 1) * PAGE_SIZE

    if (!q) {
      const [items, total] = await Promise.all([
        prisma.botCatalogItem.findMany({
          where: { scope: SCOPE_GLOBAL },
          orderBy: { canonicalName: 'asc' },
          skip,
          take: PAGE_SIZE,
        }),
        prisma.botCatalogItem.count({ where: { scope: SCOPE_GLOBAL } }),
      ])
      return NextResponse.json({ items, total })
    }

    const pattern = `%${q}%`
    const items = await prisma.$queryRaw<
      Array<{
        id: string
        scope: string
        canonicalName: string
        synonyms: string[]
        defaultUnit: string | null
        isActive: boolean
        createdAt: Date
        updatedAt: Date
      }>
    >(
      Prisma.sql`
        SELECT * FROM "BotCatalogItem"
        WHERE scope = ${SCOPE_GLOBAL}
        AND (
          "canonicalName" ILIKE ${pattern}
          OR EXISTS (SELECT 1 FROM unnest(synonyms) AS s WHERE s ILIKE ${pattern})
        )
        ORDER BY "canonicalName" ASC
        LIMIT ${PAGE_SIZE} OFFSET ${skip}
      `
    )

    const countResult = await prisma.$queryRaw<[{ count: bigint }]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint as count FROM "BotCatalogItem"
        WHERE scope = ${SCOPE_GLOBAL}
        AND (
          "canonicalName" ILIKE ${pattern}
          OR EXISTS (SELECT 1 FROM unnest(synonyms) AS s WHERE s ILIKE ${pattern})
        )
      `
    )
    const total = Number(countResult[0]?.count ?? 0)

    return NextResponse.json({ items, total })
  } catch (err) {
    console.error('Bot catalog list error:', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
})

export const POST = requireRole(['LEC7_ADMIN'], async (req: NextRequest) => {
  try {
    const body = await req.json()
    const canonicalName = String(body.canonicalName ?? '').trim()
    const defaultUnit = body.defaultUnit != null ? String(body.defaultUnit).trim() || null : null
    const isActive = body.isActive !== false
    const synonyms = parseSynonyms(body.synonyms)

    if (!canonicalName) {
      return NextResponse.json({ error: 'canonicalName is required' }, { status: 400 })
    }

    const item = await prisma.botCatalogItem.create({
      data: {
        scope: SCOPE_GLOBAL,
        canonicalName,
        defaultUnit,
        isActive,
        synonyms,
      },
    })

    return NextResponse.json(item)
  } catch (err: unknown) {
    console.error('Bot catalog create error:', err)
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: 'Запись с таким названием уже существует' }, { status: 409 })
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
})
