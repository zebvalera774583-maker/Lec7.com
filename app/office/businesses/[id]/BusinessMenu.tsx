'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface BusinessMenuProps {
  businessId: string
  slug: string
}

export default function BusinessMenu({ businessId, slug }: BusinessMenuProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const handleEditProfile = () => {
    router.push(`/office/businesses/${businessId}/profile`)
    setIsOpen(false)
  }

  const handleOpenShowcase = () => {
    window.open(`/office/businesses/${businessId}/preview`, '_blank')
    setIsOpen(false)
  }

  const handleOpenAds = () => {
    router.push(`/office/ads?businessId=${businessId}`)
    setIsOpen(false)
  }

  const handleOpenRequests = () => {
    router.push(`/office/businesses/${businessId}/requests`)
    setIsOpen(false)
  }

  const handleOpenPartnership = () => {
    router.push(`/office/businesses/${businessId}/partnership`)
    setIsOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
        aria-label="Меню"
      >
        <div
          style={{
            width: '20px',
            height: '2px',
            background: '#333',
            transition: 'all 0.3s',
            transform: isOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none',
          }}
        />
        <div
          style={{
            width: '20px',
            height: '2px',
            background: '#333',
            transition: 'all 0.3s',
            opacity: isOpen ? 0 : 1,
          }}
        />
        <div
          style={{
            width: '20px',
            height: '2px',
            background: '#333',
            transition: 'all 0.3s',
            transform: isOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none',
          }}
        />
      </button>

      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998,
            }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '0.5rem',
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              border: '1px solid #e5e7eb',
              minWidth: '200px',
              zIndex: 999,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={handleEditProfile}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: '#111827',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Редактировать профиль
            </button>
            <button
              onClick={handleOpenRequests}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                borderTop: '1px solid #e5e7eb',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: '#111827',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              📥 Заявки
            </button>
            <button
              onClick={handleOpenAds}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                borderTop: '1px solid #e5e7eb',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: '#111827',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Реклама и продвижение
            </button>
            <button
              onClick={handleOpenShowcase}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                borderTop: '1px solid #e5e7eb',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: '#111827',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Открыть витрину
            </button>
            <button
              onClick={handleOpenPartnership}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                borderTop: '1px solid #e5e7eb',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: '#111827',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              ПАРТНЕРСТВО
            </button>
          </div>
        </>
      )}
    </div>
  )
}
