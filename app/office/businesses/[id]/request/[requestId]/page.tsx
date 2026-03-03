import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { getAuthUserFromContext } from '@/lib/middleware'
import { headers, cookies } from 'next/headers'
import { parseMaxRequestToRows } from '@/lib/parseMaxRequest'
import RequestDetailClient from './RequestDetailClient'

interface PageProps {
  params: { id: string; requestId: string }
}

export default async function RequestDetailPage({ params }: PageProps) {
  const user = getAuthUserFromContext({
    headers: { get: (name: string) => headers().get(name) },
    cookies: {
      get: (name: string) => {
        const c = cookies().get(name)
        return c ? { value: c.value } : undefined
      },
    },
  })
  if (!user) notFound()

  const request = await prisma.request.findUnique({
    where: { id: params.requestId },
    include: { business: { select: { id: true, name: true, ownerId: true } } },
  })
  if (!request || request.businessId !== params.id) notFound()
  if (user.role !== 'LEC7_ADMIN' && request.business?.ownerId !== user.id) notFound()

  // Сначала пробуем IncomingRequest (заявки из бота MAX/Telegram)
  const incoming = await prisma.incomingRequest.findFirst({
    where: { requestId: params.requestId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  let itemsJson: unknown = null
  const commentsText = incoming?.commentsText ?? null
  if (incoming?.items?.length) {
    itemsJson = incoming.items.map((it) => ({
      title: it.name,
      qty: it.quantity,
      unit: it.unit,
    }))
  } else {
    const link = await prisma.maxRequestLink.findFirst({
      where: { requestId: params.requestId },
      select: { itemsJson: true },
    })
    itemsJson = link?.itemsJson ?? null
  }
  // Если нет распарсенных позиций — парсим description (поддержка дефиса: Картофель-5кг)
  if ((!itemsJson || (Array.isArray(itemsJson) && itemsJson.length === 0)) && request.description) {
    const parsed = parseMaxRequestToRows(request.title || '', request.description)
    if (parsed.length > 0) {
      itemsJson = parsed.map((r) => ({ title: r.name, qty: r.quantity, unit: r.unit }))
    }
  }

  return (
    <RequestDetailClient
      businessId={params.id}
      itemsJson={itemsJson}
      descriptionFallback={request.description}
      commentsText={commentsText}
    />
  )
}
