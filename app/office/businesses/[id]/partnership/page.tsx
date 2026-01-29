import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface PageProps {
  params: {
    id: string
  }
}

export default async function PartnershipPage({ params }: PageProps) {
  const business = await prisma.business.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      slug: true,
    },
  })

  if (!business) {
    notFound()
  }

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href={`/office/businesses/${business.id}`} style={{ color: '#666', textDecoration: 'underline' }}>
          ← Назад к бизнесу
        </Link>
      </div>

      <h1 style={{ marginBottom: '1rem', fontSize: '2rem' }}>Партнёрство</h1>
      <p style={{ color: '#666', fontSize: '1rem', lineHeight: 1.6 }}>
        Здесь настраивается сотрудничество с партнёрами: прайсы, подключения, условия.
      </p>
    </main>
  )
}
