import { prisma } from '@/lib/prisma'
import BusinessActivationTable from './BusinessActivationTable'

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
