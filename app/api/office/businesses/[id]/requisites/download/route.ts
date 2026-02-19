import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/middleware'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'

const withOfficeAuth = (handler: any) => requireRole(['BUSINESS_OWNER', 'LEC7_ADMIN'], handler)

const LABELS: Record<string, string> = {
  legalName: 'Юридическое название',
  address: 'Адрес',
  ogrn: 'ОГРН',
  inn: 'ИНН',
  bankAccount: 'р/сч',
  bank: 'Банк',
  bankCorrAccount: 'к/сч',
  bik: 'БИК',
  requisitesPhone: 'Телефон',
  requisitesEmail: 'Электронный адрес',
  director: 'Директор или ИП',
}

export const POST = withOfficeAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const businessId = pathParts[pathParts.indexOf('businesses') + 1]

    if (!businessId) {
      return NextResponse.json({ error: 'business id is required' }, { status: 400 })
    }

    const accessBusiness = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true },
    })

    if (!accessBusiness) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (user.role !== 'LEC7_ADMIN' && accessBusiness.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const requisites = body as Record<string, string | null>

    const children: Paragraph[] = [
      new Paragraph({
        text: 'Реквизиты предприятия',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 400 },
      }),
    ]

    for (const [key, label] of Object.entries(LABELS)) {
      const val = requisites[key]
      if (val && String(val).trim()) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${label}: `, bold: true }),
              new TextRun({ text: String(val) }),
            ],
            spacing: { after: 200 },
          }),
        )
      }
    }

    if (children.length === 1) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Реквизиты не заполнены' })],
        }),
      )
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    })

    const buffer = Buffer.from(await Packer.toBuffer(doc))

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="rekvizity.docx"',
      },
    })
  } catch (error) {
    console.error('Download requisites error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
})
