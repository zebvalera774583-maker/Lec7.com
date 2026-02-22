import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'

interface LayoutProps {
  children: React.ReactNode
  params: { id: string }
}

export default async function BusinessLayout({ children, params }: LayoutProps) {
  const business = await prisma.business.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, slug: true },
  })

  if (!business) {
    notFound()
  }

  const navItems = [
    { href: `/office/businesses/${business.id}`, label: 'Обзор' },
    { href: `/office/businesses/${business.id}/preview`, label: 'Витрина' },
    { href: `/office/businesses/${business.id}/profile`, label: 'Профиль' },
    { href: `/office/businesses/${business.id}/requisites`, label: 'Реквизиты предприятия' },
    { href: `/office/businesses/${business.id}/requests?section=create`, label: 'Создать заявку' },
    { href: `/office/businesses/${business.id}/requests`, label: 'Поступившие заявки' },
    { href: `/office/businesses/${business.id}/requests?section=archive`, label: 'Архив заявок' },
    { href: `/office/businesses/${business.id}/partnership`, label: 'Потребности' },
    { href: `/office/businesses/${business.id}/partnership`, label: 'Партнёрство' },
    { href: `/office/businesses/${business.id}/prices/compare`, label: 'Сводная таблица прайсов' },
    { href: `/office/businesses/${business.id}/partnership?action=create-price`, label: 'Создать прайс' },
    { href: `/office/businesses/${business.id}/partnership?action=import-price`, label: 'Импорт прайса' },
    { href: `/office/businesses/${business.id}/partnership?section=incoming`, label: 'Запросы на подключение контрагентов' },
    { href: `/office/businesses/${business.id}/partnership?section=counterparties`, label: 'Действующие контрагенты' },
    { href: `/office/businesses/${business.id}/partnership?section=performers`, label: 'Исполнители' },
    { href: `/office/businesses/${business.id}/partnership?section=telegram`, label: 'Telegram / MAX' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)', background: '#f5f5f5' }}>
      <aside
        style={{
          width: '220px',
          flexShrink: 0,
          background: 'white',
          borderRight: '1px solid #e5e7eb',
          padding: '1.25rem 0',
        }}
      >
        <Link
          href="/office"
          style={{
            display: 'block',
            padding: '0.5rem 1.25rem',
            color: '#6b7280',
            fontSize: '0.875rem',
            textDecoration: 'none',
          }}
        >
          ← Назад
        </Link>
        <div
          style={{
            padding: '0.75rem 1.25rem',
            fontSize: '0.75rem',
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {business.name}
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '0.5rem 1.25rem',
                color: '#111827',
                fontSize: '0.9375rem',
                textDecoration: 'none',
              }}
              className="hover:bg-gray-50"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
