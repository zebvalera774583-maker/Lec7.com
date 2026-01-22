import { prisma } from '@/lib/prisma'
import AdminDashboardClient from './AdminDashboardClient'
import { getGitBranchSafe } from './utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminPage() {
  // Получаем данные для AI-агента
  const gitBranch = getGitBranchSafe()
  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'local'
  const notesPath = '/docs/owner_agent_notes.md'
  const tasksPath = '/docs/owner_agent_tasks.md'

  // Получаем данные для активации бизнесов (точная копия select из /app/admin/businesses/page.tsx)
  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      lifecycleStatus: true,
      billingStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <AdminDashboardClient
      agentProps={{
        gitBranch,
        environment,
        notesPath,
        tasksPath,
      }}
      businesses={businesses}
    />
  )
}
