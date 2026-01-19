import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ShowcaseView from '@/components/showcase/ShowcaseView'

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
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f3f4f6',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <header
          style={{
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link
              href={`/office/businesses/${business.id}/profile`}
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                color: '#374151',
                fontSize: '0.9rem',
                textDecoration: 'none',
              }}
            >
              ← Вернуться в кабинет
            </Link>
            <Link
              href="/visitor"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: '#f9fafb',
                color: '#374151',
                fontSize: '0.9rem',
                textDecoration: 'none',
              }}
            >
              Перейти в visitor
            </Link>
          </div>
          <span
            style={{
              fontSize: '0.8rem',
              color: '#6b7280',
            }}
          >
            Превью витрины (только просмотр)
          </span>
        </header>

        <ShowcaseView business={viewBusiness} mode="resident" />
      </div>
    </main>
  )
}

