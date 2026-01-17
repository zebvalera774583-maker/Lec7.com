import { prisma } from '@/lib/prisma'
import { getAuthUserFromContext } from '@/lib/middleware'
import { headers, cookies } from 'next/headers'
import Link from 'next/link'

export default async function OfficePage() {
  const headersList = headers()
  const cookiesList = cookies()

  const user = getAuthUserFromContext({
    headers: { get: (name: string) => headersList.get(name) },
    cookies: {
      get: (name: string) => {
        const c = cookiesList.get(name)
        return c ? { value: c.value } : undefined
      },
    },
  })

  if (!user) {
    return <div>Не авторизован</div>
  }

  const businesses = await prisma.business.findMany({
    where: { ownerId: user.id },
    select: {
      id: true,
      name: true,
      slug: true,
      lifecycleStatus: true,
      billingStatus: true,
      _count: {
        select: {
          requests: true,
          invoices: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
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
              borderRadius: '4px',
            }}
          >
            Создать бизнес
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {businesses.map((business) => {
            const identifier = business.slug || business.id.slice(0, 8)
            const lifecycleLabel = business.lifecycleStatus === 'ACTIVE' ? 'ACTIVE' : business.lifecycleStatus === 'DRAFT' ? 'DRAFT' : business.lifecycleStatus || 'DRAFT'
            const billingLabel = business.billingStatus === 'PAID' ? 'PAID' : business.billingStatus === 'UNPAID' ? 'UNPAID' : business.billingStatus || 'UNPAID'
            
            return (
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
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
              >
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem', fontWeight: '600' }}>
                  {business.name}
                </h3>
                
                <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: '#666' }}>
                  <span style={{ fontFamily: 'monospace', background: '#f5f5f5', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                    /{identifier}
                  </span>
                </div>

                <div style={{ 
                  display: 'flex', 
                  gap: '0.5rem', 
                  marginBottom: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    background: lifecycleLabel === 'ACTIVE' ? '#d1fae5' : '#fef3c7',
                    color: lifecycleLabel === 'ACTIVE' ? '#065f46' : '#92400e'
                  }}>
                    {lifecycleLabel}
                  </span>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    background: billingLabel === 'PAID' ? '#dbeafe' : '#fee2e2',
                    color: billingLabel === 'PAID' ? '#1e40af' : '#991b1b'
                  }}>
                    {billingLabel}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#888', borderTop: '1px solid #f0f0f0', paddingTop: '0.75rem' }}>
                  <span>Заявок: {business._count.requests}</span>
                  <span>Счетов: {business._count.invoices}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
