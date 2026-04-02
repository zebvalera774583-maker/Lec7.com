import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess } from '@/lib/access'

const ROWS_SQL = `
WITH norm_to_master AS (
  SELECT norm, max(id) AS id
  FROM (
    SELECT lower(trim(regexp_replace(regexp_replace(b."canonicalName", '[\\.,;:()\\[\\]{}"''\`]', '', 'g'), '\\s+', ' ', 'g'))) AS norm, b.id
    FROM "BotCatalogItem" b
    WHERE b.scope = 'GLOBAL'
    UNION ALL
    SELECT lower(trim(regexp_replace(regexp_replace(s, '[\\.,;:()\\[\\]{}"''\`]', '', 'g'), '\\s+', ' ', 'g'))) AS norm, b.id
    FROM "BotCatalogItem" b, unnest(b.synonyms) AS s
    WHERE b.scope = 'GLOBAL'
  ) t
  WHERE norm IS NOT NULL AND norm <> ''
  GROUP BY norm
  HAVING count(DISTINCT id) = 1
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
  FROM "PriceAssignment" pa
  JOIN "PriceList" pl ON pl.id = pa."priceListId"
  JOIN "Business" s ON s.id = pl."businessId"
  WHERE pa."counterpartyBusinessId" = $1
    AND pa.status = 'ACTIVE'::"PartnerLinkStatus"
    AND (pl.category = $2 OR pl.category IS NULL)
),
items AS (
  SELECT
    ap."supplierBusinessId",
    ap."supplierLegalName",
    ap."priceListId",
    ap."priceListUpdatedAt",
    COALESCE(r."masterItemId", nm.id) AS "resolvedMasterId",
    r."masterItemId" AS "masterItemId",
    r.name AS "rawName",
    r.unit AS "unit",
    COALESCE(r."priceWithVat", r."priceWithoutVat")::numeric AS "price",
    lower(trim(regexp_replace(regexp_replace(r.name, '[\\.,;:()\\[\\]{}"''\`]', '', 'g'), '\\s+', ' ', 'g'))) AS "normTitle",
    COALESCE(b."canonicalName", b2."canonicalName") AS "canonicalName"
  FROM accepted_prices ap
  JOIN "PriceListRow" r ON r."priceListId" = ap."priceListId"
  LEFT JOIN "BotCatalogItem" b ON r."masterItemId" = b."id"
  LEFT JOIN norm_to_master nm ON nm.norm = lower(trim(regexp_replace(regexp_replace(r.name, '[\\.,;:()\\[\\]{}"''\`]', '', 'g'), '\\s+', ' ', 'g')))
  LEFT JOIN "BotCatalogItem" b2 ON nm.id = b2."id"
),
items_with_key AS (
  SELECT *,
    CASE
      WHEN "resolvedMasterId" IS NOT NULL THEN 'm:' || "resolvedMasterId"
      ELSE 'u:' || COALESCE("normTitle", '')
    END AS "groupKey"
  FROM items
),
titles AS (
  SELECT
    "groupKey",
    CASE
      WHEN bool_or("resolvedMasterId" IS NOT NULL) THEN MIN("canonicalName")
      ELSE MIN("rawName")
    END AS "displayTitle",
    bool_or("resolvedMasterId" IS NOT NULL) AS "isMapped",
    MAX("resolvedMasterId") AS "masterItemId"
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

    const [ownPriceLists, activeAssignments] = await Promise.all([
      prisma.priceList.findMany({
        where: { businessId, ...categoryFilter },
        select: {
          id: true,
          updatedAt: true,
          business: { select: { id: true, name: true, legalName: true } },
        },
      }),
      prisma.priceAssignment.findMany({
        where: {
          counterpartyBusinessId: businessId,
          status: 'ACTIVE',
          priceList: categoryFilter,
        },
        select: {
          priceList: {
            select: {
              id: true,
              updatedAt: true,
              business: { select: { id: true, name: true, legalName: true } },
            },
          },
        },
      }),
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
    for (const a of activeAssignments) {
      const pl = a.priceList
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
