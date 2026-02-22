import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import RequisitesPageClient from './RequisitesPageClient'

interface PageProps {
  params: { id: string }
}

export default async function RequisitesPage({ params }: PageProps) {
  const business = await prisma.business.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!business) notFound()
  return <RequisitesPageClient businessId={business.id} />
}