import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import BusinessProfileEditor from './BusinessProfileEditor'

interface PageProps {
  params: {
    id: string
  }
}

export default async function BusinessProfilePage({ params }: PageProps) {
  const business = await prisma.business.findUnique({
    where: { id: params.id },
    include: {
      portfolios: {
        orderBy: { order: 'asc' },
      },
      _count: {
        select: {
          portfolios: true,
        },
      },
    },
  })

  if (!business) {
    notFound()
  }

  return <BusinessProfileEditor business={business} />
}
