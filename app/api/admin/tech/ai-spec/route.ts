import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { requireRole } from '@/lib/middleware'

const DOCS_DIR = join(process.cwd(), 'docs')
const FILES = {
  spec: 'ai-orchestrator-spec.md',
  actions: 'ai-actions.md',
  changelog: 'ai-orchestrator-changelog.md',
} as const

function readDoc(name: string): string | null {
  const filePath = join(DOCS_DIR, name)
  if (!existsSync(filePath)) return null
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

export const GET = requireRole(['LEC7_ADMIN'], async () => {
  try {
    const spec = readDoc(FILES.spec)
    const actions = readDoc(FILES.actions)
    const changelog = readDoc(FILES.changelog)

    return NextResponse.json({
      spec: spec ?? '',
      actions: actions ?? null,
      changelog: changelog ?? null,
    })
  } catch (error) {
    console.error('AI spec read error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
})
