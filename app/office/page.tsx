import { prisma } from '@/lib/prisma'
import { getAuthUserFromContext } from '@/lib/middleware'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function OfficePage() {
  const headersList = headers()
  const cookiesList = cookies()

  // Пользователь уже залогинен (защита в layout.tsx)
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
    redirect('/login?redirect=/office')
  }

  // Ищем первый бизнес пользователя (1 резидент = 1 бизнес)
  const business = await prisma.business.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  // Если бизнес найден → редирект на страницу бизнеса
  if (business) {
    redirect(`/office/businesses/${business.id}`)
  }

  // Если бизнеса нет → редирект на создание
  redirect('/office/businesses/new')
}
