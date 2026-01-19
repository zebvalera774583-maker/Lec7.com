import { headers, cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getAuthUserFromContext } from '@/lib/middleware'
import PlaybookList from '@/components/PlaybookList'
import QuickActions from '@/components/QuickActions'
import Link from 'next/link'

export default function OwnerHomePage() {
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

  if (!isAuthed) {
    redirect('/login?redirect=/owner')
  }

  // Доступ только для LEC7_ADMIN
  if (user!.role !== 'LEC7_ADMIN') {
    notFound()
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.875rem', fontWeight: 700 }}>
          Моя страница
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1rem' }}>
          Центр управления и принятия решений для платформы Lec7
        </p>
        <div style={{ marginTop: '1rem' }}>
          <Link
            href="/owner/businesses"
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Мои бизнесы
          </Link>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: '1.5rem',
          alignItems: 'flex-start',
        }}
      >
        {/* Основной контент */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Playbook */}
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
            }}
          >
            <PlaybookList />
          </div>
        </div>

        {/* Боковая панель */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <QuickActions />
        </div>
      </div>

      {/* Примечание о Owner Agent */}
      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          fontSize: '0.875rem',
          color: '#1e40af',
        }}
      >
        <strong>💡 Совет:</strong> Owner Agent доступен в правой панели. Используйте его для
        принятия решений и накопления опыта в Playbook.
      </div>
    </div>
  )
}
