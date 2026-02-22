import { redirect } from 'next/navigation'

interface PageProps {
  params: { id: string }
}

/** Страница Обзор удалена. Редирект на Витрину (начальная страница резидента). */
export default function BusinessDetailPage({ params }: PageProps) {
  redirect(`/office/businesses/${params.id}/preview`)
}
