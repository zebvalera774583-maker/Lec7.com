import { getAuthUserFromContext } from '@/lib/middleware'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function ReceiverDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookiesList = cookies()
  const headersList = headers()
  const user = getAuthUserFromContext({
    headers: { get: (name: string) => headersList.get(name) },
    cookies: {
      get: (name: string) => {
        const c = cookiesList.get(name)
        return c ? { value: c.value } : undefined
      },
    },
  })

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent('/receiver/requests')}`)
  }

  if (user.role !== 'RECEIVER') {
    redirect('/login')
  }

  return <>{children}</>
}
