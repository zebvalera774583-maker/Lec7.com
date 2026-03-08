import { prisma } from '@/lib/prisma'

/**
 * Создаёт запись «действующий контрагент» (supplier, buyer).
 * Связь не привязана к прайсу и сохраняется при удалении прайса.
 */
export async function ensureActiveCounterparty(
  supplierBusinessId: string,
  counterpartyBusinessId: string
): Promise<void> {
  if (supplierBusinessId === counterpartyBusinessId) return
  await prisma.activeCounterparty.upsert({
    where: {
      businessId_counterpartyBusinessId: {
        businessId: supplierBusinessId,
        counterpartyBusinessId,
      },
    },
    create: {
      businessId: supplierBusinessId,
      counterpartyBusinessId,
    },
    update: {},
  })
}
