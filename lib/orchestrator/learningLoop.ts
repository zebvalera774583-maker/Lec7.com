/**
 * Orchestrator 2.1 — Learning Loop.
 * Сохраняет alias при token match + score >= 0.8.
 */

import { prisma } from '@/lib/prisma'
import { ORCHESTRATOR_CONFIG } from './config'

const ADDRESS_PATTERN = /(?:^|[\s,.-])(навагинская|войково|моремолл|ул\.?|дом|д\.|адрес|офис|кв)(?:[\s,.-]|$)/i

export async function maybeLearnAlias(
  businessId: string,
  aliasText: string,
  canonicalName: string,
  matchType: 'alias' | 'learned' | 'token' | 'none',
  score: number,
  verdict: string
): Promise<void> {
  if (matchType !== 'token') return
  if (score < ORCHESTRATOR_CONFIG.learningThreshold) return
  if (verdict === 'COMMENT') return

  const aliasNorm = aliasText.trim().toLowerCase()
  if (!aliasNorm || aliasNorm.length < 2) return
  if (ADDRESS_PATTERN.test(aliasNorm)) return

  try {
    const count = await prisma.botLearnedAlias.count({
      where: { businessId, canonicalName },
    })
    if (count >= ORCHESTRATOR_CONFIG.maxAliasPerCanonical) return

    await prisma.botLearnedAlias.upsert({
      where: {
        businessId_aliasText: { businessId, aliasText: aliasNorm },
      },
      create: {
        businessId,
        aliasText: aliasNorm,
        canonicalName,
        confidence: score,
        usageCount: 1,
        lastUsedAt: new Date(),
      },
      update: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    console.log(`[ORCH] learned_alias alias="${aliasNorm.slice(0, 40)}" canonical="${canonicalName.slice(0, 20)}"`)
  } catch {
    // ignore
  }
}

export async function touchLearnedAlias(businessId: string, aliasText: string): Promise<void> {
  const aliasNorm = aliasText.trim().toLowerCase()
  if (!aliasNorm) return

  try {
    await prisma.botLearnedAlias.updateMany({
      where: { businessId, aliasText: aliasNorm },
      data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
    })
  } catch {
    // ignore
  }
}
