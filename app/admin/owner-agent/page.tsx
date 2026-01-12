import { execSync } from 'child_process'
import OwnerAgentClient from './OwnerAgentClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getGitBranch(): string | undefined {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return branch || undefined
  } catch {
    return undefined
  }
}

export default function OwnerAgentPage() {
  const gitBranch = getGitBranch()
  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'local'
  const notesPath = '/docs/owner_agent_notes.md'
  const tasksPath = '/docs/owner_agent_tasks.md'

  return (
    <OwnerAgentClient
      gitBranch={gitBranch}
      environment={environment}
      notesPath={notesPath}
      tasksPath={tasksPath}
    />
  )
}
