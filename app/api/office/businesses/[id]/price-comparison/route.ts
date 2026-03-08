import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess } from '@/lib/access'

const ROWS_SQL = `
WITH active_counterparties AS (
  SELECT DISTINCT pl."businessId" AS "supplierBusinessId"
  FROM "PriceAssignment" pa
  JOIN "PriceList" pl ON pl.id = pa."priceListId"
  WHERE pa."counterpartyBusinessId" = $1
    AND pa.status = 'ACTIVE'::"PartnerLinkStatus"
),
accepted_prices AS (
  SELECT
    pl.id AS "priceListId",
    pl."businessId" AS "supplierBusinessId",
    COALESCE(NULLIF(s."legalName", ''), s.name) AS "supplierLegalName",
    pl."updatedAt" AS "priceListUpdatedAt"
  FROM "PriceList" pl
  JOIN "Business" s ON s.id = pl."businessId"
  WHERE pl."businessId" = $1
    AND (pl.category = $2 OR pl.category IS NULL)
  UNION
  SELECT
    pl.id AS "priceListId",
    pl."businessId" AS "supplierBusinessId",
    COALESCE(NULLIF(s."legalName", ''), s.name) AS "supplierLegalName",
    pl."updatedAt" AS "priceListUpdatedAt"
  FROM "PriceList" pl
  JOIN "Business" s ON s.id = pl."businessId"
  JOIN active_counterparties ac ON ac."supplierBusinessId" = pl."businessId"
  WHERE (pl.category = $2 OR pl.category IS NULL)
),
items AS (
  SELECT
    ap."supplierBusinessId",
    ap."supplierLegalName",
    ap."priceListId",
    ap."priceListUpdatedAt",
    r."masterItemId" AS "masterItemId",
    r.name AS "rawName",
    r.unit AS "unit",
    COALESCE(r."priceWithVat", r."priceWithoutVat")::numeric AS "price",
    lower(trim(regexp_replace(regexp_replace(r.name, '[\\.,;:()\\[\\]{}"''\`]', '', 'g'), '\\s+', ' ', 'g'))) AS "normTitle",
    b."canonicalName" AS "canonicalName"
  FROM accepted_prices ap
  JOIN "PriceListRow" r ON r."priceListId" = ap."priceListId"
  LEFT JOIN "BotCatalogItem" b ON r."masterItemId" = b."id"
),
items_with_key AS (
  SELECT *,
    CASE
      WHEN "masterItemId" IS NOT NULL THEN 'm:' || "masterItemId"
      ELSE 'u:' || COALESCE("normTitle", '')
    END AS "groupKey"
  FROM items
),
titles AS (
  SELECT
    "groupKey",
    CASE
      WHEN bool_or("masterItemId" IS NOT NULL) THEN MIN("canonicalName")
      ELSE MIN("rawName")
    END AS "displayTitle",
    bool_or("masterItemId" IS NOT NULL) AS "isMapped",
    MAX("masterItemId") AS "masterItemId"
  FROM items_with_key
  GROUP BY "groupKey"
),
offers AS (
  SELECT
    i."groupKey",
    i."supplierBusinessId",
    MIN(i."price") AS "price",
    MIN(i."unit") AS "unit"
  FROM items_with_key i
  GROUP BY i."groupKey", i."supplierBusinessId"
)
SELECT
  t."groupKey" AS "normTitle",
  t."displayTitle",
  t."isMapped",
  t."masterItemId",
  COALESCE(
    jsonb_object_agg(
      o."supplierBusinessId",
      jsonb_build_object('price', o."price", 'unit', o."unit")
      ORDER BY o."supplierBusinessId"
    ) FILTER (WHERE o."supplierBusinessId" IS NOT NULL),
    '{}'::jsonb
  ) AS "offers"
FROM titles t
LEFT JOIN offers o ON o."groupKey" = t."groupKey"
GROUP BY t."groupKey", t."displayTitle", t."isMapped", t."masterItemId"
ORDER BY t."displayTitle" ASC
`

type RowRaw = {
  normTitle: string
  displayTitle: string
  isMapped: boolean
  masterItemId: string | null
  offers: Record<string, { price: number | string | null; unit: string | null }>
}

export const GET = withBusinessAccess(async (req, user) => {
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
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const categoryFilter = { OR: [{ category: categoryParam }, { category: null }] }

    const activeAssignments = await prisma.priceAssignment.findMany({
      where: { counterpartyBusinessId: businessId, status: 'ACTIVE' },
      select: { priceList: { select: { businessId: true } } },
    })
    const activeSupplierIds = [...new Set(activeAssignments.map((a) => a.priceList.businessId))]

    const [ownPriceLists, counterpartyPriceLists] = await Promise.all([
      prisma.priceList.findMany({
        where: { businessId, ...categoryFilter },
        select: {
          id: true,
          updatedAt: true,
          business: { select: { id: true, name: true, legalName: true } },
        },
      }),
      activeSupplierIds.length > 0
        ? prisma.priceList.findMany({
            where: { businessId: { in: activeSupplierIds }, ...categoryFilter },
            select: {
              id: true,
              updatedAt: true,
              business: { select: { id: true, name: true, legalName: true } },
            },
            orderBy: { updatedAt: 'desc' },
          })
        : Promise.resolve([]),
    ])

    const supplierMap = new Map<string, { supplierBusinessId: string; supplierLegalName: string; priceListId: string; priceListUpdatedAt: Date }>()
    for (const pl of ownPriceLists) {
      const bid = pl.business.id
      if (supplierMap.has(bid)) continue
      const legalName = (pl.business.legalName || '').trim() || pl.business.name
      supplierMap.set(bid, {
        supplierBusinessId: bid,
        supplierLegalName: legalName,
        priceListId: pl.id,
        priceListUpdatedAt: pl.updatedAt,
      })
    }
    for (const pl of counterpartyPriceLists) {
      const bid = pl.business.id
      if (supplierMap.has(bid)) continue
      const legalName = (pl.business.legalName || '').trim() || pl.business.name
      supplierMap.set(bid, {
        supplierBusinessId: bid,
        supplierLegalName: legalName,
        priceListId: pl.id,
        priceListUpdatedAt: pl.updatedAt,
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
      isMapped: r.isMapped,
      masterItemId: r.masterItemId,
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
