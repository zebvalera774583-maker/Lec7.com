/**
 * Backfill Request.number for existing requests that have number = null.
 * Idempotent: safe to run multiple times; skips requests that already have numbers.
 *
 * Run:
 *   npx tsx scripts/backfill-request-numbers.ts
 *
 * Or:
 *   npx ts-node scripts/backfill-request-numbers.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Backfill request numbers...')

  // 1) start = max(Request.number) ?? 0
  const maxNumber = await prisma.request.aggregate({
    _max: { number: true },
  })
  const start = maxNumber._max.number ?? 0
  console.log(`   Current max number: ${start}`)

  // 2) Select all Request where number is null, order by createdAt asc
  const nullNumberRequests = await prisma.request.findMany({
    where: { number: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (nullNumberRequests.length === 0) {
    console.log('✅ No requests with null number. Nothing to do.')
    return
  }

  console.log(`   Found ${nullNumberRequests.length} requests to backfill`)

  // 3) Assign numbers sequentially: start+1, start+2, ...
  let assigned = 0
  for (let i = 0; i < nullNumberRequests.length; i++) {
    const num = start + i + 1
    await prisma.request.update({
      where: { id: nullNumberRequests[i].id },
      data: { number: num },
    })
    assigned++
    if (assigned % 100 === 0) {
      console.log(`   Assigned ${assigned}/${nullNumberRequests.length}...`)
    }
  }

  // 4) Update PlatformCounter.lastRequestNumber = new max
  const newMax = start + nullNumberRequests.length
  await prisma.platformCounter.upsert({
    where: { id: 'global' },
    create: { id: 'global', lastRequestNumber: newMax, updatedAt: new Date() },
    update: { lastRequestNumber: newMax, updatedAt: new Date() },
  })

  console.log(`✅ Backfill complete. Assigned ${assigned} numbers. New max: ${newMax}`)
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
