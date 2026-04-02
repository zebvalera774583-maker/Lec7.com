import type { Prisma } from '@prisma/client'

/**
 * Для одного counterpartyBusinessId оставляет только один ACTIVE: все остальные ACTIVE → DECLINED,
 * затем указанное назначение → ACTIVE (и respondedAt).
 * Вызывать внутри prisma.$transaction.
 */
export async function activatePriceAssignmentExclusive(
  tx: Prisma.TransactionClient,
  assignmentId: string
): Promise<void> {
  const assignment = await tx.priceAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, counterpartyBusinessId: true },
  })
  if (!assignment) {
    throw new Error(`PriceAssignment not found: ${assignmentId}`)
  }

  const now = new Date()

  await tx.priceAssignment.updateMany({
    where: {
      counterpartyBusinessId: assignment.counterpartyBusinessId,
      status: 'ACTIVE',
      id: { not: assignmentId },
    },
    data: {
      status: 'DECLINED',
      respondedAt: now,
    },
  })

  await tx.priceAssignment.update({
    where: { id: assignmentId },
    data: {
      status: 'ACTIVE',
      respondedAt: now,
    },
  })
}
