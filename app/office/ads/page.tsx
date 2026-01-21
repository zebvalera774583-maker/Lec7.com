import { prisma } from '@/lib/prisma'
import { headers, cookies } from 'next/headers'
import { getAuthUserFromContext } from '@/lib/middleware'
import AdsPlannerClient from './AdsPlannerClient'

interface AdsPageProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdsPage({ searchParams }: AdsPageProps) {
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

  const rawBusinessId = searchParams.businessId
  const businessId = Array.isArray(rawBusinessId) ? rawBusinessId[0] : rawBusinessId || null

  let businessName: string | null = null

  if (businessId) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, ownerId: true },
    })

    if (business && (!user || business.ownerId !== user.id)) {
      // Не подсвечиваем название чужого бизнеса, но сам доступ к странице контролируется layout'ом
      businessName = null
    } else if (business) {
      businessName = business.name
    }
  }

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: 700 }}>Организация рекламы</h1>
        <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.95rem' }}>
          Сформируйте рекламный план и рекомендации с помощью AI-агента Lec7.
        </p>
      </header>

      <AdsPlannerClient businessId={businessId} businessName={businessName} />
    </main>
  )
}

