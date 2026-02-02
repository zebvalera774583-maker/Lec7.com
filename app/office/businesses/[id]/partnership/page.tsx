import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PartnershipPageClient from './PartnershipPageClient'

interface PageProps {
  params: {
    id: string
  }
}

export default async function PartnershipPage({ params }: PageProps) {
  const business = await prisma.business.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      slug: true,
      telegramChatId: true,
    },
  })

  if (!business) {
    notFound()
  }

  return <PartnershipPageClient businessId={business.id} telegramChatId={business.telegramChatId} />
}
