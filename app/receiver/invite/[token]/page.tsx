import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface PageProps {
  params: { token: string }
}

export default async function ReceiverInvitePage({ params }: PageProps) {
  const invite = await prisma.receiverInvite.findUnique({
    where: { token: params.token },
  })

  if (!invite) {
    notFound()
  }

  return (
    <div
      style={{
        maxWidth: '400px',
        margin: '0 auto',
        padding: '2rem',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <p style={{ marginBottom: '1.5rem', fontSize: '1rem', color: '#374151' }}>
        Страница приёмщика активирована
      </p>
      <Link
        href="/receiver/requests"
        style={{
          display: 'inline-block',
          padding: '0.5rem 1rem',
          background: '#111827',
          color: 'white',
          borderRadius: '6px',
          textDecoration: 'none',
          fontSize: '0.9375rem',
          fontWeight: 500,
        }}
      >
        Перейти к заявкам
      </Link>
    </div>
  )
}
