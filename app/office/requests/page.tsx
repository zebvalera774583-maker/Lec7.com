import { prisma } from '@/lib/prisma'
import { getAuthUserFromContext } from '@/lib/middleware'
import { headers, cookies } from 'next/headers'
import Link from 'next/link'

export default async function RequestsPage() {
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

  if (!user) {
    return null
  }

  // Находим бизнес пользователя
  const business = await prisma.business.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  if (!business) {
    return (
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <Link href="/office" style={{ color: '#666', textDecoration: 'underline', marginBottom: '1rem', display: 'inline-block' }}>
          ← Назад
        </Link>
        <h1 style={{ marginBottom: '0.5rem' }}>Заявки</h1>
        <p style={{ color: '#666' }}>Сначала создайте бизнес</p>
      </main>
    )
  }

  // Получаем все заявки для бизнеса
  const requests = await prisma.request.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: 'desc' },
  })

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      NEW: 'Новая',
      IN_PROGRESS: 'В работе',
      COMPLETED: 'Завершена',
      CANCELLED: 'Отменена',
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NEW: '#3b82f6',
      IN_PROGRESS: '#f59e0b',
      COMPLETED: '#10b981',
      CANCELLED: '#ef4444',
    }
    return colors[status] || '#6b7280'
  }

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link
          href={`/office/businesses/${business.id}`}
          style={{ color: '#666', textDecoration: 'underline', marginBottom: '1rem', display: 'inline-block' }}
        >
          ← Назад
        </Link>
      </div>

      <h1 style={{ marginBottom: '1rem' }}>Заявки</h1>

      {requests.length === 0 ? (
        <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', textAlign: 'center' }}>
          <p style={{ color: '#666', margin: 0 }}>Нет заявок</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {requests.map((request) => (
            <div
              key={request.id}
              style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>
                  {request.title}
                </h3>
                <span
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    background: getStatusColor(request.status) + '20',
                    color: getStatusColor(request.status),
                  }}
                >
                  {getStatusLabel(request.status)}
                </span>
              </div>

              <p style={{ margin: '0 0 0.75rem 0', color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.6 }}>
                {request.description}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                {request.clientName && (
                  <span>
                    <strong>Имя:</strong> {request.clientName}
                  </span>
                )}
                {request.clientPhone && (
                  <span>
                    <strong>Телефон:</strong> {request.clientPhone}
                  </span>
                )}
                {request.clientEmail && (
                  <span>
                    <strong>Email:</strong> {request.clientEmail}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {formatDate(request.createdAt)}
                {request.source && request.source !== 'ai_chat' && (
                  <span style={{ marginLeft: '0.5rem' }}>• Источник: {request.source}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
