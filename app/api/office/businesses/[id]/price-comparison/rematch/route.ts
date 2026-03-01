import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess } from '@/lib/access'

const REMATCH_SQL = `
WITH accepted_prices AS (
  SELECT pl.id AS "priceListId"
  FROM "PriceAssignment" pa
  JOIN "PriceList" pl ON pl.id = pa."priceListId"
  WHERE pa."counterpartyBusinessId" = $1
    AND pa.status = 'ACTIVE'::"PartnerLinkStatus"
    AND (pl.category = $2 OR pl.category IS NULL)
  UNION
  SELECT pl.id AS "priceListId"
  FROM "PriceList" pl
  WHERE pl."businessId" = $1
    AND (pl.category = $2 OR pl.category IS NULL)
),
cat AS (
  SELECT id, lower(regexp_replace(trim("canonicalName"), '\\s+', ' ', 'g')) AS norm
  FROM "BotCatalogItem"
  WHERE scope = 'GLOBAL'
  UNION ALL
  SELECT b.id, lower(regexp_replace(trim(s), '\\s+', ' ', 'g')) AS norm
  FROM "BotCatalogItem" b, unnest(b.synonyms) AS s
  WHERE b.scope = 'GLOBAL'
),
map AS (
  SELECT norm, max(id) AS id
  FROM cat
  WHERE norm IS NOT NULL AND norm <> ''
  GROUP BY norm
  HAVING count(DISTINCT id) = 1
),
candidate_rows AS (
  SELECT r.id, lower(regexp_replace(trim(r.name), '\\s+', ' ', 'g')) AS norm
  FROM "PriceListRow" r
  JOIN accepted_prices ap ON ap."priceListId" = r."priceListId"
  WHERE r."masterItemId" IS NULL
    AND trim(r.name) <> ''
)
UPDATE "PriceListRow" r
SET "masterItemId" = m.id
FROM candidate_rows cr
JOIN map m ON m.norm = cr.norm
WHERE r.id = cr.id
`

export const POST = withBusinessAccess(async (req: NextRequest) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]
    const categoryParam =
      url.searchParams.get('category')?.trim() || 'Свежая плодоовощная продукция'

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const updated = await prisma.$executeRawUnsafe(REMATCH_SQL, businessId, categoryParam)

    return NextResponse.json({ updated: Number(updated) })
  } catch (error) {
    console.error('Price comparison rematch error:', error)
    return NextResponse.json(
      { error: 'Ошибка пересопоставления' },
      { status: 500 }
    )
  }
})
