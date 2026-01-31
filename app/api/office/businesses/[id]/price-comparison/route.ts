import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

const ROWS_SQL = `
WITH accepted_prices AS (
  SELECT
    pl.id AS "priceListId",
    pl."businessId" AS "supplierBusinessId",
    COALESCE(NULLIF(s."legalName", ''), s.name) AS "supplierLegalName",
    pl."updatedAt" AS "priceListUpdatedAt"
  FROM "PriceAssignment" pa
  JOIN "PriceList" pl ON pl.id = pa."priceListId"
  JOIN "Business" s ON s.id = pl."businessId"
  WHERE pa."counterpartyBusinessId" = $1
    AND pa.status = 'ACTIVE'::"PartnerLinkStatus"
    AND (pl.category = $2 OR (pl.category IS NULL AND $2 = 'Свежая плодоовощная продукция'))
),
items AS (
  SELECT
    ap."supplierBusinessId",
    ap."supplierLegalName",
    ap."priceListId",
    ap."priceListUpdatedAt",
    r.name AS "rawName",
    r.unit AS "unit",
    COALESCE(r."priceWithVat", r."priceWithoutVat")::numeric AS "price",
    lower(
      trim(
        regexp_replace(
          regexp_replace(r.name, '[\\.,;:()\\[\\]{}"''\`]', '', 'g'),
          '\\s+', ' ', 'g'
        )
      )
    ) AS "normTitle"
  FROM accepted_prices ap
  JOIN "PriceListRow" r ON r."priceListId" = ap."priceListId"
),
titles AS (
  SELECT
    "normTitle",
    MIN("rawName") AS "displayTitle"
  FROM items
  WHERE "normTitle" <> '' AND "normTitle" IS NOT NULL
  GROUP BY "normTitle"
),
offers AS (
  SELECT
    i."normTitle",
    i."supplierBusinessId",
    MIN(i."price") AS "price",
    MIN(i."unit") AS "unit"
  FROM items i
  WHERE i."normTitle" <> '' AND i."normTitle" IS NOT NULL
  GROUP BY i."normTitle", i."supplierBusinessId"
)
SELECT
  t."normTitle",
  t."displayTitle",
  COALESCE(
    jsonb_object_agg(
      o."supplierBusinessId",
      jsonb_build_object('price', o."price", 'unit', o."unit")
      ORDER BY o."supplierBusinessId"
    ) FILTER (WHERE o."supplierBusinessId" IS NOT NULL),
    '{}'::jsonb
  ) AS "offers"
FROM titles t
LEFT JOIN offers o ON o."normTitle" = t."normTitle"
GROUP BY t."normTitle", t."displayTitle"
ORDER BY t."normTitle" ASC
`

type RowRaw = {
  normTitle: string
  displayTitle: string
  offers: Record<string, { price: number | string | null; unit: string | null }>
}

export const GET = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]
    const categoryParam = url.searchParams.get('category')?.trim() || 'Свежая плодоовощная продукция'

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (user.role !== 'LEC7_ADMIN' && business.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Suppliers: active assignments for this counterparty and category, dedupe by supplierBusinessId
    const assignments = await prisma.priceAssignment.findMany({
      where: {
        counterpartyBusinessId: businessId,
        status: 'ACTIVE',
        priceList:
          categoryParam === 'Свежая плодоовощная продукция'
            ? { OR: [{ category: categoryParam }, { category: null }] }
            : { category: categoryParam },
      },
      include: {
        priceList: {
          select: {
            id: true,
            updatedAt: true,
            business: {
              select: {
                id: true,
                name: true,
                legalName: true,
              },
            },
          },
        },
      },
    })

    const supplierMap = new Map<string, { supplierBusinessId: string; supplierLegalName: string; priceListId: string; priceListUpdatedAt: Date }>()
    for (const a of assignments) {
      const bid = a.priceList.business.id
      if (supplierMap.has(bid)) continue
      const legalName = (a.priceList.business.legalName || '').trim() || a.priceList.business.name
      supplierMap.set(bid, {
        supplierBusinessId: bid,
        supplierLegalName: legalName,
        priceListId: a.priceList.id,
        priceListUpdatedAt: a.priceList.updatedAt,
      })
    }
    const suppliers = Array.from(supplierMap.values()).sort((a, b) =>
      a.supplierLegalName.localeCompare(b.supplierLegalName, 'ru')
    )

    // Rows + offers from raw SQL (filter by category)
    const rowsRaw = await prisma.$queryRawUnsafe<RowRaw[]>(ROWS_SQL, businessId, categoryParam)

    const rows = rowsRaw.map((r, idx) => ({
      no: idx + 1,
      title: r.displayTitle,
      normTitle: r.normTitle,
      offers: Object.fromEntries(
        Object.entries(r.offers || {}).map(([k, v]) => [
          k,
          {
            price: v?.price != null ? Number(v.price) : null,
            unit: v?.unit ?? null,
          },
        ])
      ),
    }))

    return NextResponse.json({
      counterpartyBusinessId: businessId,
      category: categoryParam,
      suppliers,
      rows,
    })
  } catch (error) {
    console.error('Price comparison error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
