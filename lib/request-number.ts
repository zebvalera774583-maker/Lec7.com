import type { PrismaClient } from '@prisma/client'

type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

/**
 * Get next global request number. Must be called inside a transaction.
 * Uses PlatformCounter for atomic increment.
 */
export async function getNextRequestNumber(tx: Tx): Promise<number> {
  const counter = await tx.platformCounter.upsert({
    where: { id: 'global' },
    create: { id: 'global', lastRequestNumber: 0, updatedAt: new Date() },
    update: {},
  })

  const updated = await tx.platformCounter.update({
    where: { id: 'global' },
    data: { lastRequestNumber: { increment: 1 }, updatedAt: new Date() },
  })

  return updated.lastRequestNumber
}
