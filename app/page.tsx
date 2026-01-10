import { prisma } from '@/lib/prisma'
import BusinessCard from '@/components/BusinessCard'
import HoverLink from '@/components/HoverLink'
import Link from 'next/link'

// Делаем страницу динамической, чтобы Prisma вызывалась только на runtime
export const dynamic = 'force-dynamic'

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
      // city: true, // Поле отсутствует в схеме Prisma
      // category: true, // Поле отсутствует в схеме Prisma
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
          <HoverLink 
            href="#businesses"
            variant="secondary"
          >
            <span style={{ fontSize: '1.2rem' }}>←</span>
            <span>Посмотреть предложения бизнесов</span>
          </HoverLink>
          
          <HoverLink 
            href="/office"
            variant="primary"
          >
            <span>Создать свой бизнес</span>
            <span style={{ fontSize: '1.2rem' }}>→</span>
          </HoverLink>
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
