import { prisma } from '@/lib/prisma'
import BusinessActivationTable from './BusinessActivationTable'
import Link from 'next/link'

export default async function OwnerBusinessesPage() {
  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      lifecycleStatus: true,
      billingStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
            <Link
            href="/admin"
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              color: '#374151',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              border: '1px solid #e5e7eb',
            }}
          >
            ← Назад
          </Link>
        </div>
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.875rem', fontWeight: 700 }}>
          Управление бизнесами
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1rem' }}>
          Активация бизнесов для публикации на витрине
        </p>
      </div>

      <BusinessActivationTable businesses={businesses} />
    </div>
  )
}
