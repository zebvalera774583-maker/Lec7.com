import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/middleware'
import { headers } from 'next/headers'
import Link from 'next/link'

export default async function OfficePage() {
  const headersList = await headers()
  const user = getAuthUser({
    headers: () => headersList,
    cookies: {
      get: (name: string) => {
        const cookieHeader = headersList.get('cookie')
        if (!cookieHeader) return undefined
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=')
          acc[key] = value
          return acc
        }, {} as Record<string, string>)
        return { value: cookies[name] } as { value: string } | undefined
      },
    } as any,
  } as any)

  if (!user) {
    return <div>Не авторизован</div>
  }

  const businesses = await prisma.business.findMany({
    where: { ownerId: user.id },
    include: {
      _count: {
        select: {
          requests: true,
          invoices: true,
        },
      },
    },
  })

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Мои бизнесы</h1>

      {businesses.length === 0 ? (
        <div style={{ padding: '2rem', background: 'white', borderRadius: '8px', textAlign: 'center' }}>
          <p style={{ marginBottom: '1rem' }}>У вас пока нет бизнесов</p>
          <Link 
            href="/office/businesses/new"
            style={{ 
              display: 'inline-block', 
              padding: '0.75rem 1.5rem', 
              background: '#0070f3', 
              color: 'white', 
              borderRadius: '4px' 
            }}
          >
            Создать бизнес
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {businesses.map((business) => (
            <Link
              key={business.id}
              href={`/office/businesses/${business.id}`}
              style={{
                display: 'block',
                padding: '1.5rem',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <h3 style={{ marginBottom: '0.5rem' }}>{business.name}</h3>
              <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
                {business.slug}
              </p>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#888' }}>
                <span>Заявок: {business._count.requests}</span>
                <span>Счетов: {business._count.invoices}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
