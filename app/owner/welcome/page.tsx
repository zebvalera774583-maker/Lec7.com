import Link from 'next/link'
import HoverLink from '@/components/HoverLink'

export default function OwnerWelcomePage() {
  return (
    <main style={{ 
      minHeight: '100vh',
      background: '#ffffff',
      padding: '2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ 
        maxWidth: '600px',
        textAlign: 'center'
      }}>
        <header style={{ marginBottom: '3rem' }}>
          <Link 
            href="/"
            style={{
              display: 'inline-block',
              marginBottom: '2rem',
              color: '#0070f3',
              textDecoration: 'none',
              fontSize: '1rem'
            }}
          >
            ← На главную
          </Link>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: '0 0 1rem 0',
            lineHeight: '1.2'
          }}>
            Добро пожаловать!
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: '#666',
            margin: 0,
            lineHeight: '1.6'
          }}>
            Создайте страницу вашего бизнеса и начните привлекать клиентов
          </p>
        </header>

        <div style={{ marginTop: '3rem' }}>
          <HoverLink 
            href="/owner/admin"
            variant="primary"
          >
            <span>Создать бизнес</span>
            <span style={{ fontSize: '1.2rem' }}>→</span>
          </HoverLink>
        </div>
      </div>
    </main>
  )
}
