import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAuthUserFromContext } from '@/lib/middleware'

export default function OwnerEntryPage() {
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

  if (user!.role === 'LEC7_ADMIN') {
    redirect('/owner/admin')
  }

  redirect('/owner/welcome')
}
