import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gitSha =
    process.env.NEXT_PUBLIC_GIT_SHA ||
    process.env.GIT_SHA ||
    null
  const buildTime =
    process.env.BUILD_TIME ||
    process.env.NEXT_PUBLIC_BUILD_TIME ||
    new Date().toISOString()

  return NextResponse.json({
    gitSha,
    buildTime,
  })
}
