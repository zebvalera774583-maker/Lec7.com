import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import {
  getBusinessIdFromPath,
  assertFileSize,
  parseFileToItems,
} from '@/lib/price-import'

const withOfficeAuth = (handler: (req: NextRequest, user: { id: string; role: string }) => Promise<NextResponse>) =>
  requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

const ALLOWED_EXT = ['.xlsx', '.xls', '.csv']

export const POST = withOfficeAuth(async (req: NextRequest, user) => {
  try {
    const pathname = new URL(req.url).pathname
    const businessId = getBusinessIdFromPath(pathname)
    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    })
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }
    if (user.role !== 'LEC7_ADMIN' && business.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
        { error: 'Неподдерживаемый формат. Используйте .xlsx, .xls или .csv' },
        { status: 400 }
      )
    }

    assertFileSize(file.size)

    const buffer = Buffer.from(await file.arrayBuffer())
    const { items, warnings } = parseFileToItems(buffer, file.name, file.type)

    return NextResponse.json({ items, warnings })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    if (message.includes('Файл') || message.includes('формат') || message.includes('МБ')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('Parse price import error:', err)
    return NextResponse.json({ error: 'Ошибка при разборе файла' }, { status: 500 })
  }
})
