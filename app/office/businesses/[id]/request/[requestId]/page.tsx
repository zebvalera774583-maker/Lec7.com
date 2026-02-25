import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { getAuthUserFromContext } from '@/lib/middleware'
import { headers, cookies } from 'next/headers'
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

  const link = await prisma.maxRequestLink.findFirst({
    where: { requestId: params.requestId },
    select: { itemsJson: true },
  })
  const itemsJson = link?.itemsJson ?? null

  return (
    <RequestDetailClient
      businessId={params.id}
      itemsJson={itemsJson}
    />
  )
}
