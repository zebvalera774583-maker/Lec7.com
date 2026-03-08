/**
 * Страница просмотра заявки.
 * UI таблица (Наименование/Вес): источник данных — IncomingRequest.items (Orchestrator) или MaxRequestLink.itemsJson.
 * Comments — только в блоке «Комментарий», НЕ добавляются в таблицу позиций.
 * Fallback: parseMaxRequestToRows(description) только когда нет items (legacy).
 */
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
  const perfTotal = 'PERF:request-detail:total'
  const perfAuth = 'PERF:request-detail:auth'
  const perfRequest = 'PERF:request-detail:request'
  const perfIncoming = 'PERF:request-detail:incoming+items'
  const perfMaxLink = 'PERF:request-detail:maxRequestLink'
  const perfParse = 'PERF:request-detail:parseFallback'
  console.time(perfTotal)

  console.time(perfAuth)
  const user = getAuthUserFromContext({
    headers: { get: (name: string) => headers().get(name) },
    cookies: {
      get: (name: string) => {
        const c = cookies().get(name)
        return c ? { value: c.value } : undefined
      },
    },
  })
  console.timeEnd(perfAuth)
  if (!user) notFound()

  // PERF: request и incomingRequest параллельно — независимые запросы по params.requestId
  console.time(perfRequest)
  console.time(perfIncoming)
  const [request, incoming] = await Promise.all([
    prisma.request.findUnique({
      where: { id: params.requestId },
      include: { business: { select: { id: true, name: true, ownerId: true } } },
    }),
    prisma.incomingRequest.findFirst({
      where: { requestId: params.requestId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    }),
  ])
  console.timeEnd(perfRequest)
  console.timeEnd(perfIncoming)
  if (!request || request.businessId !== params.id) notFound()
  if (user.role !== 'LEC7_ADMIN' && request.business?.ownerId !== user.id) notFound()
  let itemsJson: unknown = null
  const commentsText = incoming?.commentsText ?? null
  const departmentSlug = incoming?.department ?? null
  const DEPT_LABELS: Record<string, string> = {
    voikovo_kitchen: 'Войково кухня',
    voikovo_bar: 'Войково бар',
    navaginskaya_kitchen: 'Навагин кухня',
    navaginskaya_bar: 'Навагин бар',
    moremall_kitchen: 'ММ кухня',
    moremall_bar: 'ММ бар',
  }
  const department = departmentSlug ? (DEPT_LABELS[departmentSlug] ?? departmentSlug) : null
  if (incoming?.items?.length) {
    itemsJson = incoming.items.map((it) => ({
      title: it.name,
      qty: it.quantity,
      unit: it.unit,
    }))
  } else {
    // PERF: выполняется только если incoming.items пусто — дополнительный round-trip к БД
    console.time(perfMaxLink)
    const link = await prisma.maxRequestLink.findFirst({
      where: { requestId: params.requestId },
      select: { itemsJson: true },
    })
    console.timeEnd(perfMaxLink)
    itemsJson = link?.itemsJson ?? null
  }
  // Если нет распарсенных позиций — парсим description (legacy, поддержка дефиса: Картофель-5кг)
  // Таблица строится ТОЛЬКО из items (Orchestrator/MaxRequestLink). Comments — только в блоке «Комментарий».
  if ((!itemsJson || (Array.isArray(itemsJson) && itemsJson.length === 0)) && request.description) {
    console.time(perfParse)
    const parsed = parseMaxRequestToRows(request.title || '', request.description)
    if (parsed.length > 0) {
      itemsJson = parsed.map((r) => ({ title: r.name, qty: r.quantity, unit: r.unit }))
    }
    console.timeEnd(perfParse)
  }

  console.timeEnd(perfTotal)

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
