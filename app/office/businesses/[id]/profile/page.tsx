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
    select: {
      id: true,
      slug: true,
      portfolios: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!business) {
    notFound()
  }

  return (
    <BusinessProfileEditor
      businessId={business.id}
      businessSlug={business.slug}
      portfolioCount={business.portfolios.length}
    />
  )
}
