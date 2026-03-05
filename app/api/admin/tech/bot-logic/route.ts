import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/middleware'
import { buildBotLogicDoc } from '@/lib/orchestrator/buildLogicDoc'

export const GET = requireRole(['LEC7_ADMIN'], async () => {
  try {
    const doc = buildBotLogicDoc()
    return NextResponse.json(doc)
  } catch (error) {
    console.error('Bot logic doc error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
})
