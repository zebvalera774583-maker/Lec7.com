import { prisma } from '@/lib/prisma'
import BusinessCard from '@/components/BusinessCard'
import Link from 'next/link'

export default async function HomePage() {
  // Получаем список всех бизнесов для каталога
  const businesses = await prisma.business.findMany({
    take: 12, // Показываем первые 12 бизнесов
    orderBy: {
      createdAt: 'desc', // Новые сначала
    },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      coverUrl: true,
      logoUrl: true,
      city: true,
      category: true,
    },
  })

  return (
    <main style={{ 
      minHeight: '100vh',
      background: '#ffffff'
    }}>
      {/* Header */}
      <header style={{
        padding: '3rem 2rem 2rem',
        textAlign: 'center',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: '0 0 1rem 0',
            lineHeight: '1.2'
          }}>
            Место, где бизнес и клиент находят друг друга
          </h1>
        </div>
        
        <p style={{
          fontSize: '1.1rem',
          color: '#666',
          margin: '0 0 2rem 0',
          lineHeight: '1.6',
          maxWidth: '700px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          Создайте страницу бизнеса или найдите нужное предложение. Обсудите детали, оплатите и получите документы — в одном месте.
        </p>

        {/* Navigation Buttons */}
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: '3rem',
          flexWrap: 'wrap'
        }}>
          <Link 
            href="#businesses"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 2rem',
              background: '#f5f5f5',
              color: '#1a1a1a',
              textDecoration: 'none',
              fontSize: '1rem',
              fontWeight: '500',
              borderRadius: '8px',
              border: '2px solid #e0e0e0',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e8e8e8'
              e.currentTarget.style.borderColor = '#d0d0d0'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f5f5f5'
              e.currentTarget.style.borderColor = '#e0e0e0'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>←</span>
            <span>Посмотреть предложения бизнесов</span>
          </Link>
          
          <Link 
            href="/office"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 2rem',
              background: '#0070f3',
              color: 'white',
              textDecoration: 'none',
              fontSize: '1rem',
              fontWeight: '600',
              borderRadius: '8px',
              border: '2px solid #0070f3',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0, 112, 243, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#0051cc'
              e.currentTarget.style.borderColor = '#0051cc'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 112, 243, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#0070f3'
              e.currentTarget.style.borderColor = '#0070f3'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 112, 243, 0.3)'
            }}
          >
            <span>Создать свой бизнес</span>
            <span style={{ fontSize: '1.2rem' }}>→</span>
          </Link>
        </div>
      </header>

      {/* Business Catalog */}
      <section 
        id="businesses"
        style={{
          padding: '3rem 2rem',
          maxWidth: '1200px',
          margin: '0 auto'
        }}
      >
        {businesses.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '2rem',
            marginBottom: '4rem'
          }}>
            {businesses.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            color: '#666'
          }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
              Пока нет зарегистрированных бизнесов
            </p>
            <Link 
              href="/office"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                background: '#0070f3',
                color: 'white',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '1rem'
              }}
            >
              Создать первый бизнес
            </Link>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer style={{
        padding: '3rem 2rem',
        textAlign: 'center',
        borderTop: '1px solid #e0e0e0',
        marginTop: '4rem'
      }}>
        <p style={{
          color: '#666',
          fontSize: '0.9rem',
          margin: 0,
          maxWidth: '800px',
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: '1.6'
        }}>
          Lec7 — это инфраструктура для взаимодействия бизнеса и клиентов, а не витрина и не социальная сеть.
        </p>
      </footer>
    </main>
  )
}
