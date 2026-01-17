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

  // Находим бизнес по slug с профилем
  const business = await prisma.business.findUnique({
    where: { slug },
    include: {
      profile: true,
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

  // Используем данные из профиля или fallback на бизнес
  const displayName = business.profile?.displayName || business.name
  const profileCities = business.profile?.cities || []
  const profileServices = business.profile?.services || []
  const stats = business.profile
    ? {
        cases: business.profile.statsCases,
        projects: business.profile.statsProjects,
        cities: business.profile.statsCities,
      }
    : null

  // Формируем подзаголовок (города из профиля или fallback на city/category)
  const subtitleParts: string[] = []
  if (profileCities.length > 0) {
    subtitleParts.push(...profileCities)
  } else if (business.city) {
    subtitleParts.push(business.city)
  }
  if (!profileCities.length && business.category) {
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

          {business.profile?.avatarUrl && (
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: `url(${business.profile.avatarUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                margin: '0 auto 1.5rem',
                border: '3px solid #e5e7eb',
              }}
            />
          )}

          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: '0 0 1rem 0',
              lineHeight: '1.2',
            }}
          >
            {displayName}
          </h1>

          {subtitle && (
            <p
              style={{
                color: '#666',
                fontSize: '1.1rem',
                margin: '0 0 2rem 0',
                lineHeight: '1.6',
              }}
            >
              {subtitle}
            </p>
          )}

          {/* Метрики */}
          {stats && (
            <div
              style={{
                display: 'flex',
                gap: '2rem',
                justifyContent: 'center',
                marginBottom: '2rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1a1a1a' }}>
                  {stats.cases}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>уникальных кейсов</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1a1a1a' }}>
                  {stats.projects}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>проектов</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1a1a1a' }}>
                  {stats.cities}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>городов</div>
              </div>
            </div>
          )}

          {/* Услуги */}
          {profileServices.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Услуги</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                {profileServices.map((service) => (
                  <span
                    key={service}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#f3f4f6',
                      borderRadius: '20px',
                      fontSize: '0.875rem',
                      color: '#374151',
                    }}
                  >
                    {service}
                  </span>
                ))}
              </div>
            </div>
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
