import { NextRequest, NextResponse } from 'next/server'
import { processOrderImage } from '@/lib/ocr/orderImage'

/**
 * POST /api/ocr/order-image
 * Accepts multipart image (field: image) or JSON { image: "base64..." }.
 * Returns { text, items, subdivision }.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? ''
    let buffer: Buffer

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('image') ?? formData.get('file')
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: 'Image file required (field: image or file)' }, { status: 400 })
      }
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
      }
      const arrayBuffer = await file.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    } else if (contentType.includes('application/json')) {
      const body = await req.json()
      const base64 = typeof body?.image === 'string' ? body.image : null
      if (!base64) {
        return NextResponse.json({ error: 'JSON body must include image (base64 string)' }, { status: 400 })
      }
      const match = base64.match(/^data:image\/[a-z]+;base64,(.+)$/i)
      const data = match ? match[1] : base64
      buffer = Buffer.from(data, 'base64')
      if (buffer.length === 0) {
        return NextResponse.json({ error: 'Invalid base64 image' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Content-Type must be multipart/form-data or application/json' }, { status: 400 })
    }

    const result = await processOrderImage(buffer)
    return NextResponse.json(result)
  } catch (e) {
    console.error('[OCR order-image] error:', e)
    return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
  }
}
