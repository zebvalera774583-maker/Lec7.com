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
  return (
    <Link
      href={`/biz/${business.slug}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        padding: '1.5rem',
        borderRadius: '8px',
        background: 'white',
        border: '1px solid #e0e0e0',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: '600',
        margin: '0 0 0.5rem 0',
        color: '#1a1a1a'
      }}>
        {business.name}
      </h2>
      <p style={{
        color: '#666',
        margin: '0.5rem 0',
        fontSize: '0.9rem'
      }}>
        {business.city} • {business.category}
      </p>
    </Link>
  )
}
