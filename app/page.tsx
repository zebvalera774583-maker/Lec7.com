import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Lec7 Platform</h1>
      <p>Платформа для бизнеса с AI-интеграцией</p>
      
      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <Link href="/office" style={{ padding: '0.5rem 1rem', background: '#0070f3', color: 'white', borderRadius: '4px' }}>
          Office
        </Link>
        <Link href="/admin" style={{ padding: '0.5rem 1rem', background: '#666', color: 'white', borderRadius: '4px' }}>
          Admin
        </Link>
      </div>
    </main>
  )
}
