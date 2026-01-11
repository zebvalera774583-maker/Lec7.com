import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: {
    slug: string
  }
}

export default async function BizPage({ params }: PageProps) {
  const business = await prisma.business.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      category: true,
    },
  })

  if (!business) {
    notFound()
  }

  return (
    <main style={{ 
      minHeight: '100vh',
      background: '#ffffff',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <header style={{ marginBottom: '3rem' }}>
          <Link 
            href="/visitor"
            style={{
              display: 'inline-block',
              marginBottom: '2rem',
              color: '#0070f3',
              textDecoration: 'none',
              fontSize: '1rem'
            }}
          >
            ← Назад к списку бизнесов
          </Link>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: '0 0 1rem 0'
          }}>
            {business.name}
          </h1>
          <p style={{
            color: '#666',
            fontSize: '1.1rem',
            margin: 0
          }}>
            {business.city} • {business.category}
          </p>
        </header>
      </div>
    </main>
  )
}
