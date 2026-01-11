import HoverLink from '@/components/HoverLink'

export default function HomePage() {
  return (
    <main style={{ 
      minHeight: '100vh',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <header style={{
        textAlign: 'center',
        maxWidth: '800px',
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            color: '#1a1a1a',
            margin: '0 0 1rem 0',
            lineHeight: '1.2'
          }}>
            Место, где бизнес и клиент находят друг друга
          </h1>
        </div>
        
        <p style={{
          fontSize: '1.1rem',
          color: '#666',
          margin: '0 0 3rem 0',
          lineHeight: '1.6',
        }}>
          Создайте страницу бизнеса или найдите нужное предложение. Обсудите детали, оплатите и получите документы — в одном месте.
        </p>

        {/* Navigation Buttons */}
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <HoverLink 
            href="/visitor"
            variant="secondary"
          >
            <span style={{ fontSize: '1.2rem' }}>←</span>
            <span>Посмотреть предложения бизнесов</span>
          </HoverLink>
          
          <HoverLink 
            href="/owner/welcome"
            variant="primary"
          >
            <span>Создать свой бизнес</span>
            <span style={{ fontSize: '1.2rem' }}>→</span>
          </HoverLink>
        </div>
      </header>
    </main>
  )
}
