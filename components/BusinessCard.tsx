'use client'

import Link from 'next/link'

interface BusinessCardProps {
  business: {
    id: string
    slug: string
    name: string
    description: string | null
    coverUrl: string | null
    logoUrl: string | null
    city?: string | null
    category?: string | null
  }
}

export default function BusinessCard({ business }: BusinessCardProps) {
  const imageUrl = business.coverUrl || business.logoUrl || '/placeholder-business.jpg'
  const location = business.city || 'Город не указан'
  const category = business.category || business.description?.split('·')[0]?.trim() || 'Услуги'

  return (
    <Link 
      href={`/b/${business.slug}`}
      className="business-card"
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'white',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}
    >
      <div style={{ 
        width: '100%', 
        aspectRatio: '16/9', 
        position: 'relative',
        overflow: 'hidden',
        background: '#f5f5f5'
      }}>
        <img
          src={imageUrl}
          alt={business.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={(e) => {
            // Fallback на placeholder если изображение не загрузилось
            e.currentTarget.src = 'https://via.placeholder.com/400x225?text=' + encodeURIComponent(business.name)
          }}
        />
      </div>
      <div style={{ padding: '1rem' }}>
        <h3 style={{ 
          margin: '0 0 0.5rem 0', 
          fontSize: '1.1rem',
          fontWeight: '600',
          color: '#1a1a1a'
        }}>
          {business.name}
        </h3>
        <p style={{ 
          margin: 0, 
          fontSize: '0.9rem', 
          color: '#666',
          lineHeight: '1.4'
        }}>
          {location} · {category}
        </p>
      </div>
    </Link>
  )
}
