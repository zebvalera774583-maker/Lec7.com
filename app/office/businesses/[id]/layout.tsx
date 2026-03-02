import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import BusinessLayoutClient from './BusinessLayoutClient'

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
    { href: `/office/businesses/${business.id}/preview`, label: 'Витрина' },
    { href: `/office/businesses/${business.id}/profile`, label: 'Профиль' },
    { href: `/office/businesses/${business.id}/requisites`, label: 'Реквизиты предприятия' },
    { href: `/office/businesses/${business.id}/requests?section=create`, label: 'Создать заявку' },
    { href: `/office/businesses/${business.id}/requests?section=incoming`, label: 'Поступившие заявки' },
    { href: `/office/businesses/${business.id}/requests?section=archive`, label: 'Архив заявок' },
    { href: `/office/businesses/${business.id}/partnership`, label: 'Потребности' },
    { href: `/office/businesses/${business.id}/partnership?section=prices`, label: 'Мои прайсы' },
    { href: `/office/businesses/${business.id}/prices/compare`, label: 'Сводная таблица прайсов' },
    { href: `/office/businesses/${business.id}/partnership?action=create-price`, label: 'Создать прайс' },
    { href: `/office/businesses/${business.id}/partnership?action=import-price`, label: 'Импорт прайса' },
    { href: `/office/businesses/${business.id}/partnership?section=incoming`, label: 'Запросы на подключение контрагентов' },
    { href: `/office/businesses/${business.id}/partnership?section=counterparties`, label: 'Действующие контрагенты' },
    { href: `/office/businesses/${business.id}/partnership?section=performers`, label: 'Исполнители' },
    { href: `/office/businesses/${business.id}/partnership?section=telegram`, label: 'Telegram / MAX' },
  ]

  return (
    <Suspense fallback={<div style={{ minHeight: 'calc(100vh - 60px)', background: '#f5f5f5' }} />}>
      <BusinessLayoutClient
        businessId={business.id}
        businessName={business.name}
        navItems={navItems}
      >
        {children}
      </BusinessLayoutClient>
    </Suspense>
  )
}
