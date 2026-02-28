import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

const SCOPE_GLOBAL = 'GLOBAL'

function findCol(headers: string[], names: string[]): number | undefined {
  const norm = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, '').replace(/_/g, '')
  const normalized = headers.map(norm)
  for (const name of names) {
    const n = norm(name)
    const idx = normalized.findIndex((h) => h === n || h.includes(n) || n.includes(h))
    if (idx >= 0) return idx
  }
  return undefined
}

function normalizeCanonicalName(val: unknown): string {
  const s = String(val ?? '').trim()
  return s.replace(/\s+/g, ' ')
}

function normalizeSynonyms(val: unknown): string[] {
  if (val == null || val === '') return []
  const s = String(val)
  const parts = s.split(/[,\n]+/).map((p) => p.trim().toLowerCase()).filter(Boolean)
  return [...new Set(parts)]
}

function normalizeDefaultUnit(val: unknown): string | null {
  const s = String(val ?? '').trim().toLowerCase()
  return s || null
}

function parseIsActive(val: unknown): boolean {
  if (val == null || val === '') return true
  const s = String(val).trim().toLowerCase()
  if (['true', '1', 'да', 'yes', 'д'].includes(s)) return true
  if (['false', '0', 'нет', 'no', 'н'].includes(s)) return false
  return true
}

export const POST = requireRole(['LEC7_ADMIN'], async (req) => {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Файл не передан. Отправьте поле file в multipart/form-data' },
        { status: 400 }
      )
    }

    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '')
    if (ext !== '.xlsx') {
      return NextResponse.json(
        { error: 'Только формат .xlsx поддерживается' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
    const firstSheet = wb.SheetNames[0]
    if (!firstSheet) {
      return NextResponse.json({ error: 'Файл не содержит листов' }, { status: 400 })
    }
    const ws = wb.Sheets[firstSheet]
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false }) as string[][]

    if (rows.length < 2) {
      return NextResponse.json(
        { inserted: 0, updated: 0, skipped: 0, errors: ['Файл пуст или содержит только заголовок'] },
        { status: 200 }
      )
    }

    const headerRow = rows[0].map((c) => String(c ?? '').trim())
    const canonicalCol = findCol(headerRow, ['canonicalname', 'canonical_name', 'name', 'наименование']) ?? 0
    const synonymsCol = findCol(headerRow, ['synonyms', 'синонимы'])
    const defaultUnitCol = findCol(headerRow, ['defaultunit', 'default_unit', 'unit', 'едизм', 'ед.изм'])
    const isActiveCol = findCol(headerRow, ['isactive', 'is_active', 'active', 'активен'])

    let inserted = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || []
      const canonicalRaw = row[canonicalCol] ?? row[0]
      const canonicalName = normalizeCanonicalName(canonicalRaw)

      if (!canonicalName) {
        skipped++
        errors.push(`Строка ${i + 1}: отсутствует canonicalName`)
        continue
      }

      const synonymsRaw = synonymsCol !== undefined ? row[synonymsCol] : undefined
      const defaultUnitRaw = defaultUnitCol !== undefined ? row[defaultUnitCol] : undefined
      const isActiveRaw = isActiveCol !== undefined ? row[isActiveCol] : undefined

      const synonyms = normalizeSynonyms(synonymsRaw)
      const defaultUnit = normalizeDefaultUnit(defaultUnitRaw)
      const isActive = parseIsActive(isActiveRaw)

      const existing = await prisma.botCatalogItem.findUnique({
        where: {
          scope_canonicalName: { scope: SCOPE_GLOBAL, canonicalName },
        },
      })

      if (existing) {
        const mergedSynonyms = [...new Set([...existing.synonyms, ...synonyms])]
        await prisma.botCatalogItem.update({
          where: { id: existing.id },
          data: {
            synonyms: mergedSynonyms,
            ...(defaultUnit !== null && { defaultUnit }),
            ...(isActiveCol !== undefined && { isActive }),
          },
        })
        updated++
      } else {
        await prisma.botCatalogItem.create({
          data: {
            scope: SCOPE_GLOBAL,
            canonicalName,
            synonyms,
            defaultUnit,
            isActive,
          },
        })
        inserted++
      }
    }

    return NextResponse.json({
      inserted,
      updated,
      skipped,
      errors: errors.slice(0, 5),
    })
  } catch (err) {
    console.error('Bot catalog import error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
})
