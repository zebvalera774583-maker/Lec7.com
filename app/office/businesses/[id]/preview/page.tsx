import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ShowcaseView from '@/components/showcase/ShowcaseView'
import ShowcaseShell from '@/components/showcase/ShowcaseShell'

interface PageProps {
  params: {
    id: string
  }
}

export default async function BusinessPreviewPage({ params }: PageProps) {
  const business = await prisma.business.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      category: true,
      profile: {
        select: { avatarUrl: true },
      },
      photos: {
        select: {
          id: true,
          url: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: 'asc' },
        take: 12,
      },
      portfolioItems: {
        select: {
          id: true,
          comment: true,
          coverUrl: true,
          sortOrder: true,
          photos: {
            select: {
              id: true,
              url: true,
              sortOrder: true,
            },
            orderBy: { sortOrder: 'asc' },
            take: 12,
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!business) {
    notFound()
  }

  const viewBusiness = {
    id: business.id,
    slug: business.slug,
    name: business.name,
    city: business.city,
    category: business.category,
    avatarUrl: business.profile?.avatarUrl ?? null,
    photos: business.photos,
    portfolioItems: business.portfolioItems,
  }

  return (
    <ShowcaseShell
      backLink={{
        href: `/office/businesses/${business.id}/profile`,
        label: '← Вернуться в кабинет',
      }}
    >
      <ShowcaseView business={viewBusiness} mode="resident" />
    </ShowcaseShell>
  )
}

