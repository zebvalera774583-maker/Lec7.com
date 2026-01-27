'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

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
  const isSwipingRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      setCurrentPhotoIndex(0)
      // Блокируем скролл body при открытии модалки
      document.body.style.overflow = 'hidden'
      // Устанавливаем бежевый фон для body и html, чтобы не было белого фона
      const originalBodyBackground = document.body.style.background
      const originalHtmlBackground = document.documentElement.style.background
      document.body.style.background = '#f7f2ee'
      document.documentElement.style.background = '#f7f2ee'
      
      return () => {
        // Восстанавливаем скролл и фон при закрытии модалки
        document.body.style.overflow = ''
        document.body.style.background = originalBodyBackground
        document.documentElement.style.background = originalHtmlBackground
      }
    } else {
      // Разблокируем скролл body при закрытии модалки
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handlePrevious = useCallback(() => {
    setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
  }, [photos.length])

  const handleNext = useCallback(() => {
    setCurrentPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
  }, [photos.length])

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

    const handleWheel = (e: WheelEvent) => {
      // Прокрутка вниз → следующее фото, вверх → предыдущее
      e.preventDefault() // Предотвращаем прокрутку страницы
      if (e.deltaY > 0) {
        handleNext()
      } else if (e.deltaY < 0) {
        handlePrevious()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleWheel)
    }
  }, [isOpen, handlePrevious, handleNext, onClose])

  const handleSwipeStart = (clientX: number) => {
    const startX = clientX
    let currentX = clientX
    isSwipingRef.current = false

    const handleMove = (e: MouseEvent | TouchEvent) => {
      currentX = 'touches' in e ? e.touches[0].clientX : e.clientX
      // Если мышь/палец сдвинулся больше чем на 5px, считаем это свайпом
      if (Math.abs(startX - currentX) > 5) {
        isSwipingRef.current = true
      }
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
      // Сбрасываем флаг свайпа через небольшую задержку, чтобы клик не сработал
      setTimeout(() => {
        isSwipingRef.current = false
      }, 100)
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

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Игнорируем клик, если был свайп
    if (isSwipingRef.current) {
      return
    }

    // Определяем область клика: левая треть → предыдущее, правая треть → следующее
    const containerWidth = e.currentTarget.clientWidth
    const clickX = e.clientX - e.currentTarget.getBoundingClientRect().left
    const thirdWidth = containerWidth / 3

    if (clickX < thirdWidth) {
      // Левая треть → предыдущее фото
      handlePrevious()
    } else if (clickX > thirdWidth * 2) {
      // Правая треть → следующее фото
      handleNext()
    }
    // Центральная треть → ничего не делаем (можно кликнуть для закрытия через overlay)
  }

  if (!isOpen || photos.length === 0) return null

  const currentPhoto = photos[currentPhotoIndex]

  // Рендерим модалку через Portal в body, чтобы избежать проблем с белым фоном
  const modalContent = (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          background: '#f7f2ee',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          margin: 0,
          padding: 0,
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
            padding: 0,
            overflow: 'hidden',
            background: '#f7f2ee',
          }}
          onClick={(e) => {
            e.stopPropagation()
            handleClick(e)
          }}
          onMouseDown={(e) => handleSwipeStart(e.clientX)}
          onTouchStart={(e) => handleSwipeStart(e.touches[0].clientX)}
        >
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
              padding: '2rem',
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
                background: '#f7f2ee',
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

  // Рендерим через Portal в body
  if (typeof window === 'undefined') return null
  return createPortal(modalContent, document.body)
}
