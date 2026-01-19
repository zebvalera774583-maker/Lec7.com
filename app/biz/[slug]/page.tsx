import Link from 'next/link'
import { notFound } from 'next/navigation'
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
  let slug = raw
  try {
    slug = decodeURIComponent(raw)
  } catch {}
  slug = slug.normalize('NFC')

  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      category: true,
      profile: {
        select: { avatarUrl: true },
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
