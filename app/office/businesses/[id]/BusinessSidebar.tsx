'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

interface NavItem {
  href: string
  label: string
}

interface BusinessSidebarProps {
  businessId: string
  businessName: string
  navItems: NavItem[]
}

export default function BusinessSidebar({ businessId, businessName, navItems }: BusinessSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isActive = (href: string) => {
    const [path, query] = href.split('?')
    const pathMatches = pathname === path || pathname.startsWith(path + '/')
    if (!pathMatches) return false
    if (!query) {
      if (path === `/office/businesses/${businessId}`) return pathname === path
      const currentQuery = searchParams.toString()
      return !currentQuery
    }
    const params = new URLSearchParams(query)
    for (const [key, value] of params) {
      if (searchParams.get(key) !== value) return false
    }
    return true
  }

  return (
    <aside
      style={{
        width: '288px',
        flexShrink: 0,
        background: '#f9fafb',
        borderRight: '1px solid #e5e7eb',
        minHeight: 'calc(100vh - 60px)',
        padding: '1rem',
        overflowY: 'auto',
      }}
    >
      <Link
        href="/office"
        style={{
          display: 'block',
          fontSize: '0.875rem',
          color: '#6b7280',
          textDecoration: 'none',
        }}
      >
        ← Назад
      </Link>
      <div
        style={{
          marginTop: '0.75rem',
          marginBottom: '0.75rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#111827',
          }}
        >
          {businessName}
        </div>
      </div>
      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}
      >
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'block',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                lineHeight: 1.375,
                textDecoration: 'none',
                ...(active
                  ? {
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      fontWeight: 500,
                      color: '#1f2937',
                    }
                  : {
                      color: '#1f2937',
                      background: 'transparent',
                    }),
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = '#f3f4f6'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
