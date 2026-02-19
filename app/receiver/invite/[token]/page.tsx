import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { getAuthUserFromContext } from '@/lib/middleware'
import ReceiverInviteClient from './ReceiverInviteClient'
import { cookies, headers } from 'next/headers'

interface PageProps {
  params: { token: string }
}

export default async function ReceiverInvitePage({ params }: PageProps) {
  const invite = await prisma.receiverInvite.findUnique({
    where: { token: params.token },
    include: { business: true },
  })

  if (!invite) {
    notFound()
  }

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
    redirect(`/login?redirect=${encodeURIComponent(`/receiver/invite/${params.token}`)}`)
  }

  if (!invite.usedAt) {
    await prisma.$transaction([
      prisma.receiverInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'RECEIVER',
          receiverBusinessId: invite.businessId,
        },
      }),
    ])
  }

  return <ReceiverInviteClient />
}
