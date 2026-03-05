/**
 * Orchestrator 2.1 — Decision Engine (Rule Table).
 * Порядок правил: company → address → high → medium → clarification → comment.
 */

import { ORCHESTRATOR_CONFIG } from './config'
import type { SegmentFeatures } from './extractFeatures'

export type Verdict = 'COMMENT' | 'ITEM' | 'ITEM_AUTO' | 'ASK_QTY' | 'ASK_UNIT' | 'ITEM_ASK_UNIT'

export interface DecisionResult {
  verdict: Verdict
  reason: string
}

const HIGH = ORCHESTRATOR_CONFIG.highConfidenceThreshold
const MED = ORCHESTRATOR_CONFIG.mediumConfidenceThreshold

export function decide(features: SegmentFeatures): DecisionResult {
  // 1. Company header
  if (features.hasLegalForm) {
    return { verdict: 'COMMENT', reason: 'COMMENT_LEGAL_FORM' }
  }

  // 2. Address header
  if (features.hasAddressWord) {
    return { verdict: 'COMMENT', reason: 'COMMENT_ADDRESS' }
  }

  // 3. High confidence item
  if (features.matchScore >= HIGH) {
    return { verdict: 'ITEM_AUTO', reason: 'HIGH_MATCH' }
  }

  // 4. Medium confidence: check clarification rules before ITEM
  if (features.matchScore >= MED) {
    if (!features.hasQty) return { verdict: 'ASK_QTY', reason: 'MISSING_QTY' }
    if (features.hasDashTerminated) return { verdict: 'ASK_QTY', reason: 'DASH_TERMINATED' }
    if (!features.hasUnit) {
      if (features.wordCount <= 3 && features.hasQty) {
        return { verdict: 'ITEM_ASK_UNIT', reason: 'SAFEGUARD' }
      }
      return { verdict: 'ASK_UNIT', reason: 'MISSING_UNIT' }
    }
    return { verdict: 'ITEM', reason: 'MEDIUM_MATCH' }
  }

  // 5. Low score + no qty → comment
  if (features.matchScore < 0.3 && !features.hasQty) {
    return { verdict: 'COMMENT', reason: 'LOW_SCORE_NO_QTY' }
  }

  // 6. Long low score
  if (features.wordCount > 6 && features.matchScore < MED) {
    return { verdict: 'COMMENT', reason: 'LONG_LOW_SCORE' }
  }

  return { verdict: 'COMMENT', reason: 'FALLBACK' }
}
