export default function ReceiverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <header
        style={{
          padding: '1rem 1.5rem',
          background: 'white',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
          Receiver panel
        </h1>
      </header>
      <main style={{ padding: '1.5rem' }}>{children}</main>
    </div>
  )
}
