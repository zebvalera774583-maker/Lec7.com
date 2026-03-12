/**
 * POST /api/integrations/max/parse-pdf
 * Принимает PDF (base64 в body.pdfBase64), возвращает текст заявки для бота.
 * Используется max-bot-service при получении PDF-вложения.
 */
import { NextRequest, NextResponse } from 'next/server'
import { parsePricelistFromPdfWithAIVisionOrFallback } from '@/lib/price-import'

const SECRET_HEADER = 'x-lec7-max-secret'

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.LEC7_MAX_SECRET
  if (expectedSecret) {
    const incoming = req.headers.get(SECRET_HEADER)
    if (incoming !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: { pdfBase64?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const pdfBase64 = typeof body?.pdfBase64 === 'string' ? body.pdfBase64 : ''
  if (!pdfBase64) {
    return NextResponse.json({ error: 'pdfBase64 is required' }, { status: 400 })
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(pdfBase64, 'base64')
  } catch {
    return NextResponse.json({ error: 'Invalid base64' }, { status: 400 })
  }

  if (buffer.length === 0) {
    return NextResponse.json({ error: 'Empty PDF' }, { status: 400 })
  }

  try {
    console.log('[MAX parse-pdf] start')
    const items = await parsePricelistFromPdfWithAIVisionOrFallback(buffer)
    console.log('[MAX parse-pdf] parsed items count=', items.length)
    // Формат заявки: "название кол-во ед" (price в прайсе = стоимость; для заявки используем 1 как кол-во)
    const text = items
      .map((it) => `${(it.title || '').trim()} 1 ${(it.unit || 'шт').trim()}`.trim())
      .filter(Boolean)
      .join('\n')

    return NextResponse.json({ text, itemsCount: items.length })
  } catch (e) {
    console.error('[MAX parse-pdf]', e)
    const msg = e instanceof Error ? e.message : 'Parse failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
