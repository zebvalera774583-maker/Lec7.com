'use client'

import React, { useState, useEffect } from 'react'
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
    requestButtonLabel?: string | null
    statsCases: number
    statsProjects: number
    statsCities: number
    statsCasesLabel?: string | null
    statsProjectsLabel?: string | null
    statsCitiesLabel?: string | null
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
  const [isMobile, setIsMobile] = useState(false)

  const shareUrl =
    typeof window !== 'undefined'
      ? mode === 'resident'
        ? `${window.location.origin}/~${business.slug}`
        : window.location.href
      : ''

  // Определяем мобильный режим
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const statsCases = business.profile?.statsCases ?? 40
  const statsProjects = business.profile?.statsProjects ?? 2578
  const statsCities = business.profile?.statsCities ?? 4
  const requestButtonLabel = business.profile?.requestButtonLabel?.trim() || 'Расчёт'
  const statsCasesLabel = business.profile?.statsCasesLabel || 'уникальных кейсов'
  const statsProjectsLabel = business.profile?.statsProjectsLabel || ''
  const statsCitiesLabel = business.profile?.statsCitiesLabel || 'городов'
  const hasMetricLabel = (label?: string | null) => Boolean(label && label.trim().length > 0)
  const showCasesMetric = statsCases > 0 || hasMetricLabel(statsCasesLabel)
  const showProjectsMetric = statsProjects > 0 || hasMetricLabel(statsProjectsLabel)
  const showCitiesMetric = statsCities > 0 || hasMetricLabel(statsCitiesLabel)
  const hasAnyStats = showCasesMetric || showProjectsMetric || showCitiesMetric

  const profileCities = business.profile?.cities ?? []
  const profileServices = (business.profile?.services ?? []).filter((s) => s && String(s).trim().length > 0)

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
      <section>
        {/* Hero */}
        {isMobile ? (
          // Mobile: Instagram-style layout
          <div>
            {/* Header: Avatar + Name + Stats */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem',
                marginBottom: '1rem',
              }}
            >
              {/* Left: Avatar */}
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: '#dde1e7',
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
                  <span style={{ fontSize: '2rem', fontWeight: 500, color: '#ffffff' }}>{initials}</span>
                )}
              </div>

              {/* Right: Name + Stats */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <h1
                  style={{
                    margin: 0,
                    fontSize: '1.3rem',
                    fontWeight: 500,
                    color: '#111827',
                  }}
                >
                  {business.name}
                </h1>

                {/* Stats — показываем и без числа, если есть подпись */}
                {hasAnyStats && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      fontSize: '0.85rem',
                      color: '#111827',
                    }}
                  >
                    {showCasesMetric && (
                      <div>
                        {statsCases > 0 ? <span style={{ fontWeight: 600 }}>{statsCases}</span> : null}{' '}
                        {statsCasesLabel}
                      </div>
                    )}
                    {showProjectsMetric && (
                      <div>
                        {statsProjects > 0 ? <span style={{ fontWeight: 600 }}>{statsProjects}</span> : null}{' '}
                        {statsProjectsLabel}
                      </div>
                    )}
                    {showCitiesMetric && (
                      <div>
                        {statsCities > 0 ? <span style={{ fontWeight: 600 }}>{statsCities}</span> : null}{' '}
                        {statsCitiesLabel}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Desktop: Centered layout
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

            {hasAnyStats && (
              <p
                style={{
                  marginTop: '1.75rem',
                  marginBottom: 0,
                  fontSize: '0.95rem',
                  color: '#111827',
                }}
              >
                {showCasesMetric && (
                  <>
                    {statsCases > 0 ? <span style={{ fontWeight: 600 }}>{statsCases}</span> : null}{' '}
                    {statsCasesLabel}
                  </>
                )}
                {showCasesMetric && (showProjectsMetric || showCitiesMetric) && ' | '}
                {showProjectsMetric && (
                  <>
                    {statsProjects > 0 ? <span style={{ fontWeight: 600 }}>{statsProjects}</span> : null}{' '}
                    {statsProjectsLabel}
                  </>
                )}
                {showProjectsMetric && showCitiesMetric && ' | '}
                {showCitiesMetric && (
                  <>
                    {statsCities > 0 ? <span style={{ fontWeight: 600 }}>{statsCities}</span> : null}{' '}
                    {statsCitiesLabel}
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {/* Разделитель */}
        <div
          style={{
            marginTop: isMobile ? '1rem' : '2.25rem',
            marginBottom: isMobile ? '1rem' : '2rem',
            height: 1,
            background: 'rgba(15, 23, 42, 0.06)',
          }}
        />

        {/* Сферы деятельности — только если заполнены */}
        {profileServices.length > 0 && (
          <div>
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
          </div>
        )}

        {/* Города */}
        {profileCities.length > 0 && (
          <div
            style={{
              marginTop: isMobile ? '1.25rem' : '2.25rem',
              textAlign: isMobile ? 'left' : 'center',
              fontSize: isMobile ? '0.85rem' : '0.95rem',
              color: '#4b5563',
            }}
          >
            {profileCities.join(' — ')}
          </div>
        )}

        {/* CTA-кнопки */}
        <div
          style={{
            marginTop: isMobile ? '1.25rem' : '1.9rem',
            display: 'flex',
            justifyContent: 'center',
            gap: isMobile ? '0.5rem' : '1rem',
          }}
        >
          <button
            type="button"
            onClick={() => setIsRequestModalOpen(true)}
            style={{
              minWidth: isMobile ? 0 : 150,
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '0.65rem 0.5rem' : '0.8rem 1.2rem',
              borderRadius: 0,
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              color: '#111827',
              fontSize: isMobile ? '0.85rem' : '0.9rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {requestButtonLabel}
          </button>
          <button
            type="button"
            onClick={() => setIsContactModalOpen(true)}
            style={{
              minWidth: isMobile ? 0 : 170,
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '0.65rem 0.5rem' : '0.8rem 1.2rem',
              borderRadius: 0,
              border: '1px solid #4b5563',
              background: '#4b6fae',
              color: '#ffffff',
              fontSize: isMobile ? '0.85rem' : '0.9rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Связаться
          </button>
          <button
            type="button"
            onClick={async () => {
              const url = shareUrl
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
              minWidth: isMobile ? 0 : 170,
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '0.65rem 0.5rem' : '0.8rem 1.2rem',
              borderRadius: 0,
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              color: '#111827',
              fontSize: isMobile ? '0.85rem' : '0.9rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Поделиться
          </button>
        </div>

        {/* Портфолио кейсы - Instagram-style grid */}
        <div
          style={{
            marginTop: isMobile ? '1.5rem' : '2.5rem',
          }}
        >
          {hasPortfolioItems ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: isMobile ? '0.4rem' : '0.9rem',
              }}
            >
              {casesWithPhotos.map((item, index) => {
                // Сортируем фото по sortOrder
                const sortedPhotos = item.photos
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

                // Обложка: coverUrl если есть, иначе первое фото
                const coverUrl = item.coverUrl || sortedPhotos[0]?.url
                const caption = item.comment?.trim() || null

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: isMobile ? '0.25rem' : '0.4rem',
                    }}
                  >
                    <div
                      onClick={() => setSelectedCaseIndex(index)}
                      style={{
                        width: '100%',
                        aspectRatio: '4 / 3',
                        position: 'relative',
                        overflow: 'hidden',
                        background: '#f3f4f6',
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
                            objectFit: 'contain',
                            objectPosition: 'center',
                            background: '#f3f4f6',
                          }}
                        />
                      )}
                    </div>
                    {caption && (
                      <div
                        style={{
                          padding: isMobile ? '0.25rem 0.2rem' : '0.4rem 0.3rem',
                          background: 'rgba(255,255,255,0.95)',
                          fontSize: isMobile ? '0.7rem' : '0.8rem',
                          color: '#374151',
                          lineHeight: 1.3,
                          textAlign: 'center',
                          minHeight: isMobile ? '2rem' : '2.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {caption}
                      </div>
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
                gap: isMobile ? '0.4rem' : '0.9rem',
              }}
            >
              {photos.slice(0, 6).map((photo) => (
                <div
                  key={photo.id}
                  style={{
                    width: '100%',
                    aspectRatio: '4 / 3',
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#f3f4f6',
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
                      objectFit: 'contain',
                      objectPosition: 'center',
                      background: '#f3f4f6',
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

