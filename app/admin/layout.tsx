import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'

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
      {children}
    </div>
  )
}
