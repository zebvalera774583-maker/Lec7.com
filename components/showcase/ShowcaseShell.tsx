import Link from 'next/link'

interface ShowcaseShellProps {
  children: React.ReactNode
  /**
   * Служебная ссылка для превью резидента.
   * Если не передана — витрина считается публичной.
   */
  backLink?: {
    href: string
    label?: string
  }
}

export default function ShowcaseShell({ children, backLink }: ShowcaseShellProps) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f7f2ee',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Верхняя полоса с логотипом и служебной ссылкой (для превью) */}
      <div
        style={{
          borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: '1.15rem',
                letterSpacing: '0.02em',
                color: '#0f172a',
              }}
            >
              Lec7
            </span>
          </Link>

          {backLink && (
            <Link
              href={backLink.href}
              style={{
                fontSize: '0.9rem',
                color: '#111827',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {backLink.label ?? '← Вернуться в кабинет'}
            </Link>
          )}
        </div>
      </div>

      {/* Контент витрины */}
      <div
        style={{
          flex: 1,
          padding: '2.5rem 1.5rem 3rem',
        }}
      >
        <div
          style={{
            maxWidth: '1120px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 0,
              border: '1px solid rgba(15, 23, 42, 0.06)',
              padding: '3rem 3rem 2.5rem',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </main>
  )
}

