import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PortfolioGallery from '@/components/PortfolioGallery'
import AIChat from '@/components/AIChat'

interface PageProps {
  params: {
    slug: string
  }
}

export default async function BusinessPage({ params }: PageProps) {
  const business = await prisma.business.findUnique({
    where: { slug: params.slug },
    include: {
      portfolios: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!business) {
    notFound()
  }

  return (
    <main style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '3rem' }}>
          {business.logoUrl && (
            <img 
              src={business.logoUrl} 
              alt={business.name}
              style={{ maxWidth: '200px', marginBottom: '1rem' }}
            />
          )}
          <h1>{business.name}</h1>
          {business.description && (
            <p style={{ marginTop: '1rem', color: '#666' }}>{business.description}</p>
          )}
        </header>

        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ marginBottom: '2rem' }}>Портфолио</h2>
          <PortfolioGallery portfolios={business.portfolios} />
        </section>

        <section>
          <h2 style={{ marginBottom: '2rem' }}>Связаться с нами</h2>
          <AIChat businessId={business.id} businessName={business.name} />
        </section>
      </div>
    </main>
  )
}
