'use client'

import React, { useState, useEffect } from 'react'

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
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  const subtitleParts = []
  if (business.city) subtitleParts.push(business.city)
  if (business.category) subtitleParts.push(business.category)

  const subtitle = subtitleParts.join(' • ')

  const initials =
    business.name && business.name.trim().length > 0
      ? business.name.trim().charAt(0).toUpperCase()
      : business.slug.charAt(0).toUpperCase()

  const photos = business.photos || []
  const portfolioItems = business.portfolioItems || []

  // Получаем активный кейс и его фото
  const activeItem = activeItemId ? portfolioItems.find((item) => item.id === activeItemId) : null
  const activePhotos = activeItem ? activeItem.photos : []

  // Блокировка скролла body при открытом просмотрщике
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Обработка клавиатуры
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setActiveItemId(null)
      } else if (e.key === 'ArrowLeft' && activePhotos.length > 1) {
        setActiveIndex((prev) => (prev === 0 ? activePhotos.length - 1 : prev - 1))
      } else if (e.key === 'ArrowRight' && activePhotos.length > 1) {
        setActiveIndex((prev) => (prev === activePhotos.length - 1 ? 0 : prev + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, activePhotos.length])

  const handleThumbnailClick = (index: number) => {
    setActiveIndex(index)
    setIsOpen(true)
  }

  const handlePortfolioItemClick = (itemId: string) => {
    const item = portfolioItems.find((i) => i.id === itemId)
    if (item && item.photos.length > 0) {
      setActiveItemId(itemId)
      setActiveIndex(0)
      setIsOpen(true)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setActiveItemId(null)
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (activePhotos.length > 1) {
      setActiveIndex((prev) => (prev === 0 ? activePhotos.length - 1 : prev - 1))
    }
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (activePhotos.length > 1) {
      setActiveIndex((prev) => (prev === activePhotos.length - 1 ? 0 : prev + 1))
    }
  }

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
          {portfolioItems.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '1rem',
                marginTop: '0.75rem',
              }}
            >
              {portfolioItems.map((item) => {
                const coverPhoto = item.coverUrl
                  ? item.photos.find((p) => p.url === item.coverUrl)
                  : item.photos[0]
                const commentPreview = item.comment
                  ? item.comment.split('\n').slice(0, 2).join(' ').substring(0, 100) + (item.comment.length > 100 ? '...' : '')
                  : null

                return (
                  <div
                    key={item.id}
                    onClick={() => handlePortfolioItemClick(item.id)}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: '1px solid #e5e7eb',
                      background: '#f3f4f6',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.02)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    {coverPhoto ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={coverPhoto.url}
                          alt="Обложка кейса"
                          style={{
                            width: '100%',
                            flex: 1,
                            objectFit: 'cover',
                          }}
                        />
                        {commentPreview && (
                          <div
                            style={{
                              padding: '0.5rem',
                              background: 'rgba(0, 0, 0, 0.7)',
                              color: 'white',
                              fontSize: '0.75rem',
                              lineHeight: 1.4,
                            }}
                          >
                            {commentPreview}
                          </div>
                        )}
                      </>
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#6b7280',
                          fontSize: '0.875rem',
                        }}
                      >
                        Нет фото
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : photos.length > 0 ? (
            // Fallback на старые фото, если кейсов нет
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: '0.75rem',
                marginTop: '0.75rem',
              }}
            >
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  onClick={() => handleThumbnailClick(index)}
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

      {/* Fullscreen Photo Viewer */}
      {isOpen && activePhotos.length > 0 && (
        <div
          onClick={handleOverlayClick}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
        >
          {/* Close Button */}
          <button
            onClick={handleClose}
            style={{
              position: 'absolute',
              top: '1.5rem',
              right: '1.5rem',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.9)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 600,
              color: '#111827',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)'
            }}
          >
            ×
          </button>

          {/* Navigation Arrows */}
          {activePhotos.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                style={{
                  position: 'absolute',
                  left: '1.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: '#111827',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)'
                }}
              >
                ←
              </button>
              <button
                onClick={handleNext}
                style={{
                  position: 'absolute',
                  right: '1.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: '#111827',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)'
                }}
              >
                →
              </button>
            </>
          )}

          {/* Image Container */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '86vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activePhotos[activeIndex].url}
              alt={`Фото ${activeIndex + 1}`}
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
            {/* Comment */}
            {activeItem && activeItem.comment && (
              <div
                style={{
                  maxWidth: '600px',
                  padding: '1rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.95)',
                  color: '#111827',
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  textAlign: 'center',
                }}
              >
                {activeItem.comment}
              </div>
            )}
          </div>

          {/* Counter */}
          {activePhotos.length > 1 && (
            <div
              style={{
                position: 'absolute',
                bottom: '2rem',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '0.5rem 1rem',
                borderRadius: '999px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {activeIndex + 1} / {activePhotos.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

