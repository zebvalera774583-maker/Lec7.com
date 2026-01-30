import Link from 'next/link'

interface RequestsPageProps {
  params: { id: string }
}

export default function RequestsPage({ params }: RequestsPageProps) {
  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href={`/office/businesses/${params.id}`} style={{ color: '#666', textDecoration: 'underline' }}>
          ← Назад к бизнесу
        </Link>
      </div>
      <h1>Заявки</h1>
    </main>
  )
}
