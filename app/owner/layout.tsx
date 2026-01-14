import { getAuthUserFromContext } from '@/lib/middleware'
import { headers, cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import OwnerAIPanel from '@/components/OwnerAIPanel'

export default async function OwnerLayout({
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

  const isAuthed = !!user?.id && !!user?.role

  // Неавторизованный (нет валидных id/role) → на логин
  if (!isAuthed) {
    redirect('/login?redirect=/owner')
  }

  // Авторизован, но не LEC7_ADMIN → явный запрет доступа
  if (user!.role !== 'LEC7_ADMIN') {
    notFound()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <nav
        style={{
          background: 'white',
          padding: '1rem 2rem',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2>Owner панель</h2>
          <div>
            <span>{user.email}</span>
            <a
              href="/api/auth/logout"
              style={{ marginLeft: '1rem', color: '#666' }}
            >
              Выйти
            </a>
          </div>
        </div>
      </nav>

      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '1.5rem',
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>{children}</div>
        <div
          style={{
            flex: '0 0 380px',
            maxWidth: '100%',
            position: 'sticky',
            top: '1.5rem',
          }}
        >
          <OwnerAIPanel />
        </div>
      </div>
    </div>
  )
}

