'use client'

import { useState, useEffect } from 'react'

interface PortfolioCaseViewProps {
  isOpen: boolean
  onClose: () => void
  photos: Array<{ id: string; url: string; sortOrder: number }>
  description: string | null
  caseIndex: number
  totalCases: number
}

export default function PortfolioCaseView({
  isOpen,
  onClose,
  photos,
  description,
  caseIndex,
  totalCases,
}: PortfolioCaseViewProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)

  useEffect(() => {
    if (isOpen) {
      setCurrentPhotoIndex(0)
      // Блокируем скролл body при открытии модалки
      document.body.style.overflow = 'hidden'
    } else {
      // Разблокируем скролл body при закрытии модалки
      document.body.style.overflow = ''
    }

    return () => {
      // Восстанавливаем скролл при размонтировании
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentPhotoIndex, photos.length])

  const handlePrevious = () => {
    setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
  }

  const handleNext = () => {
    setCurrentPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
  }

  const handleSwipeStart = (clientX: number) => {
    const startX = clientX
    let currentX = clientX

    const handleMove = (e: MouseEvent | TouchEvent) => {
      currentX = 'touches' in e ? e.touches[0].clientX : e.clientX
    }

    const handleEnd = () => {
      const diff = startX - currentX
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          handleNext()
        } else {
          handlePrevious()
        }
      }
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleMove, { passive: true })
    document.addEventListener('touchend', handleEnd)
  }

  if (!isOpen || photos.length === 0) return null

  const currentPhoto = photos[currentPhotoIndex]

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: '#f7f2ee',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
        onClick={onClose}
      >
        {/* Photo Container */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            overflow: 'hidden',
            background: '#f7f2ee',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => handleSwipeStart(e.clientX)}
          onTouchStart={(e) => handleSwipeStart(e.touches[0].clientX)}
        >
          {/* Previous Button */}
          {photos.length > 1 && (
            <button
              onClick={handlePrevious}
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 0,
                color: '#111827',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.5rem',
                zIndex: 10,
              }}
            >
              ←
            </button>
          )}

          {/* Photo */}
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              position: 'relative',
              background: '#f7f2ee',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPhoto.url}
              alt={`Фото ${currentPhotoIndex + 1} из ${photos.length}`}
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 200px)',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />

            {/* Photo Counter */}
            {photos.length > 1 && (
              <div
                style={{
                  color: '#111827',
                  fontSize: '0.9rem',
                  textAlign: 'center',
                }}
              >
                {currentPhotoIndex + 1} / {photos.length}
              </div>
            )}

            {/* Description */}
            {description && description.trim().length > 0 && (
              <div
                style={{
                  color: '#111827',
                  fontSize: '1rem',
                  textAlign: 'center',
                  maxWidth: '800px',
                  lineHeight: 1.6,
                  padding: '0 2rem',
                }}
              >
                {description}
              </div>
            )}
          </div>

          {/* Next Button */}
          {photos.length > 1 && (
            <button
              onClick={handleNext}
              style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 0,
                color: '#111827',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.5rem',
                zIndex: 10,
              }}
            >
              →
            </button>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 0,
            color: '#111827',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.5rem',
            zIndex: 10,
          }}
        >
          ×
        </button>
      </div>
    </>
  )
}
