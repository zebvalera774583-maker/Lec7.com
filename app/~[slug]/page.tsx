import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: {
    slug: string
  }
}

export default async function PublicBusinessPage({ params }: PageProps) {
  // Декодируем slug из URL
  let slug = params.slug
  try {
    slug = decodeURIComponent(params.slug)
  } catch {
    // Если декодирование не удалось, используем как есть
  }
  slug = slug.normalize('NFC')

  // Находим бизнес по slug
  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      category: true,
      lifecycleStatus: true,
      billingStatus: true,
    },
  })

  // Если бизнес не найден → 404
  if (!business) {
    notFound()
  }

  // Если бизнес не активен → 404
  // (Billing-гейт пока не включаем, только lifecycleStatus)
  if (business.lifecycleStatus !== 'ACTIVE') {
    notFound()
  }

  // Формируем подзаголовок (город/категория)
  const subtitleParts: string[] = []
  if (business.city) {
    subtitleParts.push(business.city)
  }
  if (business.category) {
    subtitleParts.push(business.category)
  }
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' • ') : null

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#ffffff',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ maxWidth: '800px', width: '100%', textAlign: 'center' }}>
        <header style={{ marginBottom: '3rem' }}>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              marginBottom: '2rem',
              color: '#0070f3',
              textDecoration: 'none',
              fontSize: '1rem',
            }}
          >
            ← На главную
          </Link>

          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: '0 0 1rem 0',
              lineHeight: '1.2',
            }}
          >
            {business.name}
          </h1>

          {subtitle && (
            <p
              style={{
                color: '#666',
                fontSize: '1.1rem',
                margin: 0,
                lineHeight: '1.6',
              }}
            >
              {subtitle}
            </p>
          )}
        </header>

        <div
          style={{
            padding: '3rem 2rem',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
          }}
        >
          <p
            style={{
              fontSize: '1.1rem',
              color: '#6b7280',
              margin: 0,
              lineHeight: '1.6',
            }}
          >
            Скоро здесь будет витрина
          </p>
        </div>
      </div>
    </main>
  )
}
