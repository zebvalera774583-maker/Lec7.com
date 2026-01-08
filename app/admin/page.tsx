import { prisma } from '@/lib/prisma'

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
    </main>
  )
}
