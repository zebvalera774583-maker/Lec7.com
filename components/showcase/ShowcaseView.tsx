'use client'

import React from 'react'

interface PortfolioItemPhoto {
  id: string
  url: string
  sortOrder: number
}

interface PortfolioItem {
  id: string
  comment: string | null
  coverUrl: string | null
  photos: PortfolioItemPhoto[]
}

interface ShowcaseBusiness {
  id: string
  slug: string
  name: string
  city?: string | null
  category?: string | null
  avatarUrl?: string | null
  profile?: {
    statsCases: number
    statsProjects: number
    statsCities: number
    cities: string[]
    services: string[]
  } | null
  photos?: Array<{
    id: string
    url: string
    sortOrder: number
  }>
  portfolioItems?: PortfolioItem[]
}

type ShowcaseMode = 'public' | 'resident'

interface ShowcaseViewProps {
  business: ShowcaseBusiness
  mode: ShowcaseMode
}

export default function ShowcaseView({ business, mode }: ShowcaseViewProps) {
  const cityLabel =
    business.city && business.city.trim().length > 0 ? business.city : 'Город не указан'
  const categoryLabel =
    business.category && business.category.trim().length > 0 ? business.category : 'Категория не указана'
  const subtitle = `${cityLabel} • ${categoryLabel}`

  const statsCases = business.profile?.statsCases ?? 40
  const statsProjects = business.profile?.statsProjects ?? 2578
  const statsCities = business.profile?.statsCities ?? 4

  const profileCities = business.profile?.cities ?? []
  const profileServices = business.profile?.services ?? []

  const initials =
    business.name && business.name.trim().length > 0
      ? business.name.trim().charAt(0).toUpperCase()
      : business.slug.charAt(0).toUpperCase()

  const photos = business.photos || []
  const portfolioItems = business.portfolioItems || []

  // Все фото из portfolioItems, если они есть, иначе — прямые фото бизнеса
  const galleryPhotos: PortfolioItemPhoto[] = (() => {
    const fromItems: PortfolioItemPhoto[] = []
    portfolioItems.forEach((item) => {
      item.photos.forEach((p) => fromItems.push(p))
    })
    if (fromItems.length > 0) return fromItems
    return photos
  })()

  const displayPhotos = galleryPhotos.slice(0, 6)
  const totalPages = Math.max(1, Math.ceil(Math.max(galleryPhotos.length, 1) / 6))

  return (
    <div
      style={{
        maxWidth: 960,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
      }}
    >
      {/* Карточка витрины по макету P3 */}
      <section
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 0,
          padding: '3rem 3rem 2.5rem',
        }}
      >
        {/* Hero */}
        <div
          style={{
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '2.4rem',
              fontWeight: 500,
              letterSpacing: '0.03em',
              color: '#111827',
            }}
          >
            {business.name}
          </h1>

          <div
            style={{
              marginTop: '1.9rem',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                backgroundColor: '#dde1e7',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {business.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={business.avatarUrl}
                  alt={business.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <span style={{ fontSize: '3rem', fontWeight: 500, color: '#ffffff' }}>{initials}</span>
              )}
            </div>
          </div>

          <p
            style={{
              marginTop: '1.75rem',
              marginBottom: 0,
              fontSize: '0.98rem',
              color: '#4b5563',
            }}
          >
            {subtitle}
          </p>

          <p
            style={{
              marginTop: '1.1rem',
              marginBottom: 0,
              fontSize: '0.95rem',
              color: '#111827',
            }}
          >
            <span style={{ fontWeight: 600 }}>{statsCases}</span> уникальных кейсов&nbsp;|{' '}
            <span style={{ fontWeight: 600 }}>{statsProjects}</span> проектов&nbsp;|{' '}
            <span style={{ fontWeight: 600 }}>{statsCities}</span> города
          </p>
        </div>

        {/* Разделитель */}
        <div
          style={{
            marginTop: '2.25rem',
            marginBottom: '2rem',
            height: 1,
            background: 'rgba(15, 23, 42, 0.06)',
          }}
        />

        {/* Сферы деятельности */}
        <div>
          <h2
            style={{
              margin: 0,
              marginBottom: '0.75rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: '#111827',
            }}
          >
            Сферы деятельности
          </h2>
          {profileServices.length > 0 ? (
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.2rem',
                color: '#4b5563',
                fontSize: '0.95rem',
                lineHeight: 1.7,
              }}
            >
              {profileServices.map((service) => (
                <li key={service}>{service}</li>
              ))}
            </ul>
          ) : (
            <p
              style={{
                margin: 0,
                color: '#6b7280',
                fontSize: '0.9rem',
              }}
            >
              Список сфер деятельности ещё не заполнен.
            </p>
          )}
        </div>

        {/* Города */}
        {profileCities.length > 0 && (
          <div
            style={{
              marginTop: '2.25rem',
              textAlign: 'center',
              fontSize: '0.95rem',
              color: '#4b5563',
            }}
          >
            {profileCities.join(' — ')}
          </div>
        )}

        {/* CTA-кнопки */}
        <div
          style={{
            marginTop: '1.9rem',
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
          }}
        >
          <button
            type="button"
            style={{
              minWidth: 150,
              padding: '0.8rem 1.2rem',
              borderRadius: 0,
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              color: '#111827',
              fontSize: '0.9rem',
              cursor: 'default',
            }}
          >
            Расчёт
          </button>
          <button
            type="button"
            style={{
              minWidth: 170,
              padding: '0.8rem 1.2rem',
              borderRadius: 0,
              border: '1px solid #4b5563',
              background: '#4b6fae',
              color: '#ffffff',
              fontSize: '0.9rem',
              cursor: 'default',
            }}
          >
            Связаться
          </button>
          <button
            type="button"
            style={{
              minWidth: 170,
              padding: '0.8rem 1.2rem',
              borderRadius: 0,
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              color: '#111827',
              fontSize: '0.9rem',
              cursor: 'default',
            }}
          >
            Поделиться
          </button>
        </div>

        {/* Галерея 3x2 */}
        <div
          style={{
            marginTop: '2.5rem',
          }}
        >
          {displayPhotos.length > 0 ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '0.9rem',
                }}
              >
                {displayPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    style={{
                      width: '100%',
                      paddingTop: '66%',
                      position: 'relative',
                      overflow: 'hidden',
                      background: '#e5e7eb',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt="Фото проекта"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: '1.75rem',
                  textAlign: 'center',
                  fontSize: '0.9rem',
                  color: '#4b5563',
                }}
              >
                1 / {totalPages}
              </div>
            </>
          ) : (
            <p
              style={{
                margin: 0,
                color: '#6b7280',
                fontSize: '0.9rem',
                textAlign: 'center',
              }}
            >
              В этом блоке будут отображаться реализованные проекты вашего бизнеса.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

