import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface PageProps {
  params: {
    id: string
  }
}

export default async function BusinessDetailPage({ params }: PageProps) {
  const business = await prisma.business.findUnique({
    where: { id: params.id },
    include: {
      requests: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      _count: {
        select: {
          portfolios: true,
          requests: true,
          invoices: true,
        },
      },
    },
  })

  if (!business) {
    notFound()
  }

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/office" style={{ color: '#666', textDecoration: 'underline' }}>
          ← Назад к списку
        </Link>
      </div>

      <h1 style={{ marginBottom: '1rem' }}>{business.name}</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>/{business.slug}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', background: 'white', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{business._count.portfolios}</h3>
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
          <div style={{ background: 'white', borderRadius: '8px', padding: '1rem' }}>
            {business.requests.length === 0 ? (
              <p style={{ color: '#666' }}>Нет заявок</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {business.requests.map((request) => (
                  <div key={request.id} style={{ padding: '0.75rem', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                    <h4 style={{ marginBottom: '0.25rem' }}>{request.title}</h4>
                    <p style={{ fontSize: '0.85rem', color: '#666' }}>{request.status}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
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
