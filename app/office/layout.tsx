import { getAuthUser } from '@/lib/middleware'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function OfficeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const user = getAuthUser({
    headers: () => headersList,
    cookies: {
      get: (name: string) => {
        const cookieHeader = headersList.get('cookie')
        if (!cookieHeader) return undefined
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=')
          acc[key] = value
          return acc
        }, {} as Record<string, string>)
        return { value: cookies[name] } as { value: string } | undefined
      },
    } as any,
  } as any)

  if (!user || user.role !== 'BUSINESS_OWNER') {
    redirect('/login?redirect=/office')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <nav style={{ background: 'white', padding: '1rem 2rem', borderBottom: '1px solid #e0e0e0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Office</h2>
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
