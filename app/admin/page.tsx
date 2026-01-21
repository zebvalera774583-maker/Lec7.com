import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminPage() {
  const stats = {
    businesses: await prisma.business.count(),
    users: await prisma.user.count(),
    requests: await prisma.request.count(),
    invoices: await prisma.invoice.count(),
  }

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Админ-панель</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', background: 'white', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{stats.businesses}</h3>
          <p style={{ color: '#666' }}>Бизнесов</p>
        </div>
        <div style={{ padding: '1.5rem', background: 'white', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{stats.users}</h3>
          <p style={{ color: '#666' }}>Пользователей</p>
        </div>
        <div style={{ padding: '1.5rem', background: 'white', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{stats.requests}</h3>
          <p style={{ color: '#666' }}>Заявок</p>
        </div>
        <div style={{ padding: '1.5rem', background: 'white', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{stats.invoices}</h3>
          <p style={{ color: '#666' }}>Счетов</p>
        </div>
      </div>

      <section aria-label="Управление бизнесами" style={{ marginTop: '2rem' }}>
        <Link
          href="/admin/businesses"
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '1.25rem 1.5rem',
            background: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            textDecoration: 'none',
            gap: '0.35rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Навигация
          </span>
          <span style={{ fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
            Управление бизнесами
          </span>
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Перейти к списку бизнесов, их активации и статусам.
          </span>
        </Link>
      </section>
    </main>
  )
}
