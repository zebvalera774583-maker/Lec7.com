import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PriceCompareClient from './PriceCompareClient'

interface PageProps {
  params: {
    id: string
  }
}

export default async function PriceComparePage({ params }: PageProps) {
  const business = await prisma.business.findUnique({
    where: { id: params.id },
    select: { id: true, slug: true },
  })

  if (!business) {
    notFound()
  }

  return <PriceCompareClient businessId={business.id} />
}
