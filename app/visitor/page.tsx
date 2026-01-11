import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function VisitorPage() {
  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: 'desc' },
    take: 24,
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      category: true,
    },
  })

  return (
    <main style={{ 
      minHeight: '100vh',
      background: '#ffffff',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '3rem' }}>
          <Link 
            href="/"
            style={{
              display: 'inline-block',
              marginBottom: '2rem',
              color: '#0070f3',
              textDecoration: 'none',
              fontSize: '1rem'
            }}
          >
            ← На главную
          </Link>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: 0
          }}>
            Предложения бизнесов
          </h1>
        </header>

        {businesses.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '2rem'
          }}>
            {businesses.map((business) => (
              <Link
                key={business.id}
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
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            color: '#666'
          }}>
            <p style={{ fontSize: '1.1rem' }}>
              Пока нет зарегистрированных бизнесов
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
