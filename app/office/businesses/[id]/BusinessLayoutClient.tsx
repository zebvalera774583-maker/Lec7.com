'use client'

import { useState, useEffect } from 'react'
import BusinessSidebar from './BusinessSidebar'

interface NavItem {
  href: string
  label: string
}

interface BusinessLayoutClientProps {
  businessId: string
  businessName: string
  navItems: NavItem[]
  children: React.ReactNode
}

const MOBILE_BREAKPOINT = 768

export default function BusinessLayoutClient({ businessId, businessName, navItems, children }: BusinessLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const handler = () => {
      const mobile = mq.matches
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(false)
    }
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)', background: '#f5f5f5', position: 'relative' }}>
      {/* Кнопка меню на мобильных */}
      {isMobile && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          style={{
            position: 'fixed',
            top: '72px',
            left: '0.75rem',
            zIndex: 900,
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            fontSize: '1.25rem',
          }}
          aria-label="Открыть меню"
        >
          ☰
        </button>
      )}

      {/* Оверлей при открытом сайдбаре */}
      {isMobile && sidebarOpen && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 998,
          }}
          aria-label="Закрыть меню"
        />
      )}

      {/* Сайдбар */}
      <div
        style={{
          ...(isMobile
            ? {
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                zIndex: 999,
                width: '288px',
                maxWidth: '85vw',
                transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 0.2s ease',
                boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.15)' : 'none',
              }
            : {
                flexShrink: 0,
              }),
        }}
      >
        <BusinessSidebar
          businessId={businessId}
          businessName={businessName}
          navItems={navItems}
          onNavigate={isMobile ? () => setSidebarOpen(false) : undefined}
          showCloseButton={isMobile && sidebarOpen}
          onClose={isMobile ? () => setSidebarOpen(false) : undefined}
        />
      </div>

      {/* Контент */}
      <main
        style={{
          flex: 1,
          overflow: 'auto',
          paddingLeft: isMobile ? '3.5rem' : 0,
          minWidth: 0,
        }}
      >
        {children}
      </main>
    </div>
  )
}
