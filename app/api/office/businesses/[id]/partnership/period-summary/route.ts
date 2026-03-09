import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess, getBusinessIdFromPath } from '@/lib/access'
import {
  buildCatalogMaps,
  buildOfferMaps,
  processRequestItemsToResult,
  getAggregationKey,
  normalizeUnitForComparison,
} from '@/lib/summary-pipeline'
import { normalizeForMatch } from '@/lib/catalog-match'

const DEFAULT_CATEGORY = 'Свежая плодоовощная продукция'

/** Безопасный парсинг количества: "0,05" → 0.05, "0,100" → 0.1 */
function parseQuantity(value: string | null | undefined): number {
  const s = (value ?? '').trim().replace(',', '.')
  if (!s) return 0
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}

/** Парсинг позиций из description/title заявки MAX */
function parseMaxRequestToRows(title: string, description: string): { name: string; quantity: string; unit: string }[] {
  const text = (description || title || '').trim()
  if (!text) return []
  const cleanTitle = (title || '').replace(/^Заявка из MAX:\s*/i, '').trim()
  const src = description || cleanTitle || text
  const rows: { name: string; quantity: string; unit: string }[] = []
  const re = /([^\d]+?)[\s\-]+(\d+(?:[.,]\d+)?)\s*(кг|шт|т|л|м|ед)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const name = m[1].trim()
    const quantity = m[2].replace(',', '.')
    const unit = ((m[3] || 'шт') as string).toLowerCase()
    if (name) rows.push({ name, quantity, unit })
  }
  if (rows.length === 0) rows.push({ name: src, quantity: '1', unit: 'шт' })
  return rows
}

export const GET = withBusinessAccess(async (req) => {
  try {
    const pathname = new URL(req.url).pathname
    const businessId = getBusinessIdFromPath(pathname)
    const url = new URL(req.url)
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const fromDate = dateFrom ? new Date(dateFrom) : null
    const toDate = dateTo ? new Date(dateTo) : null
    if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return NextResponse.json({ error: 'Укажите dateFrom и dateTo (YYYY-MM-DD)' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const DEPT_ORDER = ['voikovo_kitchen', 'voikovo_bar', 'navaginskaya_kitchen', 'navaginskaya_bar', 'moremall_kitchen', 'moremall_bar'] as const
    const DEPT_LABELS: Record<string, string> = {
      voikovo_kitchen: 'Войково кухня',
      voikovo_bar: 'Войково бар',
      navaginskaya_kitchen: 'Навагин кухня',
      navaginskaya_bar: 'Навагин бар',
      moremall_kitchen: 'ММ кухня',
      moremall_bar: 'ММ бар',
    }

    const requests = await prisma.request.findMany({
      where: {
        businessId,
        source: 'max_integration',
        status: { not: 'ARCHIVED' },
        createdAt: {
          gte: fromDate,
          lte: new Date(toDate.getTime() + 86400000),
        },
        incomingRequest: { is: { department: { not: null } } },
      },
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        createdAt: true,
        incomingRequest: { select: { department: true, items: { orderBy: { sortOrder: 'asc' }, select: { name: true, quantity: true, unit: true } } } },
      },
    })

    const catalogMaps = await buildCatalogMaps()
    const { normToId, masterToCanonical } = catalogMaps

    type AggRow = { masterItemId: string | null; norm: string; displayName: string; quantity: number; unit: string }
    type GroupKey = string
    const groups = new Map<GroupKey, { department: string; date: string; requestNumbers: number[]; agg: Map<string, AggRow> }>()

    function getRowsFromRequest(r: (typeof requests)[0]): { name: string; quantity: string; unit: string }[] {
      const ir = r.incomingRequest
      if (ir?.items?.length) {
        return ir.items.map((it) => ({ name: it.name, quantity: it.quantity, unit: it.unit }))
      }
      return parseMaxRequestToRows(r.title || '', r.description || '')
    }

    function rowToAggData(row: { name: string; unit: string }): { masterItemId: string | null; norm: string; displayName: string; unit: string } {
      const norm = normalizeForMatch(row.name)
      const masterItemId = norm ? (normToId.get(norm) ?? null) : null
      const displayName = masterItemId ? (masterToCanonical.get(masterItemId) ?? row.name.trim()) : row.name.trim()
      const unit = normalizeUnitForComparison(row.unit) || (row.unit || 'шт').toLowerCase()
      return { masterItemId, norm: norm || '', displayName, unit }
    }

    for (const r of requests) {
      const dept = r.incomingRequest?.department
      if (!dept || typeof dept !== 'string' || !dept.trim()) continue

      const dateStr = r.createdAt.toISOString().slice(0, 10)
      const groupKey = `${dateStr}|${dept}`

      let group = groups.get(groupKey)
      if (!group) {
        group = { department: dept, date: dateStr, requestNumbers: [], agg: new Map() }
        groups.set(groupKey, group)
      }

      if (r.number != null) group.requestNumbers.push(r.number)

      const rows = getRowsFromRequest(r)
      for (const row of rows) {
        const aggKey = getAggregationKey(row.name, row.unit, normToId)
        const qty = parseQuantity(row.quantity)
        const existing = group.agg.get(aggKey)
        if (existing) {
          existing.quantity += qty
        } else {
          const { masterItemId, norm, displayName, unit } = rowToAggData(row)
          group.agg.set(aggKey, { masterItemId, norm, displayName, quantity: qty, unit })
        }
      }
    }

    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      const orderA = DEPT_ORDER.indexOf(a.department as (typeof DEPT_ORDER)[number])
      const orderB = DEPT_ORDER.indexOf(b.department as (typeof DEPT_ORDER)[number])
      const idxA = orderA === -1 ? 999 : orderA
      const idxB = orderB === -1 ? 999 : orderB
      if (idxA !== idxB) return idxA - idxB
      return a.date.localeCompare(b.date)
    })

    if (sortedGroups.length === 0) {
      return NextResponse.json({
        sections: [],
        counterparties: [],
        message: 'Нет потребностей за выбранный период',
      })
    }

    const { offerMaps, counterparties } = await buildOfferMaps(businessId, DEFAULT_CATEGORY)

    const sections = sortedGroups.map((group) => {
      const requestItems = Array.from(group.agg.values())
        .filter((it) => it.displayName.length > 0 && it.quantity > 0)
        .map((it) => ({
          name: it.displayName,
          quantity: String(it.quantity),
          unit: it.unit,
          masterItemId: it.masterItemId,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

      const items = processRequestItemsToResult(
        requestItems,
        catalogMaps,
        offerMaps,
        counterparties
      )

      return {
        department: group.department,
        departmentLabel: DEPT_LABELS[group.department] ?? group.department,
        date: group.date,
        requestNumbers: [...new Set(group.requestNumbers)].sort((a, b) => a - b),
        items,
      }
    }).filter((s) => s.items.length > 0)

    return NextResponse.json({
      sections,
      counterparties,
    })
  } catch (error) {
    console.error('Period summary error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
