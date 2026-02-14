import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/middleware'
import {
  assertFileSize,
  extractTextFromPdf,
  extractTextFromDocx,
  parsePricelistToStructuredJSON,
} from '@/lib/price-import'

const withOfficeAuth = (handler: (req: NextRequest, user: { id: string; role: string }) => Promise<NextResponse>) =>
  requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

const ALLOWED_EXT = ['.pdf', '.docx', '.doc']

export const POST = withOfficeAuth(async (req: NextRequest) => {
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
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json(
        { error: 'Неподдерживаемый формат. Используйте .pdf, .docx или .doc' },
        { status: 400 }
      )
    }

    if (ext === '.doc') {
      return NextResponse.json({ error: 'DOC пока не поддержан' }, { status: 400 })
    }

    assertFileSize(file.size)

    const buffer = Buffer.from(await file.arrayBuffer())
    const mimetype = (file.type || '').toLowerCase()

    let text: string

    if (ext === '.pdf' || mimetype === 'application/pdf') {
      text = await extractTextFromPdf(buffer)
    } else if (ext === '.docx' || mimetype.includes('wordprocessingml') || mimetype.includes('docx')) {
      text = await extractTextFromDocx(buffer)
    } else {
      return NextResponse.json({ error: 'Неподдерживаемый формат' }, { status: 400 })
    }

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'Не удалось извлечь текст из файла' },
        { status: 400 }
      )
    }

    const result = await parsePricelistToStructuredJSON(text)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    if (message.includes('Файл') || message.includes('формат') || message.includes('МБ')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('Pricelists parse error:', err)
    const isKnown =
      message.includes('AI gateway') ||
      message.includes('AI returned') ||
      message.includes('Empty AI') ||
      message.includes('Не удалось извлечь') ||
      message.includes('Could not find') ||
      message.includes('valid .docx') ||
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND')
    return NextResponse.json(
      { error: isKnown ? message : 'Ошибка при разборе файла' },
      { status: isKnown ? 502 : 500 }
    )
  }
})
