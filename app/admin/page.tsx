import { prisma } from '@/lib/prisma'
import AdminDashboardClient from './AdminDashboardClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminPage() {
  // Получаем данные для активации бизнесов (точная копия select из /app/admin/businesses/page.tsx)
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

  return <AdminDashboardClient businesses={businesses} />
}
