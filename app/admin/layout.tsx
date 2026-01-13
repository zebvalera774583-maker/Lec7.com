import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import jwt from 'jsonwebtoken'

type JwtPayload = {
  id?: string
  email?: string
  role?: string
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const token = cookies().get('token')?.value

  if (!token) {
    redirect('/login?redirect=/admin')
  }

  let user: JwtPayload | null = null
  try {
    user = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload
  } catch {
    user = null
  }

  if (!user || user.role !== 'LEC7_ADMIN') {
    redirect('/login?redirect=/admin')
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
