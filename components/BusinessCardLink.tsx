'use client'

import Link from 'next/link'

interface BusinessCardLinkProps {
  business: {
    id: string
    slug: string
    name: string
    city: string | null
    category: string | null
  }
}

export default function BusinessCardLink({ business }: BusinessCardLinkProps) {
  const cityLabel = business.city && business.city.trim().length > 0 ? business.city : 'Город не указан'
  const categoryLabel =
    business.category && business.category.trim().length > 0 ? business.category : 'Категория не указана'

  return (
    <Link
      href={`/biz/${business.slug}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: '18px',
        background: '#f9fafb',
        boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
        overflow: 'hidden',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 22px 55px rgba(15, 23, 42, 0.14)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 18px 45px rgba(15, 23, 42, 0.08)'
      }}
    >
      <div
        style={{
          height: '140px',
          background: 'linear-gradient(135deg, #e5e7eb 0%, #f3f4f6 40%, #e5e7eb 100%)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '18px 20px 18px 20px',
            borderRadius: '14px',
            background:
              'radial-gradient(circle at 0% 0%, rgba(156,163,175,0.35), transparent 55%), radial-gradient(circle at 100% 100%, rgba(148,163,184,0.2), transparent 50%)',
          }}
        />
      </div>
      <div
        style={{
          padding: '0.9rem 1.1rem 1.05rem',
          backgroundColor: '#fdfdfd',
        }}
      >
        <h2
          style={{
            fontSize: '0.98rem',
            fontWeight: 600,
            margin: '0 0 0.3rem 0',
            color: '#111827',
          }}
        >
          {business.name}
        </h2>
        <p
          style={{
            color: '#6b7280',
            margin: 0,
            fontSize: '0.82rem',
          }}
        >
          {cityLabel} • {categoryLabel}
        </p>
      </div>
    </Link>
  )
}
