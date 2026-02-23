import RequestsPageClient from './RequestsPageClient'

interface RequestsPageProps {
  params: { id: string }
  searchParams: { section?: string; fromRequestTitle?: string; fromRequestDescription?: string }
}

export default function RequestsPage({ params, searchParams }: RequestsPageProps) {
  return (
    <RequestsPageClient
      businessId={params.id}
      initialSection={searchParams.section}
      initialFromRequestTitle={searchParams.fromRequestTitle}
      initialFromRequestDescription={searchParams.fromRequestDescription}
    />
  )
}
