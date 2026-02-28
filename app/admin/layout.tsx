import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifyToken } from '@/lib/auth'

const SIDEBAR_ITEMS = [
  { label: 'AI-агент', href: '/admin' },
  { label: 'Бизнесы', href: '/admin/businesses' },
  { label: 'Справочник бота', href: '/admin/bot-tools' },
] as const

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const h = headers()
  // Используем x-pathname, который устанавливается middleware
  const pathname = h.get('x-pathname') || '/admin'
  
  // Пропускаем проверку для страницы логина, чтобы избежать бесконечного редиректа
  if (pathname.startsWith('/admin/login')) {
    return <>{children}</>
  }

  const target = pathname.startsWith('/admin') ? pathname : '/admin'
  const redirectTarget = `/admin/login?redirect=${encodeURIComponent(target)}`

  const token = cookies().get('auth_token')?.value

  if (!token) {
    redirect(redirectTarget)
  }

  const user = verifyToken(token)

  if (!user || user.role !== 'LEC7_ADMIN') {
    redirect(redirectTarget)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <nav style={{ background: 'white', padding: '1rem 2rem', borderBottom: '1px solid #e0e0e0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Lec7 Admin</h2>
          <div>
            <span>{user.email}</span>
            <a href="/api/auth/logout" style={{ marginLeft: '1rem', color: '#666' }}>Выйти</a>
          </div>
        </div>
      </nav>
      <div style={{ display: 'flex', maxWidth: '1200px', margin: '0 auto' }}>
        <aside
          style={{
            minWidth: '200px',
            padding: '2rem 0 2rem 2rem',
            borderRight: '1px solid #e5e7eb',
          }}
        >
          {SIDEBAR_ITEMS.map(({ label, href }) => {
            const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'block',
                  padding: '0.75rem 1.5rem',
                  color: isActive ? '#111827' : '#6b7280',
                  fontWeight: isActive ? 600 : 500,
                  textDecoration: 'none',
                  borderLeft: isActive ? '2px solid #111827' : '2px solid transparent',
                  marginLeft: isActive ? '-2px' : 0,
                }}
              >
                {label}
              </Link>
            )
          })}
        </aside>
        <main style={{ flex: 1, padding: '2rem' }}>{children}</main>
      </div>
    </div>
  )
}
