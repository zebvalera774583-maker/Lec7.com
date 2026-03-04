'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const SIDEBAR_ITEMS: (
  | { label: string; href: string }
  | { label: string; children: { label: string; href: string }[] }
)[] = [
  { label: 'AI-агент', href: '/admin' },
  { label: 'Бизнесы', href: '/admin/businesses' },
  { label: 'Мастер каталог', href: '/admin/bot-tools' },
  {
    label: 'Техничка',
    children: [
      { label: 'Таблицы', href: '/admin/tech/tables' },
      { label: 'ТЗ AI агента', href: '/admin/tech/ai-spec' },
    ],
  },
]

const MOBILE_BREAKPOINT = 1024

interface AdminSidebarClientProps {
  pathname: string
}

export default function AdminSidebarClient({ pathname }: AdminSidebarClientProps) {
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

  const asideContent = (
    <>
      {isMobile && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          style={{
            marginBottom: '1rem',
            padding: '0.5rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: '#6b7280',
            lineHeight: 1,
          }}
          aria-label="Закрыть меню"
        >
          ×
        </button>
      )}
      {SIDEBAR_ITEMS.map((item) => {
        if ('href' in item) {
          const { href } = item
          const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={() => isMobile && setSidebarOpen(false)}
              style={{
                display: 'block',
                padding: '0.75rem 1.5rem',
                color: isActive ? '#111827' : '#6b7280',
                fontWeight: isActive ? 600 : 500,
                textDecoration: 'none',
                borderLeft: isActive ? '2px solid #111827' : '2px solid transparent',
                marginLeft: isActive ? '-2px' : 0,
              }}
            >
              {item.label}
            </Link>
          )
        }
        return (
          <div key={item.label} style={{ marginBottom: '0.5rem' }}>
            <div style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>
              {item.label}
            </div>
            {item.children.map((child) => {
              const isActive = pathname === child.href || pathname.startsWith(child.href + '/')
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={() => isMobile && setSidebarOpen(false)}
                  style={{
                    display: 'block',
                    padding: '0.5rem 1.5rem 0.5rem 2rem',
                    color: isActive ? '#111827' : '#6b7280',
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: 'none',
                    borderLeft: isActive ? '2px solid #111827' : '2px solid transparent',
                    marginLeft: isActive ? '-2px' : 0,
                  }}
                >
                  {child.label}
                </Link>
              )
            })}
          </div>
        )
      })}
    </>
  )

  const sidebarEl = (
    <aside
      style={{
        minWidth: '200px',
        padding: '2rem 0 2rem 2rem',
        borderRight: isMobile ? 'none' : '1px solid #e5e7eb',
        background: isMobile ? 'white' : 'transparent',
        height: isMobile ? '100%' : 'auto',
        overflowY: 'auto',
      }}
    >
      {asideContent}
    </aside>
  )

  return (
    <>
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
            border: '1px solid #e0e0e0',
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
      {isMobile ? (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            zIndex: 999,
            width: '260px',
            maxWidth: '85vw',
            padding: '1.5rem',
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.2s ease',
            boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.15)' : 'none',
            background: 'white',
          }}
        >
          {sidebarEl}
        </div>
      ) : (
        sidebarEl
      )}
    </>
  )
}
