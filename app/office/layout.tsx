import { getAuthUserFromContext } from '@/lib/middleware'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function OfficeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = headers()
  const cookiesList = cookies()

  const user = getAuthUserFromContext({
    headers: { get: (name: string) => headersList.get(name) },
    cookies: {
      get: (name: string) => {
        const c = cookiesList.get(name)
        return c ? { value: c.value } : undefined
      },
    },
  })

  if (!user || !['BUSINESS_OWNER', 'LEC7_ADMIN'].includes(user.role)) {
    // Получаем текущий pathname из заголовков
    // Пробуем x-pathname (если установлен middleware), затем x-invoke-path, затем referer
    let pathname = headersList.get('x-pathname') || headersList.get('x-invoke-path')
    
    if (!pathname) {
      // Fallback: извлекаем из referer
      const referer = headersList.get('referer')
      if (referer) {
        try {
          const url = new URL(referer)
          pathname = url.pathname + url.search
        } catch {
          pathname = '/office'
        }
      } else {
        pathname = '/office'
      }
    }
    
    redirect(`/resident/login?redirect=${encodeURIComponent(pathname)}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <nav style={{ background: 'white', padding: '1rem 2rem', borderBottom: '1px solid #e0e0e0' }}>
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2>Office</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Вы вошли как:</span>
            <span
              style={{
                padding: '0.35rem 0.75rem',
                background: '#eff6ff',
                color: '#1e40af',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {user.email}
            </span>
            <a href="/api/auth/logout" style={{ marginLeft: '0.25rem', color: '#6b7280', fontSize: '0.875rem', textDecoration: 'underline' }}>
              Выйти
            </a>
          </div>
        </div>
      </nav>

      {children}
    </div>
  )
}
