import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withBusinessAccess } from '@/lib/access'
import { parsePriceValue } from '@/lib/parsePrice'
import { ensureActiveCounterparty } from '@/lib/activeCounterparty'
import { activatePriceAssignmentExclusive } from '@/lib/priceAssignmentExclusive'
import { buildCatalogNormMap, normalizeForMatch } from '@/lib/catalog-match'

export const GET = withBusinessAccess(async (req, user) => {
  try {
    const url = new URL(req.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0]

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

    // Получаем список прайсов
    const priceLists = await prisma.priceList.findMany({
      where: { businessId },
      select: {
        id: true,
        name: true,
        kind: true,
        category: true,
        derivedFromId: true,
        modifierType: true,
        percent: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            rows: true,
            assignments: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(priceLists)
  } catch (error) {
    console.error('Get price lists error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})

// POST для создания нового прайса
export const POST = withBusinessAccess(async (req, user) => {
  try {
    const url = new URL(req.url)
    const businessId = url.pathname.split('/').slice(-2, -1)[0]

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

    const body = await req.json()
    const { name, kind, category, derivedFromId, modifierType, percent, columns, rows } = body

    const catalogNormMap = rows?.length ? await buildCatalogNormMap() : null

    // Создаём прайс в транзакции
    const result = await prisma.$transaction(async (tx) => {
      const priceList = await tx.priceList.create({
        data: {
          businessId,
          name: name || 'Прайс 1',
          kind: (kind || 'BASE') as 'BASE' | 'DERIVED',
          category: category || null,
          derivedFromId: derivedFromId || null,
          modifierType: modifierType ? (modifierType as 'MARKUP' | 'DISCOUNT') : null,
          percent: percent || null,
          columns: columns || null,
        },
      })

      // Копируем ACTIVE назначения с других прайсов поставщика (той же категории) —
      // чтобы новый прайс сразу был виден покупателям, у которых был принят старый
      const categoryVal = category || null
      const existingAssignments = await tx.priceAssignment.findMany({
        where: {
          status: 'ACTIVE',
          priceList: {
            businessId,
            id: { not: priceList.id },
            category: categoryVal,
          },
        },
        select: { counterpartyBusinessId: true },
        distinct: ['counterpartyBusinessId'],
      })
      if (existingAssignments.length > 0) {
        await tx.priceAssignment.createMany({
          data: existingAssignments.map((a) => ({
            priceListId: priceList.id,
            counterpartyBusinessId: a.counterpartyBusinessId,
            status: 'ACTIVE' as const,
          })),
          skipDuplicates: true,
        })
        for (const a of existingAssignments) {
          const row = await tx.priceAssignment.findUnique({
            where: {
              priceListId_counterpartyBusinessId: {
                priceListId: priceList.id,
                counterpartyBusinessId: a.counterpartyBusinessId,
              },
            },
            select: { id: true },
          })
          if (row) {
            await activatePriceAssignmentExclusive(tx, row.id)
          }
          await ensureActiveCounterparty(businessId, a.counterpartyBusinessId)
        }
      }

      // Если есть строки, создаём их
      if (rows && Array.isArray(rows) && rows.length > 0) {
        const rowsToCreate = rows.map((row: any, index: number) => {
          let priceWithVatNum: number | null = null
          let priceWithoutVatNum: number | null = null

          if (row.priceWithVat != null && String(row.priceWithVat).trim() !== '') {
            const parsed = parsePriceValue(row.priceWithVat)
            if (parsed != null) priceWithVatNum = parsed
          }

          if (row.priceWithoutVat != null && String(row.priceWithoutVat).trim() !== '') {
            const parsed = parsePriceValue(row.priceWithoutVat)
            if (parsed != null) priceWithoutVatNum = parsed
          }

          const normName = normalizeForMatch(row.name || '')
          const masterItemId = catalogNormMap && normName ? (catalogNormMap.get(normName) ?? null) : null
          return {
            priceListId: priceList.id,
            order: index + 1,
            name: row.name || '',
            unit: row.unit || null,
            priceWithVat: priceWithVatNum,
            priceWithoutVat: priceWithoutVatNum,
            extra: row.extra || null,
            masterItemId,
          }
        })

        if (rowsToCreate.length > 0) {
          await tx.priceListRow.createMany({
            data: rowsToCreate,
          })
        }
      }

      return priceList
    })

    return NextResponse.json({ success: true, id: result.id })
  } catch (error: any) {
    console.error('Create price list error:', error)
    const errorMessage = error?.message || 'Internal Server Error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
})
