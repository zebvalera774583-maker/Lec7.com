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
  const departmentSlug = incoming?.department ?? null
  const DEPT_LABELS: Record<string, string> = {
    voikovo_kitchen: 'Войково кухня',
    voikovo_bar: 'Войково бар',
    navaginskaya_kitchen: 'Навагинская кухня',
    navaginskaya_bar: 'Навагинская бар',
    moremall_kitchen: 'МореМолл кухня',
    moremall_bar: 'МореМолл бар',
  }
  const department = departmentSlug ? (DEPT_LABELS[departmentSlug] ?? departmentSlug) : null
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
  // Позиции из комментария (не сопоставленные с каталогом при создании, напр. реган 0,05 кг) — добавляем в таблицу
  if (commentsText && commentsText.trim()) {
    const fromComments = parseMaxRequestToRows('', commentsText)
    const existing = (Array.isArray(itemsJson) ? itemsJson : []) as { title?: string; qty?: string; unit?: string }[]
    const existingNames = new Set(existing.map((it) => (it.title || '').toLowerCase().trim()))
    for (const r of fromComments) {
      const nameNorm = r.name.toLowerCase().trim()
      if (nameNorm && !existingNames.has(nameNorm)) {
        existing.push({ title: r.name, qty: r.quantity, unit: r.unit })
        existingNames.add(nameNorm)
      }
    }
    if (existing.length > 0) itemsJson = existing
  }

  return (
    <RequestDetailClient
      businessId={params.id}
      itemsJson={itemsJson}
      descriptionFallback={request.description}
      commentsText={commentsText}
      department={department}
    />
  )
}
