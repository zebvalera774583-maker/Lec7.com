'use client'

import React from 'react'

interface ShowcaseBusiness {
  id: string
  slug: string
  name: string
  city?: string | null
  category?: string | null
  avatarUrl?: string | null
  photos?: Array<{
    id: string
    url: string
    sortOrder: number
  }>
}

type ShowcaseMode = 'public' | 'resident'

interface ShowcaseViewProps {
  business: ShowcaseBusiness
  mode: ShowcaseMode
}

export default function ShowcaseView({ business, mode }: ShowcaseViewProps) {
  const subtitleParts = []
  if (business.city) subtitleParts.push(business.city)
  if (business.category) subtitleParts.push(business.category)

  const subtitle = subtitleParts.join(' • ')

  const initials =
    business.name && business.name.trim().length > 0
      ? business.name.trim().charAt(0).toUpperCase()
      : business.slug.charAt(0).toUpperCase()

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
      {/* Header */}
      <section
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '1.5rem',
          borderRadius: 12,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '9999px',
            backgroundColor: '#e5e7eb',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
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
            <span style={{ fontSize: '2rem', fontWeight: 600, color: '#4b5563' }}>{initials}</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.25rem',
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: '2rem',
                fontWeight: 700,
                color: '#111827',
              }}
            >
              {business.name}
            </h1>
            <span
              style={{
                padding: '0.1rem 0.5rem',
                borderRadius: 999,
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: '0.75rem',
              }}
            >
              /{business.slug}
            </span>
          </div>
          {subtitle && (
            <p
              style={{
                margin: 0,
                color: '#6b7280',
                fontSize: '0.95rem',
              }}
            >
              {subtitle}
            </p>
          )}
          {mode === 'resident' && (
            <p
              style={{
                marginTop: '0.5rem',
                marginBottom: 0,
                fontSize: '0.8rem',
                color: '#4b5563',
              }}
            >
              Это превью витрины для резидента. Клиенты увидят этот экран по ссылке на публичную витрину.
            </p>
          )}
        </div>
      </section>

      {/* About section */}
      <section
        style={{
          padding: '1.5rem',
          borderRadius: 12,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: '0.75rem',
            fontSize: '1.25rem',
            fontWeight: 600,
          }}
        >
          О бизнесе
        </h2>
        <p
          style={{
            margin: 0,
            color: '#4b5563',
            lineHeight: 1.6,
            fontSize: '0.95rem',
          }}
        >
          Здесь в будущем будет подробное описание вашей компании, ключевые услуги и преимущества для клиентов.
          Пока это базовый шаблон витрины, который уже можно использовать для первых показов.
        </p>
      </section>

      {/* Services and gallery placeholders */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
          gap: '1.5rem',
        }}
      >
        <div
          style={{
            padding: '1.5rem',
            borderRadius: 12,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
          }}
        >
          <h3
            style={{
              margin: 0,
              marginBottom: '0.75rem',
              fontSize: '1.1rem',
              fontWeight: 600,
            }}
          >
            Услуги (скоро)
          </h3>
          <p
            style={{
              margin: 0,
              color: '#6b7280',
              fontSize: '0.9rem',
              lineHeight: 1.6,
            }}
          >
            Здесь появится список ключевых услуг с краткими описаниями и примерами. Вы сможете выделить основные
            направления работы компании.
          </p>
        </div>

        <div
          style={{
            padding: '1.5rem',
            borderRadius: 12,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
          }}
        >
          <h3
            style={{
              margin: 0,
              marginBottom: '0.75rem',
              fontSize: '1.1rem',
              fontWeight: 600,
            }}
          >
            Портфолио
          </h3>
          {business.photos && business.photos.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: '0.75rem',
                marginTop: '0.75rem',
              }}
            >
              {business.photos.map((photo) => (
                <div
                  key={photo.id}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid #e5e7eb',
                    background: '#f3f4f6',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.02)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={`Фото проекта ${photo.sortOrder + 1}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p
              style={{
                margin: 0,
                color: '#6b7280',
                fontSize: '0.9rem',
                lineHeight: 1.6,
              }}
            >
              В этом блоке будут отображаться реализованные проекты: фото, краткие описания и результаты для клиентов.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

