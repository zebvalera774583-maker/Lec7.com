'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
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

const MOBILE_QUERY = '(max-width: 768px)'

function subscribe(cb: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches
}

function getServerSnapshot() {
  return false
}

export default function BusinessLayoutClient({ businessId, businessName, navItems, children }: BusinessLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false)
  }, [isMobile])

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)', background: '#f5f5f5', position: 'relative' }}>
      {/* Кнопка гамбургера на мобильных — открывает/закрывает сайдбар */}
      {isMobile && (
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          style={{
            position: 'fixed',
            top: '72px',
            left: '0.75rem',
            zIndex: 1000,
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
            fontSize: sidebarOpen ? '1.5rem' : '1.25rem',
            lineHeight: 1,
          }}
          aria-label={sidebarOpen ? 'Закрыть меню' : 'Открыть меню'}
        >
          {sidebarOpen ? '×' : '☰'}
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
