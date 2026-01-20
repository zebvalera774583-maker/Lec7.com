import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAuthUserFromContext } from '@/lib/middleware'

/**
 * Алиас-редирект для совместимости.
 * Правила:
 * - Не авторизован → /
 * - LEC7_ADMIN → /admin
 * - Есть businessId → /office
 * - Иначе → /
 */
export default function OwnerRedirectPage() {
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

  // Не авторизован → /
  if (!user) {
    redirect('/')
  }

  // LEC7_ADMIN → /admin
  if (user.role === 'LEC7_ADMIN') {
    redirect('/admin')
  }

  // Есть businessId → /office
  if (user.businessId) {
    redirect('/office')
  }

  // Иначе → /
  redirect('/')
}
