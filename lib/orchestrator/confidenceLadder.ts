/**
 * Orchestrator 2.1 — Confidence Ladder.
 * Шкала уверенности по matchScore.
 */

import { ORCHESTRATOR_CONFIG } from './config'

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'

const HIGH = ORCHESTRATOR_CONFIG.highConfidenceThreshold
const MED = ORCHESTRATOR_CONFIG.mediumConfidenceThreshold

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= HIGH) return 'HIGH'
  if (score >= MED) return 'MEDIUM'
  if (score >= 0.3) return 'LOW'
  return 'NONE'
}

export function shouldAutoAccept(score: number): boolean {
  return score >= HIGH
}

export function needsClarification(score: number): boolean {
  return score >= 0.3 && score < MED
}

export function isComment(score: number): boolean {
  return score < 0.3
}
