import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PartnershipPageClient from './PartnershipPageClient'

interface PageProps {
  params: {
    id: string
  }
}

function maskChatId(chatId: string): string {
  if (chatId.length <= 6) return '***'
  return chatId.slice(0, 3) + '***' + chatId.slice(-3)
}

export default async function PartnershipPage({ params }: PageProps) {
  const business = await prisma.business.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      slug: true,
      telegramChatId: true,
      telegramRecipients: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, chatId: true, label: true, isActive: true, createdAt: true },
      },
    },
  })

  if (!business) {
    notFound()
  }

  const recipients = business.telegramRecipients.map((r) => ({
    id: r.id,
    chatIdMasked: maskChatId(r.chatId),
    label: r.label,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  }))

  return (
    <PartnershipPageClient
      businessId={business.id}
      telegramChatId={business.telegramChatId}
      telegramRecipients={recipients}
    />
  )
}
