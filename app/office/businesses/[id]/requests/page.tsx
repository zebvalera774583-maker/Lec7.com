import Link from 'next/link'

interface RequestsPageProps {
  params: { id: string }
}

export default function RequestsPage({ params }: RequestsPageProps) {
  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '1rem', fontSize: '2rem' }}>Заявки</h1>

      <Link
        href={`/office/businesses/${params.id}`}
        style={{ padding: '0.25rem 0', color: '#111827', fontSize: '1rem', fontWeight: 500, textDecoration: 'none', display: 'inline-block', width: 'fit-content', marginBottom: '0.25rem' }}
      >
        Назад
      </Link>

      <p style={{ padding: '0.25rem 0', color: '#111827', fontSize: '1rem', fontWeight: 500, margin: 0 }}>
        Создать заявку
      </p>

      <p style={{ padding: '0.25rem 0', color: '#111827', fontSize: '1rem', fontWeight: 500, margin: 0 }}>
        Поступившие заявки
      </p>
    </main>
  )
}
