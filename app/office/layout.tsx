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
    redirect('/login?redirect=/office')
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
          <div>
            <span>{user.email}</span>
            <a href="/api/auth/logout" style={{ marginLeft: '1rem', color: '#666' }}>
              Выйти
            </a>
          </div>
        </div>
      </nav>

      {children}
    </div>
  )
}
