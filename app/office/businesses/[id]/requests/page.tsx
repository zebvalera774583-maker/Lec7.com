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
      <h1 style={{ marginBottom: '1.5rem', fontSize: '2rem' }}>Заявки</h1>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button
          style={{
            padding: '12px 24px',
            background: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 500,
            width: '200px',
            height: '44px',
          }}
        >
          Создать заявку
        </button>
        <button
          style={{
            padding: '12px 24px',
            background: '#f3f4f6',
            color: '#111827',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 500,
            width: '200px',
            height: '44px',
          }}
        >
          Поступившие заявки
        </button>
      </div>
    </main>
  )
}
