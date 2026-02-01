import RequestsPageClient from './RequestsPageClient'

interface RequestsPageProps {
  params: { id: string }
}

export default function RequestsPage({ params }: RequestsPageProps) {
  return <RequestsPageClient businessId={params.id} />
}
