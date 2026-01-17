import Link from 'next/link'

export default function NewBusinessPage() {
  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link 
          href="/office" 
          style={{ 
            color: '#666', 
            textDecoration: 'underline',
            display: 'inline-block',
            marginBottom: '1rem'
          }}
        >
          ← Назад в кабинет
        </Link>
      </div>

      <h1 style={{ marginBottom: '1rem' }}>Создать бизнес</h1>
      
      <p style={{ 
        color: '#666', 
        marginBottom: '2rem',
        fontSize: '1rem',
        lineHeight: '1.6'
      }}>
        Заполните данные, чтобы создать бизнес на Lec7.
      </p>
    </main>
  )
}
