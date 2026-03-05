/**
 * Orchestrator 2.1 — конфигурация порогов и лимитов.
 */

export const ORCHESTRATOR_CONFIG = {
  tokenMatchThreshold: 0.6,
  highConfidenceThreshold: 0.85,
  mediumConfidenceThreshold: 0.6,
  learningThreshold: 0.8,
  maxAliasPerCanonical: 50,
  maxMessageLength: 2000,
  maxSegments: 50,
  learnedAliasTtlDays: 90,
} as const
