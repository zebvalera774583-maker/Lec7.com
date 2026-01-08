import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>404</h1>
      <p style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Страница не найдена</p>
      <Link 
        href="/"
        style={{ 
          padding: '0.75rem 1.5rem', 
          background: '#0070f3', 
          color: 'white', 
          borderRadius: '4px',
          textDecoration: 'none'
        }}
      >
        На главную
      </Link>
    </div>
  )
}
