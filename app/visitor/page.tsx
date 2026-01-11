import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import BusinessCardLink from '@/components/BusinessCardLink'

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
              <BusinessCardLink key={business.id} business={business} />
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
