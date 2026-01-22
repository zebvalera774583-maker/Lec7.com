'use client'

import React, { useState } from 'react'
import RequestModal from './RequestModal'
import ContactModal from './ContactModal'
import ShareModal from './ShareModal'
import PortfolioCaseView from './PortfolioCaseView'

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
    phone: string | null
    telegramUsername: string | null
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
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [selectedCaseIndex, setSelectedCaseIndex] = useState<number | null>(null)

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

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

  // Фильтруем кейсы с фото
  const casesWithPhotos = portfolioItems.filter((item) => item.photos && item.photos.length > 0)

  // Используем portfolioItems как кейсы, если они есть, иначе — прямые фото бизнеса как fallback
  const hasPortfolioItems = casesWithPhotos.length > 0

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
            onClick={() => setIsRequestModalOpen(true)}
            style={{
              minWidth: 150,
              padding: '0.8rem 1.2rem',
              borderRadius: 0,
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              color: '#111827',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Расчёт
          </button>
          <button
            type="button"
            onClick={() => setIsContactModalOpen(true)}
            style={{
              minWidth: 170,
              padding: '0.8rem 1.2rem',
              borderRadius: 0,
              border: '1px solid #4b5563',
              background: '#4b6fae',
              color: '#ffffff',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Связаться
          </button>
          <button
            type="button"
            onClick={async () => {
              const url = window.location.href
              const title = business.name

              // Пробуем использовать Web Share API если доступен
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: title,
                    text: `Посмотрите витрину ${title} на Lec7`,
                    url: url,
                  })
                  return
                } catch (err) {
                  // Пользователь отменил или произошла ошибка
                  if ((err as Error).name !== 'AbortError') {
                    console.error('Error sharing:', err)
                  }
                }
              }

              // Если Web Share API недоступен, показываем модальное окно
              setIsShareModalOpen(true)
            }}
            style={{
              minWidth: 170,
              padding: '0.8rem 1.2rem',
              borderRadius: 0,
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              color: '#111827',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Поделиться
          </button>
        </div>

        {/* Портфолио кейсы - Instagram-style grid */}
        <div
          style={{
            marginTop: '2.5rem',
          }}
        >
          {hasPortfolioItems ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '0.9rem',
              }}
            >
              {casesWithPhotos.map((item, index) => {
                // Сортируем фото по sortOrder
                const sortedPhotos = item.photos
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

                // Обложка: coverUrl если есть, иначе первое фото
                const coverUrl = item.coverUrl || sortedPhotos[0]?.url

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedCaseIndex(index)}
                    style={{
                      width: '100%',
                      paddingTop: '100%',
                      position: 'relative',
                      overflow: 'hidden',
                      background: '#e5e7eb',
                      borderRadius: 0,
                      cursor: 'pointer',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.9'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1'
                    }}
                  >
                    {coverUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={coverUrl}
                        alt="Кейс"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          ) : photos.length > 0 ? (
            // Fallback: если нет portfolioItems, показываем прямые фото бизнеса как квадраты
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '0.9rem',
              }}
            >
              {photos.slice(0, 6).map((photo) => (
                <div
                  key={photo.id}
                  style={{
                    width: '100%',
                    paddingTop: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#e5e7eb',
                    borderRadius: 0,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt="Фото проекта"
                    style={{
                      position: 'absolute',
                      inset: 0,
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
                textAlign: 'center',
              }}
            >
              В этом блоке будут отображаться реализованные проекты вашего бизнеса.
            </p>
          )}
        </div>
      </section>

      <RequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        businessId={business.id}
        businessName={business.name}
      />

      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        phone={business.profile?.phone ?? null}
        telegramUsername={business.profile?.telegramUsername ?? null}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        url={shareUrl}
        title={business.name}
      />

      {selectedCaseIndex !== null && hasPortfolioItems && casesWithPhotos[selectedCaseIndex] && (() => {
        const selectedCase = casesWithPhotos[selectedCaseIndex]
        // Сортируем фото по sortOrder для модалки
        const sortedPhotos = selectedCase.photos
          .slice()
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

        return (
          <PortfolioCaseView
            isOpen={true}
            onClose={() => setSelectedCaseIndex(null)}
            photos={sortedPhotos}
            description={selectedCase.comment || null}
            caseIndex={selectedCaseIndex}
            totalCases={casesWithPhotos.length}
          />
        )
      })()}
    </div>
  )
}

