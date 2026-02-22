import { NextResponse } from 'next/server'
import { withBusinessAccess } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import {
  getBusinessIdFromPath,
  assertFileSize,
  parseFileToItems,
  extractTextFromPdf,
  extractTextFromDocx,
  parsePricelistWithAI,
} from '@/lib/price-import'

const ALLOWED_EXT = ['.xlsx', '.xls', '.csv', '.pdf', '.docx']

export const POST = withBusinessAccess(async (req, user) => {
  try {
    const pathname = new URL(req.url).pathname
    const businessId = getBusinessIdFromPath(pathname)
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

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Файл не передан. Отправьте поле file в multipart/form-data' },
        { status: 400 }
      )
    }

    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '')
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json(
        { error: 'Неподдерживаемый формат. Используйте .xlsx, .xls, .csv, .pdf или .docx' },
        { status: 400 }
      )
    }

    assertFileSize(file.size)

    const buffer = Buffer.from(await file.arrayBuffer())
    const mimetype = (file.type || '').toLowerCase()

    let items: Awaited<ReturnType<typeof parseFileToItems>>['items']
    let warnings: string[] = []

    if (ext === '.pdf' || mimetype === 'application/pdf') {
      const text = await extractTextFromPdf(buffer)
      if (!text) {
        return NextResponse.json(
          { error: 'Не удалось извлечь текст из PDF' },
          { status: 400 }
        )
      }
      items = await parsePricelistWithAI(text)
      warnings = []
    } else if (ext === '.docx' || mimetype.includes('wordprocessingml') || mimetype.includes('docx')) {
      const text = await extractTextFromDocx(buffer)
      if (!text) {
        return NextResponse.json(
          { error: 'Не удалось извлечь текст из DOCX' },
          { status: 400 }
        )
      }
      items = await parsePricelistWithAI(text)
      warnings = []
    } else {
      const result = parseFileToItems(buffer, file.name, file.type)
      items = result.items
      warnings = result.warnings
    }

    return NextResponse.json({ items, warnings })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    if (message.includes('Файл') || message.includes('формат') || message.includes('МБ')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('Parse price import error:', err)
    // Пробрасываем понятные ошибки для PDF/DOCX (AI gateway, mammoth, fetch)
    const isKnown =
      message.includes('AI gateway') ||
      message.includes('AI returned') ||
      message.includes('Empty AI') ||
      message.includes('Не удалось') ||
      message.includes('Could not find') ||
      message.includes('valid .docx') ||
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND')
    const status = message.includes('Не удалось распознать') ? 400 : isKnown ? 502 : 500
    return NextResponse.json(
      { error: isKnown || message.includes('Не удалось распознать') ? message : 'Ошибка при разборе файла' },
      { status }
    )
  }
})
