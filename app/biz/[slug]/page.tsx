import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ShowcaseView from '@/components/showcase/ShowcaseView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: {
    slug: string
  }
}

export default async function BizPage({ params }: PageProps) {
  const raw = params.slug

  // 1) decodeURIComponent и нормализация
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    // если decode ломается, продолжаем с raw
  }
  const normalized = decoded.normalize('NFC')

  // 2) Кандидат для поиска в БД — всегда в нижнем регистре
  const candidate = normalized.toLowerCase()

  const business = await prisma.business.findUnique({
    where: { slug: candidate },
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

  // 3) Если не найдено — 404
  if (!business) {
    notFound()
  }

  // 4) Если нормализованное значение не совпадает с каноническим slug в БД,
  // делаем redirect на канонический URL (всегда нижний регистр)
  if (normalized !== business.slug) {
    redirect(`/biz/${business.slug}`)
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
    <main
      style={{
        minHeight: '100vh',
        background: '#f3f4f6',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <Link
            href="/visitor"
            style={{
              display: 'inline-block',
              marginBottom: '1rem',
              color: '#2563eb',
              textDecoration: 'none',
              fontSize: '0.95rem',
            }}
          >
            ← Назад к списку бизнесов
          </Link>
        </header>

        <ShowcaseView business={viewBusiness} mode="public" />
      </div>
    </main>
  )
}
