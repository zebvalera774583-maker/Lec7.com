import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'

function parseSynonyms(val: unknown): string[] {
  if (val == null || val === '') return []
  const s = String(val)
  return s.split(/[,\n]+/).map((p) => p.trim().toLowerCase()).filter(Boolean)
}

function parseClarificationOptions(val: unknown): string[] {
  if (val == null || val === '') return []
  const s = String(val)
  const arr = s.split(/[,\n]+/).map((p) => p.trim()).filter(Boolean)
  const seen = new Set<string>()
  return arr.filter((p) => {
    const key = p.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const PATCH = requireRole(['LEC7_ADMIN'], async (req: NextRequest) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.indexOf('catalog') + 1]

    if (!id || id === 'import-xlsx') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const body = await req.json()
    const canonicalName = body.canonicalName != null ? String(body.canonicalName).trim() : undefined
    const defaultUnit = body.defaultUnit != null ? (String(body.defaultUnit).trim() || null) : undefined
    const isActive = body.isActive !== undefined ? !!body.isActive : undefined
    const synonyms = body.synonyms !== undefined ? parseSynonyms(body.synonyms) : undefined
    const requiresClarification = body.requiresClarification !== undefined ? !!body.requiresClarification : undefined
    let clarificationOptions: string[] | undefined
    if (requiresClarification !== undefined) {
      if (requiresClarification) {
        clarificationOptions = parseClarificationOptions(body.clarificationOptions)
        if (clarificationOptions.length < 2) {
          return NextResponse.json({ error: 'При включённом «Требует уточнения» нужно минимум 2 варианта' }, { status: 400 })
        }
      } else {
        clarificationOptions = []
      }
    }

    if (canonicalName !== undefined && !canonicalName) {
      return NextResponse.json({ error: 'canonicalName cannot be empty' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (canonicalName !== undefined) updateData.canonicalName = canonicalName
    if (defaultUnit !== undefined) updateData.defaultUnit = defaultUnit
    if (isActive !== undefined) updateData.isActive = isActive
    if (synonyms !== undefined) updateData.synonyms = synonyms
    if (requiresClarification !== undefined) updateData.requiresClarification = requiresClarification
    if (clarificationOptions !== undefined) updateData.clarificationOptions = clarificationOptions

    const item = await prisma.botCatalogItem.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(item)
  } catch (err: unknown) {
    console.error('Bot catalog update error:', err)
    if (err && typeof err === 'object' && 'code' in err) {
      if (err.code === 'P2025') {
        return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 })
      }
      if (err.code === 'P2002') {
        return NextResponse.json({ error: 'Запись с таким названием уже существует' }, { status: 409 })
      }
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
})

export const DELETE = requireRole(['LEC7_ADMIN'], async (req: NextRequest) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.indexOf('catalog') + 1]

    if (!id || id === 'import-xlsx') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await prisma.botCatalogItem.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Bot catalog delete error:', err)
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2025') {
      return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
})
