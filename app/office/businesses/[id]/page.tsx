import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import BusinessMenu from './BusinessMenu'

interface PageProps {
  params: {
    id: string
  }
}

export default async function BusinessDetailPage({ params }: PageProps) {
  const business = await prisma.business.findUnique({
    where: { id: params.id },
    include: {
      portfolioItems: {
        select: {
          id: true,
          photos: {
            select: { id: true },
          },
        },
      },
      requests: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      _count: {
        select: {
          requests: true,
          invoices: true,
        },
      },
    },
  })

  if (!business) {
    notFound()
  }

  const portfolioCount = business.portfolioItems.reduce(
    (acc, item) => acc + item.photos.length,
    0,
  )

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/office" style={{ color: '#666', textDecoration: 'underline' }}>
          ← Назад к списку
        </Link>
        <BusinessMenu businessId={business.id} slug={business.slug} />
      </div>

      <h1 style={{ marginBottom: '1rem' }}>{business.name}</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>/{business.slug}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', background: 'white', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{portfolioCount}</h3>
          <p style={{ color: '#666' }}>Портфолио</p>
        </div>
        <div style={{ padding: '1rem', background: 'white', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{business._count.requests}</h3>
          <p style={{ color: '#666' }}>Заявок</p>
        </div>
        <div style={{ padding: '1rem', background: 'white', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{business._count.invoices}</h3>
          <p style={{ color: '#666' }}>Счетов</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <section>
          <h2 style={{ marginBottom: '1rem' }}>Последние заявки</h2>
          {business.requests.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '8px', padding: '1rem' }}>
              <p style={{ color: '#666' }}>Нет заявок</p>
            </div>
          ) : (
            <Link
              href={`/office/businesses/${business.id}/requests`}
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                background: 'white',
                borderRadius: '8px',
                padding: '1rem',
                cursor: 'pointer',
              }}
              className="hover:bg-gray-50"
            >
              Новая заявка
            </Link>
          )}
        </section>

        <section>
          <h2 style={{ marginBottom: '1rem' }}>Последние счета</h2>
          <div style={{ background: 'white', borderRadius: '8px', padding: '1rem' }}>
            {business.invoices.length === 0 ? (
              <p style={{ color: '#666' }}>Нет счетов</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {business.invoices.map((invoice) => (
                  <div key={invoice.id} style={{ padding: '0.75rem', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                    <h4 style={{ marginBottom: '0.25rem' }}>{invoice.number}</h4>
                    <p style={{ fontSize: '0.85rem', color: '#666' }}>
                      {invoice.amount.toString()} {invoice.currency} • {invoice.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
