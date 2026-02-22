import RequestsPageClient from './RequestsPageClient'

interface RequestsPageProps {
  params: { id: string }
  searchParams: { section?: string }
}

export default function RequestsPage({ params, searchParams }: RequestsPageProps) {
  return <RequestsPageClient businessId={params.id} initialSection={searchParams.section} />
}
